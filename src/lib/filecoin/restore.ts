/**
 * IPFS restore for encrypted V2 UTXO notes.
 *
 * Downloads a backup blob from IPFS and writes the notes back into
 * IndexedDB. Notes remain AES-256-GCM encrypted — this module does
 * NOT decrypt them. The user's CryptoKey is needed only when reading
 * notes through the normal storage API.
 */

import { openV2Database, type StoredNoteV2 } from '../dustpool/v2/storage'
import type { CID } from './backup'

const IPFS_GATEWAYS = [
  'https://w3s.link/ipfs',
  'https://ipfs.io/ipfs',
  'https://dweb.link/ipfs',
] as const

/** Maximum blob size we'll accept from IPFS (50 MB) */
const MAX_BLOB_SIZE = 50 * 1024 * 1024

interface BackupManifest {
  version: number
  chainId: number
  noteCount: number
  createdAt: number
  notes: StoredNoteV2[]
}

/**
 * Download a backup blob from IPFS, trying multiple gateways with fallback.
 * Returns the raw blob for import.
 */
export async function downloadFromIPFS(cid: string): Promise<Blob> {
  if (!cid || typeof cid !== 'string') {
    throw new Error('Invalid CID')
  }

  let lastError: Error | null = null

  for (const gateway of IPFS_GATEWAYS) {
    const url = `${gateway}/${cid}`

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
      })

      if (!response.ok) {
        lastError = new Error(`Gateway ${gateway} returned ${response.status}`)
        continue
      }

      const contentLength = response.headers.get('content-length')
      if (contentLength && parseInt(contentLength, 10) > MAX_BLOB_SIZE) {
        throw new Error(
          `Backup too large (${contentLength} bytes, max ${MAX_BLOB_SIZE})`
        )
      }

      const blob = await response.blob()

      if (blob.size > MAX_BLOB_SIZE) {
        throw new Error(
          `Backup too large (${blob.size} bytes, max ${MAX_BLOB_SIZE})`
        )
      }

      return blob
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Backup too large')) {
        throw err
      }
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  throw new Error(
    `Failed to download from all IPFS gateways: ${lastError?.message ?? 'unknown error'}`
  )
}

/**
 * Parse and validate a backup blob into a manifest.
 * Checks version, chainId match, and note array structure.
 */
function parseBackupBlob(
  json: string,
  expectedChainId: number
): BackupManifest {
  let manifest: BackupManifest

  try {
    manifest = JSON.parse(json) as BackupManifest
  } catch {
    throw new Error('Invalid backup format: not valid JSON')
  }

  if (!manifest.version || manifest.version > 1) {
    throw new Error(
      `Unsupported backup version: ${manifest.version}. Update your client.`
    )
  }

  if (manifest.chainId !== expectedChainId) {
    throw new Error(
      `Chain mismatch: backup is for chain ${manifest.chainId}, expected ${expectedChainId}`
    )
  }

  if (!Array.isArray(manifest.notes) || manifest.notes.length === 0) {
    throw new Error('Backup contains no notes')
  }

  for (const note of manifest.notes) {
    if (!note.id || !note.commitment || typeof note.chainId !== 'number') {
      throw new Error('Backup contains malformed note (missing id, commitment, or chainId)')
    }
  }

  return manifest
}

/**
 * Import encrypted notes from a backup blob into IndexedDB.
 * Notes are written as-is (still encrypted). Existing notes with the
 * same commitment ID are overwritten (put semantics).
 *
 * Returns the number of notes imported.
 */
export async function importEncryptedNotes(
  blob: Blob,
  chainId: number
): Promise<number> {
  const text = await blob.text()
  const manifest = parseBackupBlob(text, chainId)

  const db = await openV2Database()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['notes'], 'readwrite')
    const store = tx.objectStore('notes')
    let imported = 0

    tx.oncomplete = () => resolve(imported)
    tx.onerror = () => reject(new Error(`Import failed: ${tx.error?.message}`))
    tx.onabort = () => reject(new Error(`Import aborted: ${tx.error?.message}`))

    for (const note of manifest.notes) {
      const request = store.put(note)
      request.onsuccess = () => {
        imported++
      }
    }
  })
}

/**
 * Restore V2 notes from an IPFS backup.
 * Combines download + import into a single call.
 * Returns the number of notes restored.
 */
export async function restoreNotes(
  cid: string,
  chainId: number
): Promise<number> {
  const blob = await downloadFromIPFS(cid)
  return importEncryptedNotes(blob, chainId)
}
