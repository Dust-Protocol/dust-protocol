import { useState, useCallback, useRef, useMemo, useEffect, type RefObject } from 'react'
import { useAccount, useChainId, usePublicClient } from 'wagmi'
import { zeroAddress, type Address } from 'viem'
import { computeAssetId } from '@/lib/dustpool/v2/commitment'
import { buildWithdrawInputs, buildMergeInputs, buildSplitInputs } from '@/lib/dustpool/v2/proof-inputs'
import type { SplitOutputNote } from '@/lib/dustpool/v2/proof-inputs'
import {
  openV2Database, getUnspentNotes, markSpentAndSaveChange, markSpentAndSaveMultiple,
  markTwoSpentAndSaveOne, markNoteSpent, updateNoteLeafIndex,
  bigintToHex, hexToBigint, storedToNoteCommitment,
} from '@/lib/dustpool/v2/storage'
import type { StoredNoteV2 } from '@/lib/dustpool/v2/storage'
import type { NoteCommitmentV2 } from '@/lib/dustpool/v2/types'
import { createRelayerClient } from '@/lib/dustpool/v2/relayer-client'
import { generateV2Proof, verifyV2ProofLocally } from '@/lib/dustpool/v2/proof'
import { generateSplitProof, verifySplitProofLocally, pollForLeafIndex } from '@/lib/dustpool/v2/split-proof'
import { deriveStorageKey } from '@/lib/dustpool/v2/storage-crypto'
import { extractRelayerError } from '@/lib/dustpool/v2/errors'
import { ensureComplianceProved } from '@/lib/dustpool/v2/compliance-gate'
import { decomposeForSplit } from '@/lib/dustpool/v2/denominations'
import { resolveTokenSymbol, splitOutputToNoteCommitment } from '@/lib/dustpool/v2/split-utils'
import type { V2Keys } from '@/lib/dustpool/v2/types'

const RECEIPT_TIMEOUT_MS = 30_000

export type SmartWithdrawStatus =
  | 'idle'
  | 'selecting-notes'
  | 'proving-compliance'
  | 'merging'
  | 'waiting-merge-confirm'
  | 'splitting'
  | 'waiting-split-confirm'
  | 'withdrawing'
  | 'confirming'
  | 'saving'
  | 'done'
  | 'error'

export type SmartWithdrawStrategy =
  | 'direct'        // Single note covers amount, no split needed
  | 'split'         // Single note covers amount, split for denomination privacy
  | 'merge-direct'  // 2 notes merged, then direct withdraw
  | 'merge-split'   // 2 notes merged, then split withdraw

export function useV2SmartWithdraw(
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
  const [status, setStatus] = useState<SmartWithdrawStatus>('idle')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [strategy, setStrategy] = useState<SmartWithdrawStrategy | null>(null)
  const withdrawingRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const smartWithdraw = useCallback(async (
    amount: bigint,
    recipient: Address,
    asset: Address = zeroAddress
  ) => {
    if (!isConnected || !address) { setError('Wallet not connected'); return }
    const keys = keysRef.current
    if (!keys) { setError('Keys not available — verify PIN first'); return }
    if (withdrawingRef.current) return
    if (amount <= 0n) { setError('Amount must be positive'); return }

    withdrawingRef.current = true
    if (!mountedRef.current) { withdrawingRef.current = false; return }
    setIsPending(true)
    setError(null)
    setTxHash(null)
    setStrategy(null)
    setStatus('selecting-notes')
    setStatusMessage('Finding best notes...')

    try {
      const db = await openV2Database()
      const encKey = await deriveStorageKey(keys.spendingKey)
      const assetId = await computeAssetId(chainId, asset)
      const assetHex = bigintToHex(assetId)

      const storedNotes = await getUnspentNotes(db, address, chainId, encKey)
      const confirmed = storedNotes
        .filter(n => n.asset === assetHex && n.leafIndex >= 0)
        .sort((a, b) => {
          const diff = hexToBigint(a.amount) - hexToBigint(b.amount)
          if (diff < 0n) return -1
          if (diff > 0n) return 1
          return 0
        })

      // Strategy 1: Find a single note that covers the amount (best-fit)
      const singleNote = confirmed.find(n => hexToBigint(n.amount) >= amount)

      // Strategy 2: Find best 2-note combination that covers the amount
      let mergeCandidate: { note0: StoredNoteV2; note1: StoredNoteV2; total: bigint } | null = null
      if (!singleNote && confirmed.length >= 2) {
        let bestTotal = 0n
        for (let i = 0; i < confirmed.length; i++) {
          for (let j = i + 1; j < confirmed.length; j++) {
            const total = hexToBigint(confirmed[i].amount) + hexToBigint(confirmed[j].amount)
            if (total >= amount) {
              // Pick the pair with smallest total >= amount (tightest fit)
              if (!mergeCandidate || total < bestTotal) {
                mergeCandidate = { note0: confirmed[i], note1: confirmed[j], total }
                bestTotal = total
              }
            }
          }
        }
      }

      if (!singleNote && !mergeCandidate) {
        const totalBalance = confirmed.reduce((sum, n) => sum + hexToBigint(n.amount), 0n)
        if (totalBalance >= amount) {
          throw new Error(
            'Amount requires merging more than 2 notes, which is not yet supported. ' +
            'Try a smaller amount or merge notes manually first.'
          )
        }
        throw new Error('Insufficient shielded balance for this withdrawal')
      }

      if (!publicClient) throw new Error('Public client not available')
      const relayer = createRelayerClient()

      // Decide whether to use denomination split for privacy
      const tokenSymbol = resolveTokenSymbol(asset, chainId)
      const chunks = decomposeForSplit(amount, tokenSymbol)
      const useSplit = chunks.length > 1

      // ────────────────────────────────────────────────────────────────────
      // Path A: Single note (no merge needed)
      // ────────────────────────────────────────────────────────────────────
      if (singleNote) {
        const inputNote = storedToNoteCommitment(singleNote)

        setStatus('proving-compliance')
        setStatusMessage('Proving compliance...')
        await ensureComplianceProved(
          [{ commitment: inputNote.commitment, leafIndex: inputNote.leafIndex, complianceStatus: singleNote.complianceStatus }],
          keys.nullifierKey, chainId, publicClient,
        )

        if (useSplit) {
          if (!mountedRef.current) return
          setStrategy('split')
          await executeSplitWithdraw(
            inputNote, singleNote, chunks, amount, recipient, asset,
            keys, db, encKey, relayer, publicClient
          )
        } else {
          if (!mountedRef.current) return
          setStrategy('direct')
          await executeDirectWithdraw(
            inputNote, singleNote, amount, recipient, asset,
            keys, db, encKey, relayer, publicClient
          )
        }
        return
      }

      // ────────────────────────────────────────────────────────────────────
      // Path B: Merge two notes first
      // ────────────────────────────────────────────────────────────────────
      const { note0, note1 } = mergeCandidate!
      const inputNote0 = storedToNoteCommitment(note0)
      const inputNote1 = storedToNoteCommitment(note1)

      setStatus('proving-compliance')
      setStatusMessage('Proving compliance for 2 notes...')
      await ensureComplianceProved(
        [
          { commitment: inputNote0.commitment, leafIndex: inputNote0.leafIndex, complianceStatus: note0.complianceStatus },
          { commitment: inputNote1.commitment, leafIndex: inputNote1.leafIndex, complianceStatus: note1.complianceStatus },
        ],
        keys.nullifierKey, chainId, publicClient,
      )

      if (!mountedRef.current) return
      setStatus('merging')
      setStatusMessage('Merging 2 notes into 1...')

      // Generate merge proof (2-in-2-out, both inputs real, output = combined note)
      const generateAndSubmitMerge = async (isRetry: boolean) => {
        if (isRetry) {
          setStatusMessage('Tree updated. Retrying merge with fresh state...')
        }
        const [proof0, proof1] = await Promise.all([
          relayer.getMerkleProof(inputNote0.leafIndex, chainId),
          relayer.getMerkleProof(inputNote1.leafIndex, chainId),
        ])
        const proofInputs = await buildMergeInputs(
          inputNote0, inputNote1, keys, proof0, proof1, chainId
        )
        const { proof, publicSignals, proofCalldata } = await generateV2Proof(proofInputs)
        const isValid = await verifyV2ProofLocally(proof, publicSignals)
        if (!isValid) throw new Error('Merge proof failed local verification')

        setStatusMessage('Submitting merge to relayer...')
        // Merge is an internal transfer (publicAmount=0) — use transfer endpoint
        const result = await relayer.submitTransfer(proofCalldata, publicSignals, chainId)
        return { proofInputs, result }
      }

      let mergeSubmission: Awaited<ReturnType<typeof generateAndSubmitMerge>>
      try {
        mergeSubmission = await generateAndSubmitMerge(false)
      } catch (submitErr) {
        const errMsg = submitErr instanceof Error ? submitErr.message : ''
        const errBody = (submitErr as { body?: string }).body ?? ''
        const combined = `${errMsg} ${errBody}`.toLowerCase()
        if (combined.includes('unknown merkle root') || combined.includes('unknown root') || combined.includes('invalid or expired merkle root')) {
          mergeSubmission = await generateAndSubmitMerge(true)
        } else {
          throw submitErr
        }
      }

      if (!mountedRef.current) return
      setStatus('waiting-merge-confirm')
      setStatusMessage('Confirming merge on-chain...')

      const mergeReceipt = await publicClient.waitForTransactionReceipt({
        hash: mergeSubmission.result.txHash as `0x${string}`,
        timeout: RECEIPT_TIMEOUT_MS,
      })
      if (mergeReceipt.status === 'reverted') {
        throw new Error(`Merge transaction reverted (tx: ${mergeSubmission.result.txHash})`)
      }

      // Save merged note, mark both inputs as spent
      const mergedCommitmentHex = bigintToHex(mergeSubmission.proofInputs.outputCommitment0)
      const mergedStored: StoredNoteV2 = {
        id: mergedCommitmentHex,
        walletAddress: address.toLowerCase(),
        chainId,
        commitment: mergedCommitmentHex,
        owner: bigintToHex(mergeSubmission.proofInputs.outOwner[0]),
        amount: bigintToHex(mergeSubmission.proofInputs.outAmount[0]),
        asset: bigintToHex(mergeSubmission.proofInputs.outAsset[0]),
        blinding: bigintToHex(mergeSubmission.proofInputs.outBlinding[0]),
        leafIndex: -1,
        spent: false,
        createdAt: Date.now(),
        complianceStatus: 'inherited',
      }
      await markTwoSpentAndSaveOne(db, note0.id, note1.id, mergedStored, encKey)
      backupSpent?.(note0.id).catch(() => {})
      backupSpent?.(note1.id).catch(() => {})
      backupNote?.(mergedStored).catch(() => {})

      // Wait for merged note to get a leaf index
      setStatusMessage('Waiting for merged note confirmation...')
      const mergedLeafIndex = await pollForLeafIndex(relayer, mergedCommitmentHex, chainId)
      await updateNoteLeafIndex(db, mergedCommitmentHex, mergedLeafIndex)

      const mergedNote: NoteCommitmentV2 = {
        note: {
          owner: hexToBigint(mergedStored.owner),
          amount: hexToBigint(mergedStored.amount),
          asset: hexToBigint(mergedStored.asset),
          chainId,
          blinding: hexToBigint(mergedStored.blinding),
        },
        commitment: hexToBigint(mergedStored.commitment),
        leafIndex: mergedLeafIndex,
        spent: false,
        createdAt: mergedStored.createdAt,
      }

      // Compliance for the merged note
      setStatus('proving-compliance')
      setStatusMessage('Proving compliance for merged note...')
      await ensureComplianceProved(
        [{ commitment: mergedNote.commitment, leafIndex: mergedNote.leafIndex }],
        keys.nullifierKey, chainId, publicClient,
      )

      if (!mountedRef.current) return

      if (useSplit) {
        setStrategy('merge-split')
        await executeSplitWithdraw(
          mergedNote, { ...mergedStored, leafIndex: mergedLeafIndex }, chunks, amount, recipient, asset,
          keys, db, encKey, relayer, publicClient
        )
      } else {
        setStrategy('merge-direct')
        await executeDirectWithdraw(
          mergedNote, { ...mergedStored, leafIndex: mergedLeafIndex }, amount, recipient, asset,
          keys, db, encKey, relayer, publicClient
        )
      }
    } catch (e) {
      if (mountedRef.current) {
        setStatus('error')
        setError(extractRelayerError(e, 'Smart withdrawal failed'))
      }
    } finally {
      if (mountedRef.current) {
        setIsPending(false)
        setStatusMessage(null)
      }
      withdrawingRef.current = false
    }
  }, [isConnected, address, chainId, publicClient])

  // ── Direct withdraw (single proof, no denomination split) ─────────────
  async function executeDirectWithdraw(
    inputNote: NoteCommitmentV2,
    inputStored: StoredNoteV2,
    amount: bigint,
    recipient: Address,
    asset: Address,
    keys: V2Keys,
    db: IDBDatabase,
    encKey: CryptoKey,
    relayer: ReturnType<typeof createRelayerClient>,
    client: NonNullable<typeof publicClient>,
  ) {
    setStatus('withdrawing')
    setStatusMessage('Generating withdrawal proof...')

    const generateAndSubmit = async (isRetry: boolean) => {
      if (isRetry) setStatusMessage('Tree updated. Retrying withdrawal...')
      const merkleProof = await relayer.getMerkleProof(inputNote.leafIndex, chainId)
      const proofInputs = await buildWithdrawInputs(inputNote, amount, recipient, keys, merkleProof, chainId)
      const { proof, publicSignals, proofCalldata } = await generateV2Proof(proofInputs)
      const isValid = await verifyV2ProofLocally(proof, publicSignals)
      if (!isValid) throw new Error('Withdrawal proof failed local verification')
      setStatusMessage('Submitting withdrawal...')
      return { proofInputs, result: await relayer.submitWithdrawal(proofCalldata, publicSignals, chainId, asset) }
    }

    let submission: Awaited<ReturnType<typeof generateAndSubmit>>
    try {
      submission = await generateAndSubmit(false)
    } catch (submitErr) {
      const errMsg = submitErr instanceof Error ? submitErr.message : ''
      const errBody = (submitErr as { body?: string }).body ?? ''
      const combined = `${errMsg} ${errBody}`.toLowerCase()
      if (combined.includes('unknown merkle root') || combined.includes('unknown root') || combined.includes('invalid or expired merkle root')) {
        submission = await generateAndSubmit(true)
      } else {
        throw submitErr
      }
    }

    if (!mountedRef.current) return
    setTxHash(submission.result.txHash)
    setStatus('confirming')
    setStatusMessage('Confirming on-chain...')

    const receipt = await client.waitForTransactionReceipt({
      hash: submission.result.txHash as `0x${string}`,
      timeout: RECEIPT_TIMEOUT_MS,
    })
    if (receipt.status === 'reverted') {
      throw new Error(`Withdrawal reverted (tx: ${submission.result.txHash})`)
    }

    if (!mountedRef.current) return
    setStatus('saving')
    setStatusMessage('Saving changes...')

    const changeAmount = inputNote.note.amount - amount
    let changeStored: StoredNoteV2 | undefined
    if (changeAmount > 0n) {
      const changeHex = bigintToHex(submission.proofInputs.outputCommitment0)
      changeStored = {
        id: changeHex,
        walletAddress: address!.toLowerCase(),
        chainId,
        commitment: changeHex,
        owner: bigintToHex(submission.proofInputs.outOwner[0]),
        amount: bigintToHex(submission.proofInputs.outAmount[0]),
        asset: bigintToHex(submission.proofInputs.outAsset[0]),
        blinding: bigintToHex(submission.proofInputs.outBlinding[0]),
        leafIndex: -1,
        spent: false,
        createdAt: Date.now(),
        complianceStatus: 'inherited',
      }
    }
    await markSpentAndSaveChange(db, inputStored.id, changeStored, encKey)
    backupSpent?.(inputStored.id).catch(() => {})
    if (changeStored) backupNote?.(changeStored).catch(() => {})

    if (mountedRef.current) {
      setStatus('done')
      setStatusMessage(null)
    }
  }

  // ── Split withdraw (denomination privacy) ─────────────────────────────
  async function executeSplitWithdraw(
    inputNote: NoteCommitmentV2,
    inputStored: StoredNoteV2,
    chunks: bigint[],
    amount: bigint,
    recipient: Address,
    asset: Address,
    keys: V2Keys,
    db: IDBDatabase,
    encKey: CryptoKey,
    relayer: ReturnType<typeof createRelayerClient>,
    client: NonNullable<typeof publicClient>,
  ) {
    // Phase 1: Internal split
    setStatus('splitting')
    setStatusMessage(`Splitting into ${chunks.length} denomination chunks...`)

    const generateAndSubmitSplit = async (isRetry: boolean) => {
      if (isRetry) setStatusMessage('Tree updated. Retrying split...')
      const merkleProof = await relayer.getMerkleProof(inputNote.leafIndex, chainId)
      const splitResult = await buildSplitInputs(inputNote, chunks, keys, merkleProof, chainId)
      const { proof, publicSignals, proofCalldata } = await generateSplitProof(splitResult.circuitInputs)
      const isValid = await verifySplitProofLocally(proof, publicSignals)
      if (!isValid) throw new Error('Split proof failed local verification')
      setStatusMessage('Submitting split...')
      return {
        splitResult,
        result: await relayer.submitSplitWithdrawal(proofCalldata, publicSignals, chainId, asset),
      }
    }

    let splitSubmission: Awaited<ReturnType<typeof generateAndSubmitSplit>>
    try {
      splitSubmission = await generateAndSubmitSplit(false)
    } catch (submitErr) {
      const errMsg = submitErr instanceof Error ? submitErr.message : ''
      const errBody = (submitErr as { body?: string }).body ?? ''
      const combined = `${errMsg} ${errBody}`.toLowerCase()
      if (combined.includes('unknown merkle root') || combined.includes('unknown root') || combined.includes('invalid or expired merkle root')) {
        splitSubmission = await generateAndSubmitSplit(true)
      } else {
        throw submitErr
      }
    }

    if (!mountedRef.current) return
    setStatus('waiting-split-confirm')
    setStatusMessage('Confirming split on-chain...')

    const splitReceipt = await client.waitForTransactionReceipt({
      hash: splitSubmission.result.txHash as `0x${string}`,
      timeout: RECEIPT_TIMEOUT_MS,
    })
    if (splitReceipt.status === 'reverted') {
      throw new Error(`Split transaction reverted (tx: ${splitSubmission.result.txHash})`)
    }

    // Save split output notes atomically
    const now = Date.now()
    const outputStored: StoredNoteV2[] = splitSubmission.splitResult.outputNotes.map(out => ({
      id: bigintToHex(out.commitment),
      walletAddress: address!.toLowerCase(),
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

    // Wait for leaf indices
    const denomNotes = splitSubmission.splitResult.outputNotes.slice(0, chunks.length)
    const hasChange = splitSubmission.splitResult.outputNotes.length > chunks.length

    setStatusMessage('Waiting for split note confirmation...')
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

    // Compliance for denomination notes
    setStatus('proving-compliance')
    setStatusMessage('Proving denomination compliance...')
    await ensureComplianceProved(
      denomNotes.map((note, i) => ({
        commitment: note.commitment,
        leafIndex: denomLeafIndices[i],
      })),
      keys.nullifierKey, chainId, client,
    )

    // Phase 2: Batch withdraw each denomination note
    if (!mountedRef.current) return
    setStatus('withdrawing')
    const withdrawalProofs: Array<{ proof: string; publicSignals: string[]; tokenAddress: string }> = []

    for (let i = 0; i < denomNotes.length; i++) {
      if (!mountedRef.current) return
      setStatusMessage(`Generating withdrawal proof ${i + 1}/${denomNotes.length}...`)

      const noteCommitment = splitOutputToNoteCommitment(denomNotes[i], denomLeafIndices[i], chainId)
      const merkleProof = await relayer.getMerkleProof(denomLeafIndices[i], chainId)
      const proofInputs = await buildWithdrawInputs(
        noteCommitment, noteCommitment.note.amount, recipient, keys, merkleProof, chainId
      )
      const proofResult = await generateV2Proof(proofInputs)
      const isValid = await verifyV2ProofLocally(proofResult.proof, proofResult.publicSignals)
      if (!isValid) throw new Error(`Withdrawal proof ${i + 1} failed local verification`)

      withdrawalProofs.push({
        proof: proofResult.proofCalldata,
        publicSignals: proofResult.publicSignals,
        tokenAddress: asset,
      })
    }

    setStatusMessage(`Submitting batch withdrawal (${denomNotes.length} chunks)...`)
    const batchResult = await relayer.submitBatchWithdrawal(withdrawalProofs, chainId)

    if (batchResult.succeeded > 0 && batchResult.results.length > 0) {
      setTxHash(batchResult.results[0].txHash)
    }

    // Mark withdrawn notes as spent
    const failedIndices = new Set(batchResult.errors.map(e => e.index))
    for (let i = 0; i < denomNotes.length; i++) {
      if (!failedIndices.has(i)) {
        await markNoteSpent(db, bigintToHex(denomNotes[i].commitment))
        backupSpent?.(bigintToHex(denomNotes[i].commitment)).catch(() => {})
      }
    }

    if (batchResult.errors.length > 0) {
      throw new Error(
        `${batchResult.succeeded}/${batchResult.total} withdrawals succeeded. ` +
        `${batchResult.errors.length} failed — denomination notes remain in pool for retry.`
      )
    }

    if (mountedRef.current) {
      setStatus('done')
      setStatusMessage(null)
    }
  }

  const clearError = useCallback(() => {
    setError(null)
    setTxHash(null)
    setStatus('idle')
    setStatusMessage(null)
    setStrategy(null)
  }, [])

  return useMemo(
    () => ({ smartWithdraw, isPending, status, statusMessage, txHash, error, strategy, clearError }),
    [smartWithdraw, isPending, status, statusMessage, txHash, error, strategy, clearError]
  )
}
