// V2 DustPool FFLONK proof generation
//
// Generates FFLONK proofs in a Web Worker (with main-thread fallback).
// Returns both the raw proof object and the Solidity-formatted calldata
// (768 bytes = 24 field elements) needed by the relayer.

import type { WorkerResponse } from './proof.worker'
import type { ProofInputs } from './types'
import { TREE_DEPTH } from './constants'

const WASM_PATH = '/circuits/v2/DustV2Transaction.wasm'
const ZKEY_PATH = process.env.NEXT_PUBLIC_V2_ZKEY_URL || 'https://pub-79a49cd9d00544bdbf2c2dd393b47a1f.r2.dev/v2/DustV2Transaction.zkey?v=2'
const VKEY_PATH = '/circuits/v2/verification_key.json'
const PROOF_TIMEOUT_MS = 300_000

export interface V2ProofResult {
  proof: unknown
  publicSignals: string[]
  /** 0x-prefixed hex string: 768 bytes (24 * 32) for the FFLONK verifier */
  proofCalldata: string
}

// ── Worker singleton ──────────────────────────────────────────────────────

let proofWorker: Worker | null = null
const workerPromises = new Map<
  string,
  {
    resolve: (v: V2ProofResult) => void
    reject: (e: Error) => void
    onProgress?: (stage: string, progress: number) => void
  }
>()

function getProofWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return null
  }

  if (!proofWorker) {
    try {
      proofWorker = new Worker(
        new URL('./proof.worker.ts', import.meta.url),
        { type: 'module' }
      )

      proofWorker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { type, id, data, error, stage, progress } = event.data
        const pending = workerPromises.get(id)
        if (!pending) return

        if (type === 'progress' && stage && progress !== undefined) {
          pending.onProgress?.(stage, progress)
        } else if (type === 'result') {
          workerPromises.delete(id)
          const result = data as { proof: unknown; publicSignals: string[]; calldata: string }
          pending.resolve({
            proof: result.proof,
            publicSignals: result.publicSignals,
            proofCalldata: parseCalldataProofHex(result.calldata),
          })
        } else if (type === 'error') {
          workerPromises.delete(id)
          pending.reject(new Error(error || 'Worker error'))
        }
      }

      proofWorker.onerror = (error) => {
        console.error('[DustPoolV2] Proof worker error:', error)
        workerPromises.forEach((p) => p.reject(new Error('Worker crashed')))
        workerPromises.clear()
      }
    } catch {
      return null
    }
  }

  return proofWorker
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ── Calldata parsing ──────────────────────────────────────────────────────

/**
 * Extract the 768-byte proof from snarkjs FFLONK exportSolidityCallData.
 *
 * FFLONK format: `[0x<el0>, 0x<el1>, ..., 0x<el23>],[0x<sig0>, ...]`
 * Each element is 32 bytes (66 hex chars with 0x prefix).
 * We concatenate the first 24 elements into a single 768-byte hex string.
 */
function parseCalldataProofHex(calldata: string): string {
  const hexElements = calldata.match(/0x[0-9a-fA-F]+/g)
  if (!hexElements || hexElements.length < 24) {
    throw new Error(
      `Failed to parse FFLONK calldata — expected ≥24 hex elements, got ${hexElements?.length ?? 0}`
    )
  }
  // First 24 elements are the proof; remaining 8 are public signals
  return '0x' + hexElements.slice(0, 24).map((e) => e.slice(2)).join('')
}

// ── Circuit input formatting ──────────────────────────────────────────────

/**
 * Convert ProofInputs into the flat signal map that snarkjs expects.
 * All values must be decimal strings. Arrays use snarkjs 2D convention
 * where `signal[i][j]` becomes `signal[i]` as a string array.
 */
function formatCircuitInputs(
  inputs: ProofInputs
): Record<string, string | string[] | string[][]> {
  return {
    merkleRoot: inputs.merkleRoot.toString(),
    nullifier0: inputs.nullifier0.toString(),
    nullifier1: inputs.nullifier1.toString(),
    outputCommitment0: inputs.outputCommitment0.toString(),
    outputCommitment1: inputs.outputCommitment1.toString(),
    publicAmount: inputs.publicAmount.toString(),
    publicAsset: inputs.publicAsset.toString(),
    recipient: inputs.recipient.toString(),
    chainId: inputs.chainId.toString(),

    spendingKey: inputs.spendingKey.toString(),
    nullifierKey: inputs.nullifierKey.toString(),

    inOwner: inputs.inOwner.map(String),
    inAmount: inputs.inAmount.map(String),
    inAsset: inputs.inAsset.map(String),
    inChainId: inputs.inChainId.map(String),
    inBlinding: inputs.inBlinding.map(String),
    leafIndex: inputs.leafIndex.map(String),

    // 2D arrays: pathElements[2][TREE_DEPTH], pathIndices[2][TREE_DEPTH]
    pathElements: inputs.pathElements.map((arr) => arr.map(String)),
    pathIndices: inputs.pathIndices.map((arr) => arr.map(String)),

    outOwner: inputs.outOwner.map(String),
    outAmount: inputs.outAmount.map(String),
    outAsset: inputs.outAsset.map(String),
    outChainId: inputs.outChainId.map(String),
    outBlinding: inputs.outBlinding.map(String),
  }
}

// ── Proof generation ──────────────────────────────────────────────────────

/**
 * Generate an FFLONK proof using Web Worker (non-blocking) with main-thread fallback.
 */
export async function generateV2Proof(
  inputs: ProofInputs,
  onProgress?: (stage: string, progress: number) => void
): Promise<V2ProofResult> {
  const circuitInputs = formatCircuitInputs(inputs)
  const worker = getProofWorker()

  if (!worker) {
    return generateOnMainThread(circuitInputs, onProgress)
  }

  const id = generateId()

  return new Promise((resolve, reject) => {
    workerPromises.set(id, { resolve, reject, onProgress })

    const absoluteWasmPath = new URL(WASM_PATH, window.location.origin).href

    worker.postMessage({
      type: 'generate',
      id,
      data: { circuitInputs, zkeyPath: ZKEY_PATH, wasmPath: absoluteWasmPath },
    })

    setTimeout(() => {
      if (workerPromises.has(id)) {
        workerPromises.delete(id)
        // FC4: Terminate the stalled worker to stop burning CPU
        if (proofWorker) {
          proofWorker.terminate()
          proofWorker = null
        }
        reject(new Error('Proof generation timed out'))
      }
    }, PROOF_TIMEOUT_MS)
  })
}

async function generateOnMainThread(
  circuitInputs: Record<string, string | string[] | string[][]>,
  onProgress?: (stage: string, progress: number) => void
): Promise<V2ProofResult> {
  onProgress?.('Loading circuit...', 0.2)
  onProgress?.('Generating proof...', 0.4)

  const { fflonk } = await import('snarkjs')
  const { proof, publicSignals } = await fflonk.fullProve(
    circuitInputs,
    WASM_PATH,
    ZKEY_PATH
  )

  if (publicSignals.length !== 9) {
    throw new Error(
      `Proof generation produced ${publicSignals.length} public signals, expected 9`
    )
  }

  onProgress?.('Formatting calldata', 0.8)

  const calldata = await fflonk.exportSolidityCallData(publicSignals, proof)
  const proofCalldata = parseCalldataProofHex(calldata)

  onProgress?.('Proof generated', 1.0)

  return { proof, publicSignals, proofCalldata }
}

// ── Verification ──────────────────────────────────────────────────────────

/**
 * Verify an FFLONK proof locally using the verification key.
 * Used as a sanity check before submitting to the relayer.
 */
export async function verifyV2ProofLocally(
  proof: unknown,
  publicSignals: string[]
): Promise<boolean> {
  try {
    const vKeyResponse = await fetch(VKEY_PATH)
    const vKey = await vKeyResponse.json()
    const { fflonk } = await import('snarkjs')
    return await fflonk.verify(vKey, publicSignals, proof)
  } catch (error) {
    console.error('[DustPoolV2] Local verification failed:', error)
    return false
  }
}

// ── Cleanup ───────────────────────────────────────────────────────────────

/** Prefetch zkey + wasm into browser cache so proof generation is faster. */
export function prefetchProofAssets(): void {
  if (typeof window === 'undefined') return
  try {
    const link1 = document.createElement('link')
    link1.rel = 'prefetch'
    link1.href = ZKEY_PATH
    link1.as = 'fetch'
    link1.crossOrigin = 'anonymous'
    document.head.appendChild(link1)

    const link2 = document.createElement('link')
    link2.rel = 'prefetch'
    link2.href = WASM_PATH
    link2.as = 'fetch'
    document.head.appendChild(link2)
  } catch { /* noop */ }
}

export function terminateV2ProofWorker(): void {
  if (proofWorker) {
    proofWorker.terminate()
    proofWorker = null
  }
  // L7: Reject all pending promises so callers aren't left hanging
  if (workerPromises.size > 0) {
    const err = new Error('Proof worker terminated')
    workerPromises.forEach((p) => p.reject(err))
    workerPromises.clear()
  }
}
