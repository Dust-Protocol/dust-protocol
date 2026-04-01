import { useState, useCallback, useRef, useMemo, useEffect, type RefObject } from 'react'
import { useAccount, useChainId, usePublicClient } from 'wagmi'
import { zeroAddress, type Address } from 'viem'
import { computeAssetId, computeOwnerPubKey, poseidonHash } from '@/lib/dustpool/v2/commitment'
import { buildSplitInputs } from '@/lib/dustpool/v2/proof-inputs'
import { buildSwapInputs } from '@/lib/dustpool/v2/proof-inputs'
import {
  openV2Database, getUnspentNotes, markSpentAndSaveMultiple, markNoteSpent,
  saveNoteV2, updateNoteLeafIndex, bigintToHex, hexToBigint, storedToNoteCommitment,
} from '@/lib/dustpool/v2/storage'
import type { StoredNoteV2 } from '@/lib/dustpool/v2/storage'
import { generateBlinding } from '@/lib/dustpool/v2/note'
import { createRelayerClient } from '@/lib/dustpool/v2/relayer-client'
import { generateV2Proof, verifyV2ProofLocally } from '@/lib/dustpool/v2/proof'
import { deriveStorageKey } from '@/lib/dustpool/v2/storage-crypto'
import { extractRelayerError } from '@/lib/dustpool/v2/errors'
import { ensureComplianceProved } from '@/lib/dustpool/v2/compliance-gate'
import { decomposeForSplit } from '@/lib/dustpool/v2/denominations'
import { resolveTokenSymbol, splitOutputToNoteCommitment } from '@/lib/dustpool/v2/split-utils'
import { generateSplitProof, verifySplitProofLocally, pollForLeafIndex } from '@/lib/dustpool/v2/split-proof'
import { getChainConfig } from '@/config/chains'
import type { V2Keys } from '@/lib/dustpool/v2/types'

const RECEIPT_TIMEOUT_MS = 30_000
const MAX_SPLIT_OUTPUTS = 8

export type DenomSwapStatus =
  | 'idle'
  | 'decomposing'
  | 'proving-compliance'
  | 'splitting'
  | 'confirming-split'
  | 'polling-leaves'
  | 'proving-denom-compliance'
  | 'generating-swap-proofs'
  | 'submitting-swaps'
  | 'confirming-swaps'
  | 'saving-notes'
  | 'done'
  | 'error'

export interface DenomSwapProgress {
  current: number
  total: number
}

export function useV2DenomSwap(
  keysRef: RefObject<V2Keys | null>,
  chainIdOverride?: number,
  backupNote?: (note: StoredNoteV2) => Promise<void>,
  backupSpent?: (commitment: string) => Promise<void>,
) {
  const { address, isConnected } = useAccount()
  const wagmiChainId = useChainId()
  const chainId = chainIdOverride ?? wagmiChainId
  const publicClient = usePublicClient({ chainId })

  const [isPending, setIsPending] = useState(false)
  const [status, setStatus] = useState<DenomSwapStatus>('idle')
  const [progress, setProgress] = useState<DenomSwapProgress>({ current: 0, total: 0 })
  const [txHashes, setTxHashes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const swappingRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const denomSwap = useCallback(async (
    amountIn: bigint,
    tokenIn: Address,
    tokenOut: Address,
    minAmountOut: bigint,
    slippageBps: number,
    relayerFeeBps?: number,
  ) => {
    if (!isConnected || !address) { setError('Wallet not connected'); return }
    const keys = keysRef.current
    if (!keys) { setError('Keys not available — verify PIN first'); return }
    if (swappingRef.current) return
    if (amountIn <= 0n) { setError('Amount must be positive'); return }

    const adapterAddress = getChainConfig(chainId).contracts.dustSwapAdapterV2
    if (!adapterAddress) { setError(`DustSwap V2 not deployed on chain ${chainId}`); return }

    swappingRef.current = true
    setIsPending(true)
    setError(null)
    setTxHashes([])
    setStatus('decomposing')
    setProgress({ current: 0, total: 0 })

    try {
      // ── Step 1: Decompose into denomination chunks ────────────────────
      const tokenSymbol = resolveTokenSymbol(tokenIn, chainId)
      const chunks = decomposeForSplit(amountIn, tokenSymbol, 7)

      if (chunks.length === 0) {
        throw new Error('Amount too small to decompose into denominations')
      }
      if (chunks.length > MAX_SPLIT_OUTPUTS) {
        throw new Error(
          `Amount decomposes into ${chunks.length} chunks, exceeding the ${MAX_SPLIT_OUTPUTS}-output circuit limit`
        )
      }

      const totalSteps = chunks.length
      setProgress({ current: 0, total: totalSteps })

      const db = await openV2Database()
      const encKey = await deriveStorageKey(keys.spendingKey)
      const assetId = await computeAssetId(chainId, tokenIn)
      const assetHex = bigintToHex(assetId)

      const storedNotes = await getUnspentNotes(db, address, chainId, encKey)
      const eligible = storedNotes
        .filter(n => n.asset === assetHex && hexToBigint(n.amount) >= amountIn && n.leafIndex >= 0)
        .sort((a, b) => {
          const diff = hexToBigint(a.amount) - hexToBigint(b.amount)
          if (diff < 0n) return -1
          if (diff > 0n) return 1
          return 0
        })

      if (eligible.length === 0) {
        throw new Error('No note with sufficient balance for this denomination swap')
      }

      const inputStored = eligible[0]
      const inputNote = storedToNoteCommitment(inputStored)

      // Compliance gate: prove input note is not from a sanctioned source
      if (!publicClient) throw new Error('Public client not available')
      setStatus('proving-compliance')
      await ensureComplianceProved(
        [{ commitment: inputNote.commitment, leafIndex: inputNote.leafIndex, complianceStatus: inputStored.complianceStatus }],
        keys.nullifierKey,
        chainId,
        publicClient,
      )

      const relayer = createRelayerClient()

      // ── Step 2: Split — break note into denomination-sized notes ───────
      setStatus('splitting')

      const generateAndSubmitSplit = async (isRetry: boolean) => {
        if (isRetry) {
          setStatus('splitting')
        }

        const merkleProof = await relayer.getMerkleProof(inputNote.leafIndex, chainId)
        const splitResult = await buildSplitInputs(
          inputNote, chunks, keys, merkleProof, chainId
        )

        const { proof, publicSignals, proofCalldata } = await generateSplitProof(
          splitResult.circuitInputs
        )

        const isValid = await verifySplitProofLocally(proof, publicSignals)
        if (!isValid) {
          throw new Error('Split proof failed local verification')
        }

        return {
          splitResult,
          result: await relayer.submitSplitWithdrawal(proofCalldata, publicSignals, chainId, tokenIn),
        }
      }

      let splitSubmission: Awaited<ReturnType<typeof generateAndSubmitSplit>>
      try {
        splitSubmission = await generateAndSubmitSplit(false)
      } catch (submitErr) {
        const errMsg = submitErr instanceof Error ? submitErr.message : ''
        const errBody = (submitErr as { body?: string }).body ?? ''
        const combined = `${errMsg} ${errBody}`.toLowerCase()
        if (combined.includes('unknown merkle root') || combined.includes('unknown root')) {
          splitSubmission = await generateAndSubmitSplit(true)
        } else {
          throw submitErr
        }
      }

      // ── Step 3: Confirm split on-chain + save split output notes ──────
      setStatus('confirming-split')

      if (!publicClient) {
        throw new Error('Public client not available — cannot verify transaction')
      }
      const splitReceipt = await publicClient.waitForTransactionReceipt({
        hash: splitSubmission.result.txHash as `0x${string}`,
        timeout: RECEIPT_TIMEOUT_MS,
      })
      if (splitReceipt.status === 'reverted') {
        throw new Error(`Split transaction reverted (tx: ${splitSubmission.result.txHash})`)
      }

      const now = Date.now()
      const outputStored: StoredNoteV2[] = splitSubmission.splitResult.outputNotes.map(out => ({
        id: bigintToHex(out.commitment),
        walletAddress: address.toLowerCase(),
        chainId,
        commitment: bigintToHex(out.commitment),
        owner: bigintToHex(out.owner),
        amount: bigintToHex(out.amount),
        asset: bigintToHex(out.asset),
        blinding: bigintToHex(out.blinding),
        leafIndex: -1,
        spent: false,
        createdAt: now,
        complianceStatus: 'inherited' as const,
      }))
      await markSpentAndSaveMultiple(db, inputStored.id, outputStored, encKey)
      backupSpent?.(inputStored.id).catch(() => {})
      for (const out of outputStored) { backupNote?.(out).catch(() => {}) }

      const denomNotes = splitSubmission.splitResult.outputNotes.slice(0, chunks.length)
      const hasChange = splitSubmission.splitResult.outputNotes.length > chunks.length

      // ── Step 4: Poll for leaf indices ─────────────────────────────────
      setStatus('polling-leaves')

      const denomLeafIndices: number[] = []
      for (const note of denomNotes) {
        const hex = bigintToHex(note.commitment)
        const leafIndex = await pollForLeafIndex(relayer, hex, chainId)
        denomLeafIndices.push(leafIndex)
        await updateNoteLeafIndex(db, hex, leafIndex)
      }

      if (hasChange) {
        const changeNote = splitSubmission.splitResult.outputNotes[chunks.length]
        const changeHex = bigintToHex(changeNote.commitment)
        const changeLeaf = await pollForLeafIndex(relayer, changeHex, chainId)
        await updateNoteLeafIndex(db, changeHex, changeLeaf)
      }

      // ── Step 4b: Compliance gate for denomination notes before swaps ──
      setStatus('proving-denom-compliance')
      await ensureComplianceProved(
        denomNotes.map((note, i) => ({
          commitment: note.commitment,
          leafIndex: denomLeafIndices[i],
        })),
        keys.nullifierKey,
        chainId,
        publicClient,
      )

      // ── Step 5: Generate swap proofs for each denomination note ────────
      setStatus('generating-swap-proofs')

      const ownerPubKey = await computeOwnerPubKey(keys.spendingKey)
      const feeBps = relayerFeeBps ?? 200

      const swaps: Array<{
        proof: string
        publicSignals: string[]
        tokenIn: string
        tokenOut: string
        ownerPubKey: string
        blinding: string
        relayerFeeBps: number
        minAmountOut: string
        denomNoteIndex: number
      }> = []

      for (let i = 0; i < denomNotes.length; i++) {
        setProgress({ current: i + 1, total: totalSteps })

        const noteCommitment = splitOutputToNoteCommitment(
          denomNotes[i], denomLeafIndices[i], chainId
        )
        const merkleProof = await relayer.getMerkleProof(denomLeafIndices[i], chainId)
        const proofInputs = await buildSwapInputs(
          noteCommitment, noteCommitment.note.amount, adapterAddress, keys, merkleProof, chainId
        )

        const proofResult = await generateV2Proof(proofInputs)
        const isValid = await verifyV2ProofLocally(proofResult.proof, proofResult.publicSignals)
        if (!isValid) {
          throw new Error(`Swap proof ${i + 1}/${denomNotes.length} failed local verification`)
        }

        const blinding = generateBlinding()
        // Proportional minAmountOut: minAmountOut already has slippage applied by caller
        const chunkMinOut = (minAmountOut * chunks[i]) / amountIn
        const finalMinOut = chunkMinOut > 0n ? chunkMinOut : 1n

        swaps.push({
          proof: proofResult.proofCalldata,
          publicSignals: proofResult.publicSignals,
          tokenIn,
          tokenOut,
          ownerPubKey: ownerPubKey.toString(),
          blinding: blinding.toString(),
          relayerFeeBps: feeBps,
          minAmountOut: finalMinOut.toString(),
          denomNoteIndex: i,
        })
      }

      // ── Step 6: Submit batch swap ─────────────────────────────────────
      setStatus('submitting-swaps')

      // Chains with Uniswap V4 use batch-swap; others (PunchSwap/V2 router) use swap-generic
      const chainConfig = getChainConfig(chainId)
      const hasV4Pool = !!chainConfig.contracts.dustSwapVanillaPoolKey
      const swapPayloads = swaps.map(({ denomNoteIndex: _, ...rest }) => rest)
      const batchResult = hasV4Pool
        ? await relayer.submitBatchSwap(swapPayloads, chainId)
        : await relayer.submitBatchSwapGeneric(swapPayloads, chainId)

      const hashes = batchResult.results.map(r => r.txHash)
      if (mountedRef.current) setTxHashes(hashes)

      // ── Step 6b: Verify batch swap receipts on-chain ────────────────
      if (mountedRef.current) setStatus('confirming-swaps')
      for (const result of batchResult.results) {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: result.txHash as `0x${string}`,
          timeout: RECEIPT_TIMEOUT_MS,
        })
        if (receipt.status === 'reverted') {
          console.error(`[V2/denom-swap] Swap tx reverted: ${result.txHash}`)
        }
      }

      // ── Step 7: Verify and save output notes ──────────────────────────
      if (!mountedRef.current) return
      setStatus('saving-notes')

      const outputAssetId = await computeAssetId(chainId, tokenOut)
      const failedSwapIndices = new Set(batchResult.errors.map(e => e.index))

      for (let i = 0; i < batchResult.results.length; i++) {
        const result = batchResult.results[i]
        setProgress({ current: i + 1, total: totalSteps })

        if (result.outputCommitment && result.outputAmount) {
          const swapBlinding = BigInt(swaps[i].blinding)

          // Sanity-check: recompute commitment client-side and warn on mismatch.
          // Save regardless — the on-chain event is authoritative and skipping
          // would permanently lose the user's funds.
          try {
            const expectedCommitment = await poseidonHash([
              ownerPubKey,
              BigInt(result.outputAmount),
              outputAssetId,
              BigInt(chainId),
              swapBlinding,
            ])
            if (expectedCommitment !== BigInt(result.outputCommitment)) {
              console.warn(
                `[V2/denom-swap] Output commitment mismatch for chunk ${i + 1}:`,
                `expected=${expectedCommitment}, got=${BigInt(result.outputCommitment)}`,
                `— saving anyway (on-chain event is authoritative)`
              )
            }
          } catch (verifyErr) {
            console.warn(`[V2/denom-swap] Commitment verification failed for chunk ${i + 1}:`, verifyErr)
          }

          const outputCommitmentHex = bigintToHex(BigInt(result.outputCommitment))
          const outputStoredNote: StoredNoteV2 = {
            id: outputCommitmentHex,
            walletAddress: address.toLowerCase(),
            complianceStatus: 'unverified',
            chainId,
            commitment: outputCommitmentHex,
            owner: bigintToHex(ownerPubKey),
            amount: bigintToHex(BigInt(result.outputAmount)),
            asset: bigintToHex(outputAssetId),
            blinding: bigintToHex(swapBlinding),
            leafIndex: result.queueIndex ?? -1,
            spent: false,
            createdAt: Date.now(),
          }
          await saveNoteV2(db, address, outputStoredNote, encKey)
          backupNote?.(outputStoredNote).catch(() => {})
        }
      }

      // Mark successfully swapped denomination notes as spent
      for (let i = 0; i < denomNotes.length; i++) {
        if (!failedSwapIndices.has(i)) {
          await markNoteSpent(db, bigintToHex(denomNotes[i].commitment))
          backupSpent?.(bigintToHex(denomNotes[i].commitment)).catch(() => {})
        }
      }

      if (mountedRef.current) {
        if (batchResult.errors.length > 0) {
          const failedCount = batchResult.errors.length
          setStatus('error')
          setError(
            `${batchResult.succeeded}/${batchResult.total} swaps succeeded. ` +
            `${failedCount} failed — denomination notes remain in pool for retry.`
          )
        } else {
          setStatus('done')
        }
      }
    } catch (e) {
      if (mountedRef.current) {
        setStatus('error')
        setError(extractRelayerError(e, 'Denomination swap failed'))
      }
    } finally {
      if (mountedRef.current) setIsPending(false)
      swappingRef.current = false
    }
  }, [isConnected, address, chainId, publicClient])

  const clearError = useCallback(() => {
    setError(null)
    setTxHashes([])
    setStatus('idle')
    setProgress({ current: 0, total: 0 })
  }, [])

  return useMemo(
    () => ({ denomSwap, isPending, status, progress, txHashes, error, clearError }),
    [denomSwap, isPending, status, progress, txHashes, error, clearError]
  )
}
