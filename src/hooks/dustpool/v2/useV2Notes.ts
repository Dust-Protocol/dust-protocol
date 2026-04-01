import { useState, useEffect, useCallback, useRef, type RefObject } from 'react'
import { useAccount, useChainId } from 'wagmi'
import {
  openV2Database, storedToNoteCommitment, getPendingNotes, updateNoteLeafIndex,
  pruneStaleNotes,
} from '@/lib/dustpool/v2/storage'
import type { StoredNoteV2 } from '@/lib/dustpool/v2/storage'
import { createRelayerClient } from '@/lib/dustpool/v2/relayer-client'
import { deriveStorageKey, decryptNotePayload } from '@/lib/dustpool/v2/storage-crypto'
import type { NoteCommitmentV2, V2Keys } from '@/lib/dustpool/v2/types'

export function useV2Notes(keysRef?: RefObject<V2Keys | null>, chainIdOverride?: number) {
  const { address } = useAccount()
  const wagmiChainId = useChainId()
  const chainId = chainIdOverride ?? wagmiChainId

  const [notes, setNotes] = useState<NoteCommitmentV2[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const refreshingRef = useRef(false)

  const refreshNotes = useCallback(async () => {
    if (refreshingRef.current) return
    if (!address) {
      setNotes([])
      setIsLoading(false)
      return
    }

    refreshingRef.current = true
    setIsLoading(true)
    try {
      const db = await openV2Database()
      const keys = keysRef?.current
      const encKey = keys ? await deriveStorageKey(keys.spendingKey) : undefined

      // Get ALL notes (spent + unspent) for this wallet/chain
      // getUnspentNotes only returns unspent, so we query by wallet index
      // and include all notes regardless of spent status
      const tx = db.transaction(['notes'], 'readonly')
      const store = tx.objectStore('notes')
      const index = store.index('walletAddress')
      const addr = address.toLowerCase()

      const rawNotes = await new Promise<StoredNoteV2[]>((resolve, reject) => {
        const request = index.getAll(addr)
        request.onsuccess = () => {
          const results = (request.result as StoredNoteV2[])
            .filter(n => n.chainId === chainId)
          resolve(results)
        }
        request.onerror = () => reject(request.error)
      })

      // Decrypt encrypted notes if encryption key is available
      let allNotes = rawNotes
      if (encKey) {
        allNotes = await Promise.all(rawNotes.map(async (n) => {
          if (!n.encryptedData || !n.iv) return n
          const payload = await decryptNotePayload(
            { ciphertext: n.encryptedData, iv: n.iv },
            encKey
          )
          return { ...n, owner: payload.owner, amount: payload.amount, asset: payload.asset, blinding: payload.blinding }
        }))
      }

      setNotes(allNotes.map(storedToNoteCommitment))
    } catch (e) {
      console.error('[DustPoolV2] Failed to load notes:', e)
    } finally {
      refreshingRef.current = false
      setIsLoading(false)
    }
  }, [address, chainId])

  // Clear stale notes immediately on address/chain change before async refresh
  useEffect(() => {
    setNotes([])
  }, [address, chainId])

  useEffect(() => {
    refreshNotes()
  }, [refreshNotes])

  // Background sync: resolve pending notes (leafIndex === -1) via relayer
  const syncingRef = useRef(false)

  const syncPendingNotes = useCallback(async () => {
    if (!address || syncingRef.current) return
    syncingRef.current = true

    try {
      const db = await openV2Database()
      const relayer = createRelayerClient()
      let didUpdate = false

      // Prune notes from old contract deployments by checking tree leaf count
      try {
        const { leafCount } = await relayer.getTreeInfo(chainId)
        const pruned = await pruneStaleNotes(db, address, chainId, leafCount)
        if (pruned > 0) {
          console.warn(`[DustPoolV2] Pruned ${pruned} stale notes (leafIndex >= ${leafCount}) on chain ${chainId}`)
          didUpdate = true
        }
      } catch {
        // Relayer may be down — skip pruning this cycle
      }

      const pending = await getPendingNotes(db, address, chainId)
      for (const note of pending) {
        try {
          const status = await relayer.getDepositStatus(note.commitment, chainId)
          if (status.confirmed && status.leafIndex >= 0) {
            await updateNoteLeafIndex(db, note.id, status.leafIndex)
            didUpdate = true
          }
        } catch {
          // Relayer may be down or commitment not yet indexed — skip this note
        }
      }

      if (didUpdate) {
        await refreshNotes()
      }
    } catch (e) {
      console.error('[DustPoolV2] Background sync failed:', e)
    } finally {
      syncingRef.current = false
    }
  }, [address, chainId, refreshNotes])

  useEffect(() => {
    syncPendingNotes()
    const interval = setInterval(syncPendingNotes, 30_000)
    return () => clearInterval(interval)
  }, [syncPendingNotes])

  const unspentNotes = notes.filter(n => !n.spent)
  const spentNotes = notes.filter(n => n.spent)

  return { notes, unspentNotes, spentNotes, refreshNotes, isLoading }
}
