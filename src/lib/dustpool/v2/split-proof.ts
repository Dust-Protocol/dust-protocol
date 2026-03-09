import { parseSplitCalldata } from './split-utils'
import type { RelayerClient } from './relayer-client'

export const SPLIT_CIRCUIT_WASM = '/circuits/v2-split/DustV2Split.wasm'
export const SPLIT_CIRCUIT_ZKEY = process.env.NEXT_PUBLIC_V2_SPLIT_ZKEY_URL || 'https://pub-79a49cd9d00544bdbf2c2dd393b47a1f.r2.dev/v2-split/DustV2Split.zkey?v=2'
export const SPLIT_VKEY_PATH = '/circuits/v2-split/verification_key.json'
export const LEAF_POLL_ATTEMPTS = 15
export const LEAF_POLL_DELAY_MS = 2_000

export async function generateSplitProof(
  circuitInputs: Record<string, string | string[] | string[][]>
): Promise<{ proof: unknown; publicSignals: string[]; proofCalldata: string }> {
  const { fflonk } = await import('snarkjs')
  const { proof, publicSignals } = await fflonk.fullProve(
    circuitInputs,
    SPLIT_CIRCUIT_WASM,
    SPLIT_CIRCUIT_ZKEY
  )

  const calldata = await fflonk.exportSolidityCallData(publicSignals, proof)
  const parsed = parseSplitCalldata(calldata, publicSignals.length)
  return { proof, publicSignals, proofCalldata: parsed.proofCalldata }
}

export async function verifySplitProofLocally(
  proof: unknown,
  publicSignals: string[]
): Promise<boolean> {
  try {
    const vKeyResponse = await fetch(SPLIT_VKEY_PATH)
    const vKey = await vKeyResponse.json()
    const { fflonk } = await import('snarkjs')
    return await fflonk.verify(vKey, publicSignals, proof)
  } catch (error) {
    console.error('[DustPoolV2] Split proof local verification failed:', error)
    return false
  }
}

export async function pollForLeafIndex(
  relayer: RelayerClient,
  commitmentHex: string,
  chainId: number
): Promise<number> {
  for (let i = 0; i < LEAF_POLL_ATTEMPTS; i++) {
    const status = await relayer.getDepositStatus(commitmentHex, chainId)
    if (status.confirmed && status.leafIndex >= 0) {
      return status.leafIndex
    }
    if (i < LEAF_POLL_ATTEMPTS - 1) {
      await new Promise(r => setTimeout(r, LEAF_POLL_DELAY_MS))
    }
  }
  throw new Error(`Leaf index not confirmed for ${commitmentHex.slice(0, 18)}...`)
}
