import { useState, useCallback, useRef, useMemo, useEffect, type RefObject } from 'react'
import { useAccount, useChainId, usePublicClient } from 'wagmi'
import type { Address } from 'viem'
import { computeAssetId, computeOwnerPubKey, poseidonHash } from '@/lib/dustpool/v2/commitment'
import { buildSwapInputs } from '@/lib/dustpool/v2/proof-inputs'
import {
  openV2Database, getUnspentNotes, markSpentAndSaveChange, saveNoteV2,
  bigintToHex, hexToBigint, storedToNoteCommitment,
} from '@/lib/dustpool/v2/storage'
import type { StoredNoteV2 } from '@/lib/dustpool/v2/storage'
import { generateBlinding } from '@/lib/dustpool/v2/note'
import { createRelayerClient } from '@/lib/dustpool/v2/relayer-client'
import { generateV2Proof, verifyV2ProofLocally } from '@/lib/dustpool/v2/proof'
import { deriveStorageKey } from '@/lib/dustpool/v2/storage-crypto'
import { extractRelayerError } from '@/lib/dustpool/v2/errors'
import { ensureComplianceProved } from '@/lib/dustpool/v2/compliance-gate'
import { getChainConfig } from '@/config/chains'
import { isGenericSwapAdapter } from '@/lib/swap/contracts'
import type { V2Keys } from '@/lib/dustpool/v2/types'

const RECEIPT_TIMEOUT_MS = 30_000

interface SwapRelayerResponse {
  txHash: string
  outputCommitment: string
  outputAmount: string
  queueIndex: number | null
  blockNumber: number
}

export type SwapStatus =
  | 'idle'
  | 'selecting-note'
  | 'proving-compliance'
  | 'generating-proof'
  | 'submitting'
  | 'confirming'
  | 'saving-note'
  | 'done'
  | 'error'

export function useV2Swap(
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
  const [status, setStatus] = useState<SwapStatus>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [outputNote, setOutputNote] = useState<StoredNoteV2 | null>(null)
  const swappingRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const swap = useCallback(async (
    amountIn: bigint,
    tokenIn: Address,
    tokenOut: Address,
    minAmountOut: bigint,
    relayerFeeBps?: number
  ) => {
    if (!isConnected || !address) { setError('Wallet not connected'); return }
    const keys = keysRef.current
    if (!keys) { setError('Keys not available — verify PIN first'); return }
    if (swappingRef.current) return
    if (amountIn <= 0n) { setError('Amount must be positive'); return }

    const adapterAddress = getChainConfig(chainId).contracts.dustSwapAdapterV2
    if (!adapterAddress) { setError(`DustSwap V2 not deployed on chain ${chainId}`); return }

    swappingRef.current = true
    if (!mountedRef.current) { swappingRef.current = false; return }
    setIsPending(true)
    setError(null)
    setTxHash(null)
    setOutputNote(null)
    setStatus('selecting-note')

    try {
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
        throw new Error('No note with sufficient balance for this swap')
      }

      const inputStored = eligible[0]
      const inputNote = storedToNoteCommitment(inputStored)

      // Compliance gate: prove note is not from a sanctioned source
      if (!publicClient) throw new Error('Public client not available')
      setStatus('proving-compliance')
      await ensureComplianceProved(
        [{ commitment: inputNote.commitment, leafIndex: inputNote.leafIndex, complianceStatus: inputStored.complianceStatus }],
        keys.nullifierKey,
        chainId,
        publicClient,
      )

      const relayer = createRelayerClient()

      setStatus('generating-proof')

      const generateAndSubmit = async (isRetry: boolean) => {
        if (isRetry) {
          setStatus('generating-proof')
        }

        const merkleProof = await relayer.getMerkleProof(inputNote.leafIndex, chainId)
        const proofInputs = await buildSwapInputs(
          inputNote, amountIn, adapterAddress, keys, merkleProof, chainId
        )

        const { proof, publicSignals, proofCalldata } = await generateV2Proof(proofInputs)

        const isValid = await verifyV2ProofLocally(proof, publicSignals)
        if (!isValid) {
          throw new Error('Generated proof failed local verification')
        }

        setStatus('submitting')

        const ownerPubKey = await computeOwnerPubKey(keys.spendingKey)
        const blinding = generateBlinding()

        const isGeneric = isGenericSwapAdapter(chainId)
        const swapEndpoint = isGeneric ? '/api/v2/swap-generic' : '/api/v2/swap'

        const requestBody: Record<string, unknown> = {
          proof: proofCalldata,
          publicSignals,
          targetChainId: chainId,
          tokenIn,
          tokenOut,
          ownerPubKey: ownerPubKey.toString(),
          blinding: blinding.toString(),
          relayerFeeBps: relayerFeeBps ?? 200,
          minAmountOut: minAmountOut.toString(),
        }

        if (isGeneric) {
          requestBody.router = getChainConfig(chainId).contracts.dustSwapRouter
        }

        const response = await fetch(swapEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          const err = new Error(`Swap relayer request failed: ${response.status}`) as Error & { body?: string }
          err.body = body
          throw err
        }

        const result = await response.json() as SwapRelayerResponse

        return { proofInputs, result, ownerPubKey, blinding }
      }

      let submission: Awaited<ReturnType<typeof generateAndSubmit>>
      try {
        submission = await generateAndSubmit(false)
      } catch (submitErr) {
        const errMsg = submitErr instanceof Error ? submitErr.message : ''
        const errBody = (submitErr as { body?: string }).body ?? ''
        const combined = `${errMsg} ${errBody}`.toLowerCase()
        if (combined.includes('unknown merkle root') || combined.includes('unknown root')) {
          submission = await generateAndSubmit(true)
        } else {
          throw submitErr
        }
      }

      if (!mountedRef.current) return
      setTxHash(submission.result.txHash)
      const proofInputs = submission.proofInputs

      if (!publicClient) {
        throw new Error('Public client not available — cannot verify transaction')
      }
      setStatus('confirming')
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: submission.result.txHash as `0x${string}`,
        timeout: RECEIPT_TIMEOUT_MS,
      })
      if (receipt.status === 'reverted') {
        throw new Error(`Swap transaction reverted (tx: ${submission.result.txHash})`)
      }

      if (!mountedRef.current) return
      setStatus('saving-note')

      // Sanity-check: recompute commitment client-side and warn on mismatch.
      // Save regardless — the on-chain event is authoritative and throwing
      // would permanently lose the user's funds.
      const outputAssetId = await computeAssetId(chainId, tokenOut)
      try {
        const expectedCommitment = await poseidonHash([
          submission.ownerPubKey,
          BigInt(submission.result.outputAmount),
          outputAssetId,
          BigInt(chainId),
          submission.blinding,
        ])
        if (expectedCommitment !== BigInt(submission.result.outputCommitment)) {
          console.warn(
            `[V2/swap] Output commitment mismatch:`,
            `expected=${expectedCommitment}, got=${BigInt(submission.result.outputCommitment)}`,
            `— saving anyway (on-chain event is authoritative)`
          )
        }
      } catch (verifyErr) {
        console.warn('[V2/swap] Commitment verification failed:', verifyErr)
      }

      // Save the output note (new token received from the swap)
      const outputCommitmentHex = bigintToHex(BigInt(submission.result.outputCommitment))
      const outputStored: StoredNoteV2 = {
        id: outputCommitmentHex,
        walletAddress: address.toLowerCase(),
        chainId,
        commitment: outputCommitmentHex,
        owner: bigintToHex(submission.ownerPubKey),
        amount: bigintToHex(BigInt(submission.result.outputAmount)),
        asset: bigintToHex(outputAssetId),
        blinding: bigintToHex(submission.blinding),
        leafIndex: submission.result.queueIndex ?? -1,
        spent: false,
        createdAt: Date.now(),
        complianceStatus: 'unverified',
      }
      await saveNoteV2(db, address, outputStored, encKey)
      backupNote?.(outputStored).catch(() => {})
      setOutputNote(outputStored)

      // Mark input note as spent + save change note if applicable
      const changeAmount = inputNote.note.amount - amountIn
      let changeStored: StoredNoteV2 | undefined
      if (changeAmount > 0n) {
        const changeCommitmentHex = bigintToHex(proofInputs.outputCommitment0)
        changeStored = {
          id: changeCommitmentHex,
          walletAddress: address.toLowerCase(),
          chainId,
          commitment: changeCommitmentHex,
          owner: bigintToHex(proofInputs.outOwner[0]),
          amount: bigintToHex(proofInputs.outAmount[0]),
          asset: bigintToHex(proofInputs.outAsset[0]),
          blinding: bigintToHex(proofInputs.outBlinding[0]),
          leafIndex: -1,
          spent: false,
          createdAt: Date.now(),
          complianceStatus: 'inherited',
        }
      }
      await markSpentAndSaveChange(db, inputStored.id, changeStored, encKey)
      backupSpent?.(inputStored.id).catch(() => {})
      if (changeStored) backupNote?.(changeStored).catch(() => {})

      if (mountedRef.current) setStatus('done')
    } catch (e) {
      if (mountedRef.current) {
        setStatus('error')
        setError(extractRelayerError(e, 'Swap failed'))
      }
    } finally {
      if (mountedRef.current) setIsPending(false)
      swappingRef.current = false
    }
  }, [isConnected, address, chainId, publicClient])

  const clearError = useCallback(() => {
    setError(null)
    setTxHash(null)
    setOutputNote(null)
    setStatus('idle')
  }, [])

  return useMemo(
    () => ({ swap, isPending, status, txHash, error, outputNote, clearError }),
    [swap, isPending, status, txHash, error, outputNote, clearError]
  )
}
