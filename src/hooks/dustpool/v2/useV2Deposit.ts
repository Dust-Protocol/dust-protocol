import { useState, useCallback, useRef, useMemo, type RefObject } from 'react'
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi'
import { publicActions, zeroAddress, type Address } from 'viem'
import { computeOwnerPubKey, computeAssetId, computeNoteCommitment } from '@/lib/dustpool/v2/commitment'
import { createNote } from '@/lib/dustpool/v2/note'
import { MAX_AMOUNT } from '@/lib/dustpool/v2/constants'
import { getDustPoolV2Config, DUST_POOL_V2_ABI } from '@/lib/dustpool/v2/contracts'
import { openV2Database, saveNoteV2, bigintToHex } from '@/lib/dustpool/v2/storage'
import { createRelayerClient } from '@/lib/dustpool/v2/relayer-client'
import { deriveStorageKey } from '@/lib/dustpool/v2/storage-crypto'
import { checkDepositorCompliance } from '@/lib/dustpool/v2/compliance'
import type { V2Keys } from '@/lib/dustpool/v2/types'
import type { StoredNoteV2 } from '@/lib/dustpool/v2/storage'

const DEPOSIT_POLL_INTERVAL_MS = 3000
const DEPOSIT_POLL_MAX_ATTEMPTS = 10

export function useV2Deposit(
  keysRef: RefObject<V2Keys | null>,
  chainIdOverride?: number,
  backupNote?: (note: StoredNoteV2) => Promise<void>,
) {
  const { address, isConnected } = useAccount()
  const wagmiChainId = useChainId()
  const chainId = chainIdOverride ?? wagmiChainId
  const publicClient = usePublicClient({ chainId })
  const { data: walletClient } = useWalletClient()

  const [isPending, setIsPending] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const depositingRef = useRef(false)

  const deposit = useCallback(async (amount: bigint, asset: Address = zeroAddress) => {
    if (!isConnected || !address) { setError('Wallet not connected'); return }
    const keys = keysRef.current
    if (!keys) { setError('Keys not available — verify PIN first'); return }
    if (!walletClient) { setError('Wallet client not available'); return }
    if (depositingRef.current) return
    if (amount <= 0n) { setError('Amount must be positive'); return }
    if (amount > MAX_AMOUNT) { setError('Amount exceeds maximum (2^64 - 1)'); return }

    const contractConfig = getDustPoolV2Config(chainId)
    if (!contractConfig) { setError(`DustPoolV2 not deployed on chain ${chainId}`); return }

    depositingRef.current = true
    setIsPending(true)
    setError(null)
    setTxHash(null)

    try {
      // Pre-deposit compliance screening (no-op if oracle disabled on-chain)
      if (!publicClient) {
        throw new Error('Provider not available for compliance screening')
      }
      const complianceResult = await checkDepositorCompliance(publicClient, address, chainId)
      if (complianceResult.status === 'blocked') {
        throw new Error(complianceResult.reason)
      }

      const owner = await computeOwnerPubKey(keys.spendingKey)
      const assetId = await computeAssetId(chainId, asset)
      const note = createNote(owner, amount, assetId, chainId)
      const commitment = await computeNoteCommitment(note)
      const commitmentBytes32 = `0x${commitment.toString(16).padStart(64, '0')}` as `0x${string}`

      let hash: `0x${string}`
      if (asset === zeroAddress) {
        hash = await walletClient.writeContract({
          address: contractConfig.address,
          abi: DUST_POOL_V2_ABI,
          functionName: 'deposit',
          args: [commitmentBytes32],
          value: amount,
        })
      } else {
        hash = await walletClient.writeContract({
          address: contractConfig.address,
          abi: DUST_POOL_V2_ABI,
          functionName: 'depositERC20',
          args: [commitmentBytes32, asset, amount],
        })
      }

      // Wait for on-chain confirmation via wallet's transport
      const walletPublic = walletClient.extend(publicActions)
      const receipt = await walletPublic.waitForTransactionReceipt({ hash })
      if (receipt.status === 'reverted') {
        throw new Error('Deposit transaction reverted')
      }

      setTxHash(hash)

      // Poll relayer for leaf index assignment
      const relayer = createRelayerClient()
      const commitmentHex = bigintToHex(commitment)
      let leafIndex = -1

      for (let attempt = 0; attempt < DEPOSIT_POLL_MAX_ATTEMPTS; attempt++) {
        try {
          const status = await relayer.getDepositStatus(commitmentHex, chainId)
          if (status.confirmed) {
            leafIndex = status.leafIndex
            break
          }
        } catch {
          // Relayer may not have indexed the deposit yet
        }
        await new Promise(r => setTimeout(r, DEPOSIT_POLL_INTERVAL_MS))
      }

      const stored: StoredNoteV2 = {
        id: commitmentHex,
        walletAddress: address.toLowerCase(),
        chainId,
        commitment: commitmentHex,
        owner: bigintToHex(note.owner),
        amount: bigintToHex(note.amount),
        asset: bigintToHex(note.asset),
        blinding: bigintToHex(note.blinding),
        leafIndex,
        spent: false,
        status: leafIndex >= 0 ? 'confirmed' : 'pending',
        createdAt: Date.now(),
        complianceStatus: 'unverified',
        blockNumber: Number(receipt.blockNumber),
      }

      const db = await openV2Database()
      const encKey = await deriveStorageKey(keys.spendingKey)
      await saveNoteV2(db, address, stored, encKey)
      backupNote?.(stored).catch(() => {})

      if (leafIndex === -1) {
        // Note is saved — background sync (useV2Notes) will resolve leafIndex later
        throw new Error(
          'Deposit confirmed on-chain but relayer has not indexed it yet. ' +
          'Your note is saved and will sync automatically.'
        )
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Deposit failed'
      if (msg.toLowerCase().includes('rejected') || msg.includes('denied')) {
        setError('Transaction rejected by user')
      } else {
        setError(msg)
      }
    } finally {
      setIsPending(false)
      depositingRef.current = false
    }
  }, [isConnected, address, publicClient, walletClient, chainId])

  const clearError = useCallback(() => {
    setError(null)
    setTxHash(null)
  }, [])

  return useMemo(() => ({ deposit, isPending, txHash, error, clearError }), [deposit, isPending, txHash, error, clearError])
}
