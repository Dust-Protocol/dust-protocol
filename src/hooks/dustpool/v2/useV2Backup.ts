import { useCallback, type RefObject } from 'react'
import {
  pushNoteBackup,
  pushAccountBackup,
  markNoteSpentOnBackup,
} from '@/lib/dustpool/v2/backup-client'
import type { StoredNoteV2 } from '@/lib/dustpool/v2/storage'
import type { V2Keys } from '@/lib/dustpool/v2/types'
import type { AccountMetadata } from '@/lib/dustpool/v2/backup-client'

export function useV2Backup(keysRef: RefObject<V2Keys | null>, chainId: number) {
  const backupNote = useCallback(
    async (note: StoredNoteV2) => {
      const keys = keysRef.current
      if (!keys) return
      try {
        await pushNoteBackup(note, keys.spendingKey, chainId)
      } catch (err) {
        console.warn('[useV2Backup] Note backup failed (non-blocking):', err)
      }
    },
    [keysRef, chainId]
  )

  const backupSpent = useCallback(
    async (commitment: string) => {
      const keys = keysRef.current
      if (!keys) return
      try {
        await markNoteSpentOnBackup(commitment, keys.spendingKey)
      } catch (err) {
        console.warn('[useV2Backup] Spent backup failed (non-blocking):', err)
      }
    },
    [keysRef]
  )

  const backupAccount = useCallback(
    async (meta: AccountMetadata) => {
      const keys = keysRef.current
      if (!keys) return
      try {
        await pushAccountBackup(meta, keys.spendingKey)
      } catch (err) {
        console.warn('[useV2Backup] Account backup failed (non-blocking):', err)
      }
    },
    [keysRef]
  )

  return { backupNote, backupSpent, backupAccount }
}
