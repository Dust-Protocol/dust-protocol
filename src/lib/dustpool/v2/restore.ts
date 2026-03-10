/**
 * Cross-device note restore.
 *
 * Strategy: relayer backup first (fast, O(1)), chain scan fallback (slow, trustless).
 * All decryption happens client-side — the relayer only stores encrypted blobs.
 */

import { restoreFromRelayer, decryptNoteFromBackup, decryptAccountMetadata } from './backup-client'
import { scanEncryptedNotes } from './announcer-client'
import { openV2Database, saveNoteV2 } from './storage'
import { deriveStorageKey } from './storage-crypto'
import type { V2Keys } from './types'

export interface RestoreResult {
  notesRestored: number
  accountRestored: boolean
  source: 'relayer' | 'chain' | 'none'
}

export async function restoreFromBackup(
  keys: V2Keys,
  walletAddress: string,
  chainId: number,
  onProgress?: (msg: string) => void,
): Promise<RestoreResult> {
  const { spendingKey } = keys

  onProgress?.('Checking backup server...')
  try {
    const data = await restoreFromRelayer(spendingKey)
    if (data.notes.length > 0 || data.account) {
      const encKey = await deriveStorageKey(spendingKey)
      const db = await openV2Database()

      let notesRestored = 0
      for (const backupNote of data.notes) {
        try {
          const note = await decryptNoteFromBackup(backupNote, spendingKey)
          note.walletAddress = walletAddress.toLowerCase()
          await saveNoteV2(db, walletAddress, note, encKey)
          notesRestored++
        } catch {
          // Corrupted or wrong-key blob — skip
        }
      }

      let accountRestored = false
      if (data.account) {
        try {
          const meta = await decryptAccountMetadata(data.account, spendingKey)
          if (meta.encryptedPin) {
            const { storageKey } = await import('@/lib/storageKey')
            localStorage.setItem(storageKey('encrypted-pin', walletAddress), meta.encryptedPin)
          }
          if (meta.recoveryHash) {
            const { storageKey } = await import('@/lib/storageKey')
            localStorage.setItem(storageKey('recovery-hash', walletAddress), meta.recoveryHash)
          }
          accountRestored = true
        } catch {
          // Account metadata decrypt failed — skip
        }
      }

      if (notesRestored > 0 || accountRestored) {
        onProgress?.(`Restored ${notesRestored} notes from backup`)
        return { notesRestored, accountRestored, source: 'relayer' }
      }
    }
  } catch {
    // Relayer unavailable — fall through to chain scan
  }

  onProgress?.('Scanning blockchain for encrypted notes...')
  try {
    const allNotes = await scanEncryptedNotes(
      chainId,
      0,
      (scanned, total) => {
        if (total > 0) {
          onProgress?.(`Scanning: ${Math.round((scanned / total) * 100)}%`)
        }
      },
    )

    if (allNotes.length === 0) {
      return { notesRestored: 0, accountRestored: false, source: 'none' }
    }

    const encKey = await deriveStorageKey(spendingKey)
    const db = await openV2Database()
    let notesRestored = 0

    for (const { ciphertext, commitment } of allNotes) {
      try {
        // Trial-decrypt: AES-GCM auth tag validates only for our notes
        const note = await decryptNoteFromBackup(
          { commitment, ciphertext, iv: '' },
          spendingKey,
        )
        note.walletAddress = walletAddress.toLowerCase()
        await saveNoteV2(db, walletAddress, note, encKey)
        notesRestored++
      } catch {
        // Decrypt failed = not our note
      }
    }

    onProgress?.(`Restored ${notesRestored} notes from blockchain`)
    return { notesRestored, accountRestored: false, source: 'chain' }
  } catch {
    return { notesRestored: 0, accountRestored: false, source: 'none' }
  }
}
