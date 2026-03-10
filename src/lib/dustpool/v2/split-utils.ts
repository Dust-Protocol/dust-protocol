import { zeroAddress, type Address } from 'viem'
import type { SplitOutputNote } from './proof-inputs'
import type { NoteCommitmentV2 } from './types'
import { getUSDCAddress } from '@/lib/swap/constants'
import { getChainConfig } from '@/config/chains'

export function resolveTokenSymbol(asset: Address, chainId: number): string {
  if (asset === zeroAddress) return getChainConfig(chainId).nativeCurrency.symbol
  try {
    const usdcAddr = getUSDCAddress(chainId)
    if (usdcAddr.toLowerCase() === asset.toLowerCase()) return 'USDC'
  } catch { /* USDC not configured for this chain */ }
  throw new Error(`Unknown token ${asset} on chain ${chainId}. Supported: native, USDC`)
}

export function parseSplitCalldata(calldata: string, numPublicSignals: number): {
  proofCalldata: string
  publicSignals: string[]
} {
  const hexElements = calldata.match(/0x[0-9a-fA-F]+/g)
  const expectedMin = 24 + numPublicSignals
  if (!hexElements || hexElements.length < expectedMin) {
    throw new Error(
      `Failed to parse split proof calldata — expected ≥${expectedMin} hex elements, got ${hexElements?.length ?? 0}`
    )
  }
  const proofCalldata = '0x' + hexElements.slice(0, 24).map(e => e.slice(2)).join('')
  const publicSignals = hexElements.slice(24, 24 + numPublicSignals)
  return { proofCalldata, publicSignals }
}

export function splitOutputToNoteCommitment(
  out: SplitOutputNote,
  leafIndex: number,
  chainId: number
): NoteCommitmentV2 {
  return {
    note: {
      owner: out.owner,
      amount: out.amount,
      asset: out.asset,
      chainId,
      blinding: out.blinding,
    },
    commitment: out.commitment,
    leafIndex,
    spent: false,
    createdAt: Date.now(),
  }
}
