import { NextRequest, NextResponse } from 'next/server'
import {
  type Address,
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  keccak256,
  encodePacked,
  toHex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getChainConfig, isChainSupported, DEFAULT_CHAIN_ID } from '@/config/chains'
import { checkOrigin } from '@/lib/api-auth'
import {
  type FHEInstance,
  FHE_COMPLIANCE_ORACLE_ABI,
  FHE_COMPLIANCE_BRIDGE_ABI,
  FHE_POLL_INTERVAL_MS,
  FHE_MAX_POLL_ATTEMPTS,
  FHE_GATEWAY_TIMEOUT_MS,
} from '@/lib/dustpool/v2/fhe/types'

export const maxDuration = 60

const NO_STORE = { 'Cache-Control': 'no-store' } as const

const RELAYER_KEY = process.env.RELAYER_PRIVATE_KEY

// Rate limiting: per-address cooldown prevents redundant FHE checks
const checkCooldowns = new Map<string, number>()
const CHECK_COOLDOWN_MS = 30_000

function getViemClients(chainId: number) {
  const config = getChainConfig(chainId)

  const publicClient = createPublicClient({
    chain: config.viemChain,
    transport: http(config.rpcUrl),
  })

  if (!RELAYER_KEY) throw new Error('RELAYER_PRIVATE_KEY not configured')

  const account = privateKeyToAccount(RELAYER_KEY as `0x${string}`)
  const walletClient = createWalletClient({
    account,
    chain: config.viemChain,
    transport: http(config.rpcUrl),
  })

  return { publicClient, walletClient, config }
}

// Lazy-loaded fhevmjs instance per chain (server-side, separate from client singleton)
const fheInstances = new Map<number, FHEInstance>()
const fheInitPromises = new Map<number, Promise<FHEInstance>>()

async function getFHEInstance(chainId: number, rpcUrl: string): Promise<FHEInstance> {
  const cached = fheInstances.get(chainId)
  if (cached) return cached

  const pending = fheInitPromises.get(chainId)
  if (pending) return pending

  const initPromise = (async () => {
    const fhevmjs: { createInstance: (opts: { chainId: number; networkUrl: string }) => Promise<unknown> } =
      await import(/* webpackIgnore: true */ 'fhevmjs' as string)

    const instance = await fhevmjs.createInstance({
      chainId,
      networkUrl: rpcUrl,
    }) as FHEInstance

    fheInstances.set(chainId, instance)
    return instance
  })()

  fheInitPromises.set(chainId, initPromise)
  try {
    return await initPromise
  } catch (e) {
    fheInitPromises.delete(chainId)
    throw e
  }
}

function computeBucketHint(address: Address): number {
  const hash = keccak256(encodePacked(['address'], [address]))
  return parseInt(hash.slice(2, 4), 16)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * POST /api/v2/fhe-compliance
 *
 * Checks FHE compliance for a depositor address.
 * Fast path: returns cached bridge result if already screened.
 * Slow path: encrypts address, submits to oracle, polls Gateway, updates bridge cache.
 *
 * Body: { address: string, chainId: number }
 * Returns: { status: 'clear' | 'blocked' | 'pending', requestId?: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const originError = checkOrigin(request)
    if (originError) return originError

    const body = await request.json()
    const chainId = typeof body.chainId === 'number' ? body.chainId : DEFAULT_CHAIN_ID
    const address = body.address as string | undefined

    if (!isChainSupported(chainId)) {
      return NextResponse.json(
        { error: `Unsupported chain: ${chainId}` },
        { status: 400, headers: NO_STORE },
      )
    }

    if (!address || !isAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid or missing address' },
        { status: 400, headers: NO_STORE },
      )
    }

    const config = getChainConfig(chainId)
    const oracleAddress = config.contracts.fheComplianceOracle as Address | null
    const bridgeAddress = config.contracts.fheComplianceBridge as Address | null

    if (!oracleAddress || !bridgeAddress) {
      return NextResponse.json(
        { error: 'FHE compliance not deployed on this chain' },
        { status: 404, headers: NO_STORE },
      )
    }

    // Per-address cooldown to prevent redundant FHE checks
    const cooldownKey = `${chainId}:${address.toLowerCase()}`
    const lastCheck = checkCooldowns.get(cooldownKey)
    if (lastCheck && Date.now() - lastCheck < CHECK_COOLDOWN_MS) {
      return NextResponse.json(
        { error: 'Check already in progress or recently completed — try again shortly' },
        { status: 429, headers: NO_STORE },
      )
    }

    const { publicClient, walletClient } = getViemClients(chainId)

    // Fast path: check bridge cache
    const isScreened = await publicClient.readContract({
      address: bridgeAddress,
      abi: FHE_COMPLIANCE_BRIDGE_ABI,
      functionName: 'isScreened',
      args: [address as Address],
    }) as boolean

    if (isScreened) {
      const isBlocked = await publicClient.readContract({
        address: bridgeAddress,
        abi: FHE_COMPLIANCE_BRIDGE_ABI,
        functionName: 'isBlocked',
        args: [address as Address],
      }) as boolean

      return NextResponse.json(
        { status: isBlocked ? 'blocked' : 'clear' },
        { headers: NO_STORE },
      )
    }

    // Slow path: FHE compliance check
    checkCooldowns.set(cooldownKey, Date.now())

    const fheInstance = await getFHEInstance(chainId, config.rpcUrl)
    const relayerAddress = walletClient.account.address

    const input = fheInstance.createEncryptedInput(oracleAddress, relayerAddress)
    const { handles, inputProof } = input.addAddress(address as Address).encrypt()

    const bucketHint = computeBucketHint(address as Address)

    const txHash = await walletClient.writeContract({
      address: oracleAddress,
      abi: FHE_COMPLIANCE_ORACLE_ABI,
      functionName: 'checkCompliance',
      args: [toHex(handles[0]), toHex(inputProof), bucketHint],
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
    if (receipt.status === 'reverted') {
      checkCooldowns.delete(cooldownKey)
      return NextResponse.json(
        { error: 'FHE compliance check transaction reverted' },
        { status: 500, headers: NO_STORE },
      )
    }

    // Extract requestId from ComplianceCheckRequested event logs
    let requestId: bigint | null = null
    for (const log of receipt.logs) {
      if (log.topics.length >= 2 && log.topics[1]) {
        const parsed = BigInt(log.topics[1])
        if (parsed > 0n) {
          requestId = parsed
          break
        }
      }
    }

    if (requestId === null) {
      checkCooldowns.delete(cooldownKey)
      return NextResponse.json(
        { error: 'Could not extract requestId from transaction logs' },
        { status: 500, headers: NO_STORE },
      )
    }

    // Poll for KMS decryption result (coprocessor resolves asynchronously)
    let resolved = false
    let isBlocked = false

    for (let attempt = 0; attempt < FHE_MAX_POLL_ATTEMPTS; attempt++) {
      const [gatewayResolved, gatewayBlocked] = await publicClient.readContract({
        address: oracleAddress,
        abi: FHE_COMPLIANCE_ORACLE_ABI,
        functionName: 'getComplianceResult',
        args: [requestId],
      }) as [boolean, boolean]

      if (gatewayResolved) {
        resolved = true
        isBlocked = gatewayBlocked
        break
      }

      await sleep(FHE_POLL_INTERVAL_MS)
    }

    if (!resolved) {
      // Gateway timed out — return pending so frontend can poll via GET
      return NextResponse.json(
        { status: 'pending', requestId: requestId.toString() },
        { headers: NO_STORE },
      )
    }

    // Update bridge cache with result
    try {
      const updateHash = await walletClient.writeContract({
        address: bridgeAddress,
        abi: FHE_COMPLIANCE_BRIDGE_ABI,
        functionName: 'updateCache',
        args: [address as Address, isBlocked],
      })
      const updateReceipt = await publicClient.waitForTransactionReceipt({ hash: updateHash })
      if (updateReceipt.status === 'reverted') {
        console.error('[fhe-compliance] Bridge cache update reverted')
      }
    } catch (e) {
      // Non-fatal: the compliance result is still valid even if cache update fails
      const msg = e instanceof Error ? e.message : 'Unknown error'
      console.error('[fhe-compliance] Bridge cache update failed:', msg)
    }

    console.log(
      `[fhe-compliance] Resolved: address=${address} blocked=${isBlocked} requestId=${requestId}`,
    )

    return NextResponse.json(
      { status: isBlocked ? 'blocked' : 'clear' },
      { headers: NO_STORE },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[fhe-compliance] POST error:', msg)

    if (msg.includes('not configured')) {
      return NextResponse.json(
        { error: 'Relayer not configured' },
        { status: 503, headers: NO_STORE },
      )
    }

    return NextResponse.json(
      { error: 'FHE compliance check failed' },
      { status: 500, headers: NO_STORE },
    )
  }
}

/**
 * GET /api/v2/fhe-compliance?requestId=123&chainId=11155111
 *
 * Checks status of a pending FHE compliance request.
 * Used by the frontend to poll after POST returns { status: 'pending' }.
 *
 * Returns: { resolved: boolean, isBlocked?: boolean }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url)
    const requestIdStr = url.searchParams.get('requestId')
    const chainId = Number(url.searchParams.get('chainId') ?? DEFAULT_CHAIN_ID)

    if (!isChainSupported(chainId)) {
      return NextResponse.json(
        { error: `Unsupported chain: ${chainId}` },
        { status: 400, headers: NO_STORE },
      )
    }

    if (!requestIdStr) {
      return NextResponse.json(
        { error: 'Missing requestId parameter' },
        { status: 400, headers: NO_STORE },
      )
    }

    let requestId: bigint
    try {
      requestId = BigInt(requestIdStr)
    } catch {
      return NextResponse.json(
        { error: 'Invalid requestId format (expected bigint-parseable string)' },
        { status: 400, headers: NO_STORE },
      )
    }

    const config = getChainConfig(chainId)
    const oracleAddress = config.contracts.fheComplianceOracle as Address | null

    if (!oracleAddress) {
      return NextResponse.json(
        { error: 'FHE compliance not deployed on this chain' },
        { status: 404, headers: NO_STORE },
      )
    }

    const publicClient = createPublicClient({
      chain: config.viemChain,
      transport: http(config.rpcUrl),
    })

    const [resolved, isBlocked] = await publicClient.readContract({
      address: oracleAddress,
      abi: FHE_COMPLIANCE_ORACLE_ABI,
      functionName: 'getComplianceResult',
      args: [requestId],
    }) as [boolean, boolean]

    if (!resolved) {
      return NextResponse.json({ resolved: false }, { headers: NO_STORE })
    }

    return NextResponse.json(
      { resolved: true, isBlocked },
      { headers: NO_STORE },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[fhe-compliance] GET error:', msg)
    return NextResponse.json(
      { error: 'Failed to check compliance result' },
      { status: 500, headers: NO_STORE },
    )
  }
}
