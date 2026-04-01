import {
  type Address,
  type PublicClient,
  type WalletClient,
  keccak256,
  encodePacked,
  toHex,
  createPublicClient,
  http,
} from 'viem'
import {
  type FHEInstance,
  type FHEComplianceStatus,
  type FHEComplianceCheckResult,
  type FHEChainConfig,
  FHE_COMPLIANCE_ORACLE_ABI,
  FHE_COMPLIANCE_BRIDGE_ABI,
  FHE_GATEWAY_TIMEOUT_MS,
  FHE_POLL_INTERVAL_MS,
  FHE_MAX_POLL_ATTEMPTS,
} from './types'

// ── FHE Chain Config ──

const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000'

const DEFAULT_FHE_CONFIG: FHEChainConfig = {
  chainId: 0,
  rpcUrl: '',
  oracleAddress: ZERO_ADDRESS,
  bridgeAddress: ZERO_ADDRESS,
  poolStatsAddress: ZERO_ADDRESS,
  confidentialDustPoolAddress: ZERO_ADDRESS,
  enabled: false,
}

let _fheConfig: FHEChainConfig = { ...DEFAULT_FHE_CONFIG }

export function setFHEConfig(config: Partial<FHEChainConfig>): void {
  _fheConfig = { ..._fheConfig, ...config }
  // Invalidate cached clients when config changes
  _fhePublicClient = null
  _fhevmInstance = null
  _fhevmInitPromise = null
}

export function getFHEConfig(): FHEChainConfig {
  return _fheConfig
}

export function isFHEComplianceEnabled(): boolean {
  return _fheConfig.enabled && _fheConfig.oracleAddress !== ZERO_ADDRESS
}

// ── fhevmjs Singleton (promise-deduped lazy init) ──

let _fhevmInstance: FHEInstance | null = null
let _fhevmInitPromise: Promise<FHEInstance> | null = null

async function getFHEInstance(): Promise<FHEInstance> {
  if (_fhevmInstance) return _fhevmInstance

  // Promise dedup: concurrent callers share a single init
  if (_fhevmInitPromise) return _fhevmInitPromise

  _fhevmInitPromise = (async () => {
    const fhevmjs: { createInstance: (opts: { chainId: number; networkUrl: string }) => Promise<unknown> } =
      await import(/* webpackIgnore: true */ 'fhevmjs' as string)
    const instance = await fhevmjs.createInstance({
      chainId: _fheConfig.chainId,
      networkUrl: _fheConfig.rpcUrl,
    }) as FHEInstance
    _fhevmInstance = instance
    return instance
  })()

  try {
    return await _fhevmInitPromise
  } catch (e) {
    _fhevmInitPromise = null
    throw e
  }
}

export function resetFHEInstance(): void {
  _fhevmInstance = null
  _fhevmInitPromise = null
}

// ── Encryption Helpers (consolidated from fhevm-client.ts) ──

export async function encryptAddress(
  contractAddr: Address,
  userAddr: Address,
  targetAddr: Address,
): Promise<{ handle: Uint8Array; inputProof: Uint8Array }> {
  const instance = await getFHEInstance()
  const input = instance.createEncryptedInput(contractAddr, userAddr)
  const { handles, inputProof } = input.addAddress(targetAddr).encrypt()
  return { handle: handles[0], inputProof }
}

export async function encryptUint64(
  contractAddr: Address,
  userAddr: Address,
  value: bigint,
): Promise<{ handle: Uint8Array; inputProof: Uint8Array }> {
  const instance = await getFHEInstance()
  const input = instance.createEncryptedInput(contractAddr, userAddr)
  const { handles, inputProof } = input.add64(value).encrypt()
  return { handle: handles[0], inputProof }
}

export async function encryptUint256(
  contractAddr: Address,
  userAddr: Address,
  value: bigint,
): Promise<{ handle: Uint8Array; inputProof: Uint8Array }> {
  const instance = await getFHEInstance()
  const input = instance.createEncryptedInput(contractAddr, userAddr)
  const { handles, inputProof } = input.add256(value).encrypt()
  return { handle: handles[0], inputProof }
}

// ── Bucket Computation ──

export function computeBucketHint(address: Address): number {
  const hash = keccak256(encodePacked(['address'], [address]))
  return parseInt(hash.slice(2, 4), 16)
}

// ── FHE Public Client (oracle chain) ──

let _fhePublicClient: PublicClient | null = null

function getFHEPublicClient(): PublicClient {
  if (_fhePublicClient) return _fhePublicClient
  _fhePublicClient = createPublicClient({
    transport: http(_fheConfig.rpcUrl),
  }) as PublicClient
  return _fhePublicClient
}

// ── Core: Encrypted Compliance Check ──

export async function checkFHECompliance(
  address: Address,
  walletClient: WalletClient,
  onStatus?: (status: FHEComplianceStatus) => void,
): Promise<FHEComplianceCheckResult> {
  if (!isFHEComplianceEnabled()) {
    throw new Error('FHE compliance is not enabled')
  }

  const fheClient = getFHEPublicClient()

  onStatus?.({ status: 'encrypting' })
  const fheInstance = await getFHEInstance()

  const senderAddress = walletClient.account?.address
  if (!senderAddress) throw new Error('Wallet not connected')

  const input = fheInstance.createEncryptedInput(
    _fheConfig.oracleAddress,
    senderAddress,
  )
  const { handles, inputProof } = input.addAddress(address).encrypt()

  const bucketHint = computeBucketHint(address)

  onStatus?.({ status: 'submitting' })
  const txHash = await walletClient.writeContract({
    address: _fheConfig.oracleAddress,
    abi: FHE_COMPLIANCE_ORACLE_ABI,
    functionName: 'checkCompliance',
    args: [toHex(handles[0]), toHex(inputProof), bucketHint],
    chain: walletClient.chain,
    account: senderAddress,
  })

  const receipt = await fheClient.waitForTransactionReceipt({ hash: txHash })
  if (receipt.status === 'reverted') {
    throw new Error('FHE compliance check transaction reverted')
  }

  const requestId = extractRequestIdFromLogs(receipt.logs)

  onStatus?.({ status: 'waiting-gateway', requestId })
  const result = await pollForResult(fheClient, requestId)

  onStatus?.({ status: 'resolved', isBlocked: result.isBlocked })

  return {
    requestId,
    resolved: true,
    isBlocked: result.isBlocked,
    txHash,
    resultHandle: result.resultHandle ?? null,
  }
}

// ── Polling Logic ──

async function pollForResult(
  client: PublicClient,
  requestId: bigint,
): Promise<{ isBlocked: boolean; resultHandle?: string }> {
  for (let attempt = 0; attempt < FHE_MAX_POLL_ATTEMPTS; attempt++) {
    const [resolved, isBlocked] = await client.readContract({
      address: _fheConfig.oracleAddress,
      abi: FHE_COMPLIANCE_ORACLE_ABI,
      functionName: 'getComplianceResult',
      args: [requestId],
    }) as [boolean, boolean]

    if (resolved) {
      const handle = await client.readContract({
        address: _fheConfig.oracleAddress,
        abi: FHE_COMPLIANCE_ORACLE_ABI,
        functionName: 'getResultHandle',
        args: [requestId],
      }) as string
      return { isBlocked, resultHandle: handle }
    }

    await sleep(FHE_POLL_INTERVAL_MS)
  }

  throw new Error(
    `FHE compliance check timed out after ${FHE_GATEWAY_TIMEOUT_MS}ms (${FHE_MAX_POLL_ATTEMPTS} attempts)`
  )
}

// ── Bridge Cache Check (fast path — reads from app chain, not FHE chain) ──

export async function checkFHEBridgeCache(
  address: Address,
  publicClient?: PublicClient,
): Promise<{ screened: boolean; isBlocked: boolean } | null> {
  if (!isFHEComplianceEnabled()) return null

  const client = publicClient ?? getFHEPublicClient()

  try {
    const isScreened = await client.readContract({
      address: _fheConfig.bridgeAddress,
      abi: FHE_COMPLIANCE_BRIDGE_ABI,
      functionName: 'isScreened',
      args: [address],
    }) as boolean

    if (!isScreened) return { screened: false, isBlocked: false }

    const isBlocked = await client.readContract({
      address: _fheConfig.bridgeAddress,
      abi: FHE_COMPLIANCE_BRIDGE_ABI,
      functionName: 'isBlocked',
      args: [address],
    }) as boolean

    return { screened: true, isBlocked }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[fhe-compliance] Bridge cache read failed:', msg)
    return null
  }
}

// ── Helpers ──

function extractRequestIdFromLogs(
  logs: readonly { topics: readonly string[]; data: string }[],
): bigint {
  for (const log of logs) {
    if (log.topics.length >= 2) {
      const requestId = BigInt(log.topics[1])
      if (requestId > 0n) return requestId
    }
  }
  throw new Error('Could not extract requestId from transaction logs')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
