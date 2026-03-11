import { openV2Database, type StoredNoteV2 } from './storage'

export interface NoteBackup {
  version: 1
  exportedAt: string
  walletAddress: string
  chainId: number
  noteCount: number
  notes: StoredNoteV2[]
}

async function getAllNotesForWallet(
  db: IDBDatabase,
  walletAddress: string,
  chainId: number
): Promise<StoredNoteV2[]> {
  const addr = walletAddress.toLowerCase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['notes'], 'readonly')
    const store = tx.objectStore('notes')
    const index = store.index('walletAddress')
    const request = index.getAll(addr)
    request.onsuccess = () => {
      const notes = (request.result as StoredNoteV2[]).filter(
        (n) => n.chainId === chainId
      )
      resolve(notes)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function exportNotes(
  walletAddress: string,
  chainId: number
): Promise<NoteBackup> {
  const db = await openV2Database()
  const notes = await getAllNotesForWallet(db, walletAddress, chainId)

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    walletAddress: walletAddress.toLowerCase(),
    chainId,
    noteCount: notes.length,
    notes,
  }
}

export async function importNotes(
  backup: NoteBackup
): Promise<{ imported: number; skipped: number }> {
  if (backup.version !== 1) throw new Error('Unsupported backup version')

  const db = await openV2Database()
  let imported = 0
  let skipped = 0

  for (const note of backup.notes) {
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(['notes'], 'readwrite')
        const store = tx.objectStore('notes')
        const request = store.put({
          ...note,
          walletAddress: note.walletAddress.toLowerCase(),
        })
        request.onsuccess = () => {
          imported++
          resolve()
        }
        request.onerror = () => {
          skipped++
          resolve()
        }
      })
    } catch {
      skipped++
    }
  }

  return { imported, skipped }
}

export function downloadBackup(backup: NoteBackup): void {
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dust-backup-${backup.chainId}-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function validateBackup(data: unknown): data is NoteBackup {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    d.version === 1 &&
    typeof d.walletAddress === 'string' &&
    typeof d.chainId === 'number' &&
    Array.isArray(d.notes)
  )
}
