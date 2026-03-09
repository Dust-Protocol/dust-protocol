/**
 * IPFS backup for encrypted V2 UTXO notes.
 *
 * Reads already-encrypted notes from IndexedDB and uploads them as a single
 * blob to IPFS via the web3.storage (Storacha) HTTP API. Notes are stored
 * with AES-256-GCM encryption at rest — this module does NOT re-encrypt.
 *
 * The blob format is a JSON array of StoredNoteV2 rows exactly as they
 * exist in IndexedDB (sensitive fields blanked, encryptedData/iv present).
 */

import { openV2Database, type StoredNoteV2 } from '../dustpool/v2/storage'

export type CID = string

const BACKUP_FORMAT_VERSION = 1

interface BackupManifest {
  version: typeof BACKUP_FORMAT_VERSION
  chainId: number
  noteCount: number
  createdAt: number
  notes: StoredNoteV2[]
}

/**
 * Read all V2 notes for a given chain from IndexedDB.
 * Returns raw rows — encrypted fields stay encrypted, no CryptoKey needed.
 */
async function getAllNotesForChain(
  chainId: number
): Promise<StoredNoteV2[]> {
  const db = await openV2Database()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['notes'], 'readonly')
    const store = tx.objectStore('notes')
    const index = store.index('chainId')
    const request = index.getAll(chainId)

    request.onsuccess = () => {
      resolve(request.result as StoredNoteV2[])
    }
    request.onerror = () => {
      reject(new Error(`Failed to read notes for chain ${chainId}: ${request.error?.message}`))
    }
  })
}

/**
 * Export all V2 notes for a chain as an encrypted backup blob.
 * The blob contains a JSON manifest with version metadata and the raw
 * IndexedDB rows (already AES-256-GCM encrypted).
 */
export async function exportEncryptedNotes(chainId: number): Promise<Blob> {
  const notes = await getAllNotesForChain(chainId)

  if (notes.length === 0) {
    throw new Error(`No notes found for chain ${chainId}`)
  }

  const manifest: BackupManifest = {
    version: BACKUP_FORMAT_VERSION,
    chainId,
    noteCount: notes.length,
    createdAt: Date.now(),
    notes,
  }

  return new Blob(
    [JSON.stringify(manifest)],
    { type: 'application/json' }
  )
}

/**
 * Upload an encrypted backup blob to IPFS via web3.storage HTTP API.
 * Requires NEXT_PUBLIC_W3S_TOKEN environment variable.
 *
 * Uses the simple /upload endpoint which accepts raw file bytes and
 * returns a CID. The content is stored on Filecoin via Storacha.
 *
 * @see https://web3.storage/docs/how-to/upload/#upload-a-file
 */
export async function uploadToIPFS(blob: Blob): Promise<CID> {
  const token = process.env.NEXT_PUBLIC_W3S_TOKEN
  if (!token) {
    throw new Error(
      'NEXT_PUBLIC_W3S_TOKEN not set. Get a token at https://web3.storage'
    )
  }

  const response = await fetch('https://api.web3.storage/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Name': `dust-v2-backup-${Date.now()}`,
    },
    body: blob,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => 'unknown error')
    throw new Error(
      `IPFS upload failed (${response.status}): ${body}`
    )
  }

  const result: { cid: string } = await response.json()

  if (!result.cid) {
    throw new Error('IPFS upload response missing CID')
  }

  return result.cid
}

/**
 * Back up all V2 notes for a chain to IPFS.
 * Combines export + upload into a single call. Returns the IPFS CID
 * which the user must save to restore later.
 */
export async function backupNotes(chainId: number): Promise<CID> {
  const blob = await exportEncryptedNotes(chainId)
  return uploadToIPFS(blob)
}
