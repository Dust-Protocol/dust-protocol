import { useState, useCallback, useRef, useMemo, type RefObject } from 'react'
import { useAccount, useChainId, usePublicClient } from 'wagmi'
import { zeroAddress, type Address } from 'viem'
import { computeAssetId } from '@/lib/dustpool/v2/commitment'
import { buildWithdrawInputs } from '@/lib/dustpool/v2/proof-inputs'
import {
  openV2Database, getUnspentNotes, markSpentAndSaveChange,
  bigintToHex, hexToBigint, storedToNoteCommitment,
} from '@/lib/dustpool/v2/storage'
import type { StoredNoteV2 } from '@/lib/dustpool/v2/storage'
import { createRelayerClient } from '@/lib/dustpool/v2/relayer-client'
import { generateV2Proof, verifyV2ProofLocally } from '@/lib/dustpool/v2/proof'
import { deriveStorageKey } from '@/lib/dustpool/v2/storage-crypto'
import { extractRelayerError } from '@/lib/dustpool/v2/errors'
import { ensureComplianceProved } from '@/lib/dustpool/v2/compliance-gate'
import type { V2Keys } from '@/lib/dustpool/v2/types'

const RECEIPT_TIMEOUT_MS = 30_000

export function useV2Withdraw(
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
  const [status, setStatus] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const withdrawingRef = useRef(false)

  const withdraw = useCallback(async (
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
    setIsPending(true)
    setError(null)
    setTxHash(null)

    try {
      const db = await openV2Database()
      const encKey = await deriveStorageKey(keys.spendingKey)
      const assetId = await computeAssetId(chainId, asset)
      const assetHex = bigintToHex(assetId)

      const storedNotes = await getUnspentNotes(db, address, chainId, encKey)

      // Best-fit selection: smallest note >= amount, with confirmed leafIndex
      const eligible = storedNotes
        .filter(n => n.asset === assetHex && hexToBigint(n.amount) >= amount && n.leafIndex >= 0)
        .sort((a, b) => {
          const diff = hexToBigint(a.amount) - hexToBigint(b.amount)
          if (diff < 0n) return -1
          if (diff > 0n) return 1
          return 0
        })

      if (eligible.length === 0) {
        throw new Error('No note with sufficient balance for this withdrawal')
      }

      const inputStored = eligible[0]
      const inputNote = storedToNoteCommitment(inputStored)

      // Compliance gate: prove note is not from a sanctioned source
      if (!publicClient) throw new Error('Public client not available')
      setStatus('Proving compliance...')
      await ensureComplianceProved(
        [{ commitment: inputNote.commitment, leafIndex: inputNote.leafIndex, complianceStatus: inputStored.complianceStatus }],
        keys.nullifierKey,
        chainId,
        publicClient,
        setStatus,
      )

      const relayer = createRelayerClient()

      const generateAndSubmit = async (isRetry: boolean) => {
        if (isRetry) {
          setStatus('Tree updated during proof generation. Retrying with fresh state...')
        }

        const merkleProof = await relayer.getMerkleProof(inputNote.leafIndex, chainId)
        const proofInputs = await buildWithdrawInputs(
          inputNote, amount, recipient, keys, merkleProof, chainId
        )

        const { proof, publicSignals, proofCalldata } = await generateV2Proof(proofInputs)

        const isValid = await verifyV2ProofLocally(proof, publicSignals)
        if (!isValid) {
          throw new Error('Generated proof failed local verification')
        }

        setStatus('Submitting to relayer...')
        return { proofInputs, result: await relayer.submitWithdrawal(proofCalldata, publicSignals, chainId, asset) }
      }

      let submission: Awaited<ReturnType<typeof generateAndSubmit>>
      try {
        submission = await generateAndSubmit(false)
      } catch (submitErr) {
        const errMsg = submitErr instanceof Error ? submitErr.message : ''
        const errBody = (submitErr as { body?: string }).body ?? ''
        const combined = `${errMsg} ${errBody}`.toLowerCase()
        // Stale root: relayer rejected because tree changed during proof generation
        if (combined.includes('unknown merkle root') || combined.includes('unknown root') || combined.includes('invalid or expired merkle root')) {
          submission = await generateAndSubmit(true)
        } else {
          throw submitErr
        }
      }

      setTxHash(submission.result.txHash)
      const proofInputs = submission.proofInputs

      // Verify the withdrawal tx actually succeeded on-chain before marking spent
      if (!publicClient) {
        throw new Error('Public client not available — cannot verify transaction')
      }
      setStatus('Confirming on-chain...')
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: submission.result.txHash as `0x${string}`,
        timeout: RECEIPT_TIMEOUT_MS,
      })
      if (receipt.status === 'reverted') {
        throw new Error(`Withdrawal transaction reverted (tx: ${submission.result.txHash})`)
      }

      // Atomically mark spent + save change in one IndexedDB transaction
      if (inputNote.note.amount < amount) {
        throw new Error('Input note amount less than withdrawal — stale data')
      }
      const changeAmount = inputNote.note.amount - amount
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
          status: 'pending',
          createdAt: Date.now(),
          complianceStatus: 'inherited',
        }
      }
      await markSpentAndSaveChange(db, inputStored.id, changeStored, encKey)
      backupSpent?.(inputStored.id).catch(() => {})
      if (changeStored) backupNote?.(changeStored).catch(() => {})
    } catch (e) {
      setError(extractRelayerError(e, 'Withdrawal failed'))
    } finally {
      setIsPending(false)
      setStatus(null)
      withdrawingRef.current = false
    }
  }, [isConnected, address, chainId, publicClient])

  const clearError = useCallback(() => {
    setError(null)
    setTxHash(null)
    setStatus(null)
  }, [])

  return useMemo(() => ({ withdraw, isPending, status, txHash, error, clearError }), [withdraw, isPending, status, txHash, error, clearError])
}
