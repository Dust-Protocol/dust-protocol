import { NextResponse } from 'next/server'
import { getRelayerTreeRoot, getTreeLeafCount } from '@/lib/dustpool/v2/relayer-tree'
import { getDustPoolV2Address } from '@/lib/dustpool/v2/contracts'
import { DEFAULT_CHAIN_ID } from '@/config/chains'
import { toBytes32Hex } from '@/lib/dustpool/poseidon'
import { observeTreeSync } from '@/lib/metrics'

export const maxDuration = 60

const NO_STORE = { 'Cache-Control': 'no-store' } as const

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const chainId = parseInt(searchParams.get('chainId') || '') || DEFAULT_CHAIN_ID

    if (!getDustPoolV2Address(chainId)) {
      return NextResponse.json(
        { error: 'DustPoolV2 not deployed on this chain' },
        { status: 404, headers: NO_STORE },
      )
    }

    const startTime = performance.now()
    const root = await getRelayerTreeRoot(chainId)
    const leafCount = await getTreeLeafCount(chainId)
    observeTreeSync(String(chainId), (performance.now() - startTime) / 1000)

    return NextResponse.json(
      { root: toBytes32Hex(root), leafCount },
      { headers: NO_STORE },
    )
  } catch (e) {
    console.error('[V2/tree/root] Error:', e)
    return NextResponse.json(
      { error: 'Failed to fetch tree root' },
      { status: 503, headers: NO_STORE },
    )
  }
}
