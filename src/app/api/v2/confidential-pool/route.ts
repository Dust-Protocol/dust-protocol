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
import { sepolia } from 'viem/chains'
import { checkOrigin } from '@/lib/api-auth'

export const maxDuration = 60

const NO_STORE = { 'Cache-Control': 'no-store' } as const

const POOL_ADDRESS = '0x8769Cc9A6AA0d7b7F1f29eDbAD2e9634F9102d4e' as Address
const ORACLE_ADDRESS = '0x20f25781a041c577b80601DeE602993353018719' as Address
const SEPOLIA_RPC = process.env.NEXT_PUBLIC_FHE_RPC_URL || 'https://gateway.tenderly.co/public/sepolia'
const RELAYER_KEY = process.env.RELAYER_PRIVATE_KEY

const POLL_INTERVAL_MS = 3_000
const MAX_POLL_ATTEMPTS = 20

const checkCooldowns = new Map<string, number>()
const CHECK_COOLDOWN_MS = 30_000

const POOL_ABI = [
  { name: 'compliancePassed', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'depositorCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'paused', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
] as const

const ORACLE_ABI = [
  { name: 'checkCompliance', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'encryptedAddr', type: 'bytes32' }, { name: 'inputProof', type: 'bytes' }, { name: 'bucketHint', type: 'uint8' }], outputs: [{ name: 'requestId', type: 'uint256' }] },
  { name: 'getComplianceResult', type: 'function', stateMutability: 'view', inputs: [{ name: 'requestId', type: 'uint256' }], outputs: [{ name: 'resolved', type: 'bool' }, { name: 'isBlocked', type: 'bool' }] },
] as const

type FHEInstance = {
  createEncryptedInput: (contractAddress: Address, callerAddress: Address) => {
    addAddress: (address: Address) => {
      encrypt: () => { handles: Uint8Array[]; inputProof: Uint8Array }
    }
  }
}

let _fheInstance: FHEInstance | null = null
let _fhePromise: Promise<FHEInstance> | null = null

async function getServerFHEInstance(): Promise<FHEInstance> {
  if (_fheInstance) return _fheInstance
  if (_fhePromise) return _fhePromise

  _fhePromise = (async () => {
    const fhevmjs: { createInstance: (opts: { chainId: number; networkUrl: string }) => Promise<unknown> } =
      await import(/* webpackIgnore: true */ 'fhevmjs' as string)

    const instance = await fhevmjs.createInstance({
      chainId: 11155111,
      networkUrl: SEPOLIA_RPC,
    }) as FHEInstance

    _fheInstance = instance
    return instance
  })()

  try {
    return await _fhePromise
  } catch (e) {
    _fhePromise = null
    throw e
  }
}

function getClients() {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC),
  })

  if (!RELAYER_KEY) throw new Error('RELAYER_PRIVATE_KEY not configured')

  const account = privateKeyToAccount(RELAYER_KEY as `0x${string}`)
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(SEPOLIA_RPC),
  })

  return { publicClient, walletClient }
}

function computeBucketHint(address: Address): number {
  const hash = keccak256(encodePacked(['address'], [address]))
  return parseInt(hash.slice(2, 4), 16)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

type PostBody = {
  action: 'check-compliance' | 'register-compliance' | 'deposit-status'
  address?: string
  requestId?: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const originError = checkOrigin(request)
    if (originError) return originError

    const body = (await request.json()) as PostBody
    const { action } = body

    if (!action || !['check-compliance', 'register-compliance', 'deposit-status'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action — expected check-compliance, register-compliance, or deposit-status' },
        { status: 400, headers: NO_STORE },
      )
    }

    if (action === 'check-compliance') {
      return handleCheckCompliance(body.address)
    }

    if (action === 'register-compliance') {
      return handleRegisterCompliance(body.requestId)
    }

    return handleDepositStatus(body.address)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[confidential-pool] POST error:', msg)

    if (msg.includes('not configured')) {
      return NextResponse.json(
        { error: 'Relayer not configured' },
        { status: 503, headers: NO_STORE },
      )
    }

    return NextResponse.json(
      { error: 'Request failed' },
      { status: 500, headers: NO_STORE },
    )
  }
}

async function handleCheckCompliance(address: string | undefined): Promise<NextResponse> {
  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { error: 'Invalid or missing address' },
      { status: 400, headers: NO_STORE },
    )
  }

  const cooldownKey = address.toLowerCase()
  const lastCheck = checkCooldowns.get(cooldownKey)
  if (lastCheck && Date.now() - lastCheck < CHECK_COOLDOWN_MS) {
    return NextResponse.json(
      { error: 'Check already in progress or recently completed — try again shortly' },
      { status: 429, headers: NO_STORE },
    )
  }

  checkCooldowns.set(cooldownKey, Date.now())

  const { publicClient, walletClient } = getClients()
  const fheInstance = await getServerFHEInstance()
  const relayerAddress = walletClient.account.address

  const input = fheInstance.createEncryptedInput(ORACLE_ADDRESS, relayerAddress)
  const { handles, inputProof } = input.addAddress(address as Address).encrypt()

  const bucketHint = computeBucketHint(address as Address)

  const txHash = await walletClient.writeContract({
    address: ORACLE_ADDRESS,
    abi: ORACLE_ABI,
    functionName: 'checkCompliance',
    args: [toHex(handles[0]), toHex(inputProof), bucketHint],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
  if (receipt.status === 'reverted') {
    checkCooldowns.delete(cooldownKey)
    return NextResponse.json(
      { error: 'Compliance check transaction reverted' },
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

  let resolved = false
  let isBlocked = false

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const [gatewayResolved, gatewayBlocked] = await publicClient.readContract({
      address: ORACLE_ADDRESS,
      abi: ORACLE_ABI,
      functionName: 'getComplianceResult',
      args: [requestId],
    }) as [boolean, boolean]

    if (gatewayResolved) {
      resolved = true
      isBlocked = gatewayBlocked
      break
    }

    await sleep(POLL_INTERVAL_MS)
  }

  if (!resolved) {
    return NextResponse.json(
      { status: 'pending', requestId: requestId.toString() },
      { headers: NO_STORE },
    )
  }

  console.log(
    `[confidential-pool] Compliance resolved: address=${address} blocked=${isBlocked} requestId=${requestId}`,
  )

  return NextResponse.json(
    { status: isBlocked ? 'blocked' : 'clear', requestId: requestId.toString() },
    { headers: NO_STORE },
  )
}

async function handleRegisterCompliance(requestIdStr: string | undefined): Promise<NextResponse> {
  if (!requestIdStr) {
    return NextResponse.json(
      { error: 'Missing requestId' },
      { status: 400, headers: NO_STORE },
    )
  }

  let requestId: bigint
  try {
    requestId = BigInt(requestIdStr)
  } catch {
    return NextResponse.json(
      { error: 'Invalid requestId format' },
      { status: 400, headers: NO_STORE },
    )
  }

  const { publicClient } = getClients()

  const [resolved, isBlocked] = await publicClient.readContract({
    address: ORACLE_ADDRESS,
    abi: ORACLE_ABI,
    functionName: 'getComplianceResult',
    args: [requestId],
  }) as [boolean, boolean]

  if (!resolved) {
    return NextResponse.json(
      { error: 'Compliance result not yet resolved' },
      { status: 409, headers: NO_STORE },
    )
  }

  if (isBlocked) {
    return NextResponse.json(
      { error: 'Address is blocked by compliance check' },
      { status: 403, headers: NO_STORE },
    )
  }

  return NextResponse.json(
    { status: 'ok', resolved: true, isBlocked: false },
    { headers: NO_STORE },
  )
}

async function handleDepositStatus(address: string | undefined): Promise<NextResponse> {
  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { error: 'Invalid or missing address' },
      { status: 400, headers: NO_STORE },
    )
  }

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC),
  })

  const [compliancePassed, depositorCount, paused] = await Promise.all([
    publicClient.readContract({
      address: POOL_ADDRESS,
      abi: POOL_ABI,
      functionName: 'compliancePassed',
      args: [address as Address],
    }) as Promise<boolean>,
    publicClient.readContract({
      address: POOL_ADDRESS,
      abi: POOL_ABI,
      functionName: 'depositorCount',
    }) as Promise<bigint>,
    publicClient.readContract({
      address: POOL_ADDRESS,
      abi: POOL_ABI,
      functionName: 'paused',
    }) as Promise<boolean>,
  ])

  return NextResponse.json(
    {
      compliancePassed,
      depositorCount: depositorCount.toString(),
      paused,
    },
    { headers: NO_STORE },
  )
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    if (action !== 'pool-info') {
      return NextResponse.json(
        { error: 'Invalid action — expected pool-info' },
        { status: 400, headers: NO_STORE },
      )
    }

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(SEPOLIA_RPC),
    })

    const [depositorCount, paused] = await Promise.all([
      publicClient.readContract({
        address: POOL_ADDRESS,
        abi: POOL_ABI,
        functionName: 'depositorCount',
      }) as Promise<bigint>,
      publicClient.readContract({
        address: POOL_ADDRESS,
        abi: POOL_ABI,
        functionName: 'paused',
      }) as Promise<boolean>,
    ])

    return NextResponse.json(
      {
        depositorCount: depositorCount.toString(),
        paused,
      },
      { headers: NO_STORE },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[confidential-pool] GET error:', msg)
    return NextResponse.json(
      { error: 'Failed to fetch pool info' },
      { status: 500, headers: NO_STORE },
    )
  }
}
