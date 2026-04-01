import { NextResponse } from 'next/server'
import {
  createPublicClient,
  createWalletClient,
  http,
  zeroAddress,
  type Address,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { getChainConfig, DEFAULT_CHAIN_ID } from '@/config/chains'
import { checkOrigin } from '@/lib/api-auth'
import { FHE_POOL_STATS_ABI } from '@/lib/dustpool/v2/fhe/types'
import { getFHEConfig } from '@/lib/dustpool/v2/fhe/fhe-compliance'

export const maxDuration = 60

const NO_STORE = { 'Cache-Control': 'no-store' } as const

type RecordType = 'deposit' | 'withdrawal' | 'swap'

interface RecordBody {
  type: RecordType
  asset?: string
  amount?: string
  assetIn?: string
  assetOut?: string
  chainId?: number
}

function isValidAddress(value: unknown): value is Address {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const originError = checkOrigin(req)
    if (originError) return originError

    const body: RecordBody = await req.json()
    const { type, asset, amount, assetIn, assetOut, chainId } = body

    if (!type || !['deposit', 'withdrawal', 'swap'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type: must be deposit, withdrawal, or swap' },
        { status: 400, headers: NO_STORE },
      )
    }

    const fheConfig = getFHEConfig()
    if (!fheConfig.enabled || fheConfig.poolStatsAddress === zeroAddress) {
      return NextResponse.json(
        { error: 'FHE pool stats not enabled' },
        { status: 503, headers: NO_STORE },
      )
    }

    const targetChainId = typeof chainId === 'number' ? chainId : DEFAULT_CHAIN_ID
    const chainConfig = getChainConfig(targetChainId)
    if (!chainConfig) {
      return NextResponse.json(
        { error: 'Unsupported chain' },
        { status: 404, headers: NO_STORE },
      )
    }

    const relayerKey = process.env.RELAYER_PRIVATE_KEY
    if (!relayerKey) {
      return NextResponse.json(
        { error: 'Relayer not configured' },
        { status: 503, headers: NO_STORE },
      )
    }

    const account = privateKeyToAccount(relayerKey as `0x${string}`)
    const walletClient = createWalletClient({
      account,
      chain: chainConfig.viemChain,
      transport: http(chainConfig.rpcUrl),
    })
    const publicClient = createPublicClient({
      chain: chainConfig.viemChain,
      transport: http(chainConfig.rpcUrl),
    })

    let txHash: `0x${string}`

    if (type === 'deposit') {
      if (!isValidAddress(asset)) {
        return NextResponse.json(
          { error: 'Missing or invalid asset address' },
          { status: 400, headers: NO_STORE },
        )
      }
      const parsedAmount = BigInt(amount ?? '0')

      txHash = await walletClient.writeContract({
        address: fheConfig.poolStatsAddress,
        abi: FHE_POOL_STATS_ABI,
        functionName: 'recordDeposit',
        args: [asset, parsedAmount],
      })
    } else if (type === 'withdrawal') {
      if (!isValidAddress(asset)) {
        return NextResponse.json(
          { error: 'Missing or invalid asset address' },
          { status: 400, headers: NO_STORE },
        )
      }
      const parsedAmount = BigInt(amount ?? '0')

      txHash = await walletClient.writeContract({
        address: fheConfig.poolStatsAddress,
        abi: FHE_POOL_STATS_ABI,
        functionName: 'recordWithdrawal',
        args: [asset, parsedAmount],
      })
    } else {
      if (!isValidAddress(assetIn) || !isValidAddress(assetOut)) {
        return NextResponse.json(
          { error: 'Missing or invalid assetIn/assetOut addresses' },
          { status: 400, headers: NO_STORE },
        )
      }

      txHash = await walletClient.writeContract({
        address: fheConfig.poolStatsAddress,
        abi: FHE_POOL_STATS_ABI,
        functionName: 'recordSwap',
        args: [assetIn, assetOut],
      })
    }

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
    if (receipt.status === 'reverted') {
      return NextResponse.json(
        { error: 'FHE stats transaction reverted' },
        { status: 500, headers: NO_STORE },
      )
    }

    console.log(`[fhe-stats] Recorded ${type} tx=${txHash}`)

    return NextResponse.json(
      { txHash, blockNumber: Number(receipt.blockNumber) },
      { headers: NO_STORE },
    )
  } catch (e) {
    console.error('[fhe-stats] POST error:', e)
    const message = e instanceof Error ? e.message : 'Failed to record stats'
    return NextResponse.json(
      { error: message },
      { status: 500, headers: NO_STORE },
    )
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const fheConfig = getFHEConfig()
    if (!fheConfig.enabled || fheConfig.poolStatsAddress === zeroAddress) {
      return NextResponse.json(
        { error: 'FHE pool stats not enabled' },
        { status: 503, headers: NO_STORE },
      )
    }

    const client = createPublicClient({
      transport: http(fheConfig.rpcUrl),
    })

    // ETH (zero address) is the primary tracked asset
    const ETH: Address = zeroAddress

    const [txCounts, swapCount] = await Promise.all([
      client.readContract({
        address: fheConfig.poolStatsAddress,
        abi: FHE_POOL_STATS_ABI,
        functionName: 'getTransactionCounts',
        args: [ETH],
      }) as Promise<[bigint, bigint]>,
      client.readContract({
        address: fheConfig.poolStatsAddress,
        abi: FHE_POOL_STATS_ABI,
        functionName: 'totalSwapCount',
      }) as Promise<bigint>,
    ])

    return NextResponse.json(
      {
        assets: {
          [ETH]: {
            depositCount: Number(txCounts[0]),
            withdrawalCount: Number(txCounts[1]),
          },
        },
        totalSwapCount: Number(swapCount),
      },
      { headers: NO_STORE },
    )
  } catch (e) {
    console.error('[fhe-stats] GET error:', e)
    const message = e instanceof Error ? e.message : 'Failed to read stats'
    return NextResponse.json(
      { error: message },
      { status: 500, headers: NO_STORE },
    )
  }
}
