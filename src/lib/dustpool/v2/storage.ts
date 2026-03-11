/**
 * V2 DustPool IndexedDB storage for multi-asset UTXO notes
 *
 * Stores deposit notes locally so users can prove ownership for private operations.
 * Notes contain secrets (blinding factors) that must never leave the browser.
 *
 * BigInt values are stored as hex strings because IndexedDB cannot serialize bigint.
 * Scoped per wallet address for multi-account isolation.
 *
 * Sensitive fields (owner, amount, asset, blinding) are encrypted with AES-256-GCM
 * when a CryptoKey is provided. Unencrypted notes from before the encryption upgrade
 * are still readable for backward compatibility.
 */

import {
  encryptNotePayload,
  decryptNotePayload,
  type NotePayload,
  type EncryptedPayload,
} from './storage-crypto'

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Convert a bigint to a hex string with 0x prefix */
export function bigintToHex(val: bigint): string {
  return '0x' + val.toString(16)
}

/** Convert a hex string (with 0x prefix) back to bigint */
export function hexToBigint(hex: string): bigint {
  if (!hex) return 0n
  return BigInt(hex)
}

// ─── Schema ─────────────────────────────────────────────────────────────────────

export interface StoredNoteV2 {
  /** commitment as hex string (primary key) */
  id: string
  /** owner wallet address (scoped per wallet) */
  walletAddress: string
  chainId: number
  /** Poseidon commitment as hex */
  commitment: string
  /** Poseidon(spendingKey) as hex — empty string when encrypted */
  owner: string
  /** note value in base units as hex — empty string when encrypted */
  amount: string
  /** Poseidon(chainId, tokenAddress) as hex — empty string when encrypted */
  asset: string
  /** random blinding factor as hex — empty string when encrypted */
  blinding: string
  /** position in the global Merkle tree */
  leafIndex: number
  /** whether this note has been consumed */
  spent: boolean
  /** Unix timestamp in milliseconds */
  createdAt: number
  /** AES-256-GCM encrypted payload (base64) — present when note is encrypted */
  encryptedData?: string
  /** AES-GCM IV (base64) — present when note is encrypted */
  iv?: string
  /** Note lifecycle: 'pending' until on-chain, 'confirmed' after relayer indexes */
  status?: 'pending' | 'confirmed'
  /** Compliance status: tracks whether this note has been proven clean */
  complianceStatus?: 'unverified' | 'verified' | 'inherited'
  /** Transaction hash of the compliance proof submission */
  complianceTxHash?: string
  /** Block number when note was included on-chain (for scoped view key filtering) */
  blockNumber?: number
}

// ─── Conversion ─────────────────────────────────────────────────────────────────

import type { NoteCommitmentV2 } from './types'

/** Convert a StoredNoteV2 (IndexedDB hex format) to a NoteCommitmentV2 (bigint format) */
export function storedToNoteCommitment(stored: StoredNoteV2): NoteCommitmentV2 {
  return {
    note: {
      owner: hexToBigint(stored.owner),
      amount: hexToBigint(stored.amount),
      asset: hexToBigint(stored.asset),
      chainId: stored.chainId,
      blinding: hexToBigint(stored.blinding),
    },
    commitment: hexToBigint(stored.commitment),
    leafIndex: stored.leafIndex,
    spent: stored.spent,
    createdAt: stored.createdAt,
    blockNumber: stored.blockNumber,
  }
}

// ─── Database ───────────────────────────────────────────────────────────────────

const DB_NAME = 'dust-v2-notes'
const DB_VERSION = 1
const STORE_NAME = 'notes'

let dbInstance: IDBDatabase | null = null

/**
 * Open (or create) the V2 notes database with the required schema.
 */
export function openV2Database(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance)
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('[DustPool V2] Failed to open database:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })

        store.createIndex('walletAddress', 'walletAddress', { unique: false })
        store.createIndex('chainId', 'chainId', { unique: false })
        store.createIndex('spent', 'spent', { unique: false })
        store.createIndex('wallet_chain_spent', ['walletAddress', 'chainId', 'spent'], {
          unique: false,
        })
      }
    }
  })
}

// ─── Encryption Helpers ─────────────────────────────────────────────────────────

/** Encrypt sensitive fields before saving. Clears plaintext sensitive fields. */
async function encryptForStorage(
  note: StoredNoteV2,
  encKey: CryptoKey
): Promise<StoredNoteV2> {
  const payload: NotePayload = {
    owner: note.owner,
    amount: note.amount,
    asset: note.asset,
    blinding: note.blinding,
  }
  const encrypted: EncryptedPayload = await encryptNotePayload(payload, encKey)
  return {
    ...note,
    owner: '',
    amount: '',
    asset: '',
    blinding: '',
    encryptedData: encrypted.ciphertext,
    iv: encrypted.iv,
  }
}

/** Decrypt sensitive fields after reading. Returns note with plaintext fields restored. */
async function decryptFromStorage(
  note: StoredNoteV2,
  encKey: CryptoKey
): Promise<StoredNoteV2> {
  if (!note.encryptedData || !note.iv) return note
  const payload = await decryptNotePayload(
    { ciphertext: note.encryptedData, iv: note.iv },
    encKey
  )
  return {
    ...note,
    owner: payload.owner,
    amount: payload.amount,
    asset: payload.asset,
    blinding: payload.blinding,
  }
}

// ─── CRUD Operations ────────────────────────────────────────────────────────────

/**
 * Save a V2 note to IndexedDB.
 * The note's `id` (commitment hex) is used as the primary key.
 * If `encKey` is provided, sensitive fields are AES-256-GCM encrypted.
 */
export async function saveNoteV2(
  db: IDBDatabase,
  walletAddress: string,
  note: StoredNoteV2,
  encKey?: CryptoKey
): Promise<void> {
  let toStore: StoredNoteV2 = {
    ...note,
    walletAddress: walletAddress.toLowerCase(),
  }
  if (encKey) {
    toStore = await encryptForStorage(toStore, encKey)
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(toStore)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get all unspent notes for a wallet on a specific chain.
 * If `encKey` is provided, encrypted notes are decrypted before returning.
 */
export async function getUnspentNotes(
  db: IDBDatabase,
  walletAddress: string,
  chainId: number,
  encKey?: CryptoKey
): Promise<StoredNoteV2[]> {
  if (!walletAddress) return []
  const addr = walletAddress.toLowerCase()

  // Query by walletAddress index and filter in JS.
  // The wallet_chain_spent compound index uses boolean `spent` which is not
  // a valid IndexedDB key type — IDBKeyRange.only() rejects booleans.
  const raw: StoredNoteV2[] = await new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('walletAddress')
    const request = index.getAll(addr)

    request.onsuccess = () => {
      const notes = (request.result as StoredNoteV2[]).filter(n =>
        !n.spent && (chainId === undefined || n.chainId === chainId)
      )
      resolve(notes)
    }
    request.onerror = () => reject(request.error)
  })

  if (!encKey) return raw
  return Promise.all(raw.map(n => decryptFromStorage(n, encKey)))
}

/**
 * Mark a note as spent by its commitment hex.
 */
export function markNoteSpent(db: IDBDatabase, commitmentHex: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getRequest = store.get(commitmentHex)

    getRequest.onsuccess = () => {
      const note = getRequest.result as StoredNoteV2 | undefined
      if (!note) {
        reject(new Error(`Note not found: ${commitmentHex}`))
        return
      }

      note.spent = true
      const putRequest = store.put(note)
      putRequest.onsuccess = () => resolve()
      putRequest.onerror = () => reject(putRequest.error)
    }

    getRequest.onerror = () => reject(getRequest.error)
  })
}

/**
 * Get the total balance for a specific asset across unspent notes.
 */
export async function getBalance(
  db: IDBDatabase,
  walletAddress: string,
  chainId: number,
  assetHex: string,
  encKey?: CryptoKey
): Promise<bigint> {
  const notes = await getUnspentNotes(db, walletAddress, chainId, encKey)

  let total = 0n
  for (const note of notes) {
    if (note.asset === assetHex) {
      total += hexToBigint(note.amount)
    }
  }

  return total
}

/**
 * Get balances for all assets across unspent notes on a specific chain,
 * grouped by asset hex. Returns a Map keyed by asset hex string with bigint total values.
 */
export async function getAllBalances(
  db: IDBDatabase,
  walletAddress: string,
  chainId: number,
  encKey?: CryptoKey
): Promise<Map<string, bigint>> {
  const notes = await getUnspentNotes(db, walletAddress, chainId, encKey)
  const balances = new Map<string, bigint>()

  for (const note of notes) {
    const current = balances.get(note.asset) ?? 0n
    balances.set(note.asset, current + hexToBigint(note.amount))
  }

  return balances
}

/**
 * Atomically mark an input note as spent and save a change note (if any).
 * Both operations share a single IndexedDB transaction — if either fails,
 * neither commits, preventing fund loss from partial updates.
 * If `encKey` is provided, the change note is encrypted before storing.
 */
export async function markSpentAndSaveChange(
  db: IDBDatabase,
  inputCommitmentHex: string,
  changeNote?: StoredNoteV2,
  encKey?: CryptoKey
): Promise<void> {
  let encryptedChange: StoredNoteV2 | undefined
  if (changeNote && encKey) {
    encryptedChange = await encryptForStorage(
      { ...changeNote, walletAddress: changeNote.walletAddress.toLowerCase() },
      encKey
    )
  } else if (changeNote) {
    encryptedChange = { ...changeNote, walletAddress: changeNote.walletAddress.toLowerCase() }
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite')

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'))

    const store = tx.objectStore(STORE_NAME)
    const getRequest = store.get(inputCommitmentHex)

    getRequest.onsuccess = () => {
      const note = getRequest.result as StoredNoteV2 | undefined
      if (!note) {
        tx.abort()
        return
      }

      note.spent = true
      store.put(note)

      if (encryptedChange) {
        store.put(encryptedChange)
      }
    }

    getRequest.onerror = () => {
      tx.abort()
    }
  })
}

/**
 * Atomically mark an input note as spent and save multiple output notes.
 * Used by split operations where one input produces N outputs.
 * All operations share a single IndexedDB transaction — if any fails,
 * the entire batch rolls back, preventing partial state corruption.
 * If `encKey` is provided, output notes are encrypted before storing.
 */
export async function markSpentAndSaveMultiple(
  db: IDBDatabase,
  inputCommitmentHex: string,
  outputNotes: StoredNoteV2[],
  encKey?: CryptoKey
): Promise<void> {
  const encrypted: StoredNoteV2[] = []
  for (const note of outputNotes) {
    const normalized = { ...note, walletAddress: note.walletAddress.toLowerCase() }
    encrypted.push(encKey ? await encryptForStorage(normalized, encKey) : normalized)
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite')

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'))

    const store = tx.objectStore(STORE_NAME)
    const getRequest = store.get(inputCommitmentHex)

    getRequest.onsuccess = () => {
      const note = getRequest.result as StoredNoteV2 | undefined
      if (!note) {
        tx.abort()
        return
      }

      note.spent = true
      store.put(note)

      for (const outputNote of encrypted) {
        store.put(outputNote)
      }
    }

    getRequest.onerror = () => {
      tx.abort()
    }
  })
}

/**
 * Update a stored note's leafIndex. Used by background sync to resolve
 * pending notes (leafIndex === -1) after the relayer confirms them.
 */
export function updateNoteLeafIndex(
  db: IDBDatabase,
  commitmentHex: string,
  leafIndex: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getRequest = store.get(commitmentHex)

    getRequest.onsuccess = () => {
      const note = getRequest.result as StoredNoteV2 | undefined
      if (!note) {
        reject(new Error(`Note not found: ${commitmentHex}`))
        return
      }

      note.leafIndex = leafIndex
      note.status = 'confirmed'
      const putRequest = store.put(note)
      putRequest.onsuccess = () => resolve()
      putRequest.onerror = () => reject(putRequest.error)
    }

    getRequest.onerror = () => reject(getRequest.error)
  })
}

/**
 * Get all unspent notes with leafIndex === -1 (pending relayer confirmation).
 */
export async function getPendingNotes(
  db: IDBDatabase,
  walletAddress: string,
  chainId: number,
  encKey?: CryptoKey
): Promise<StoredNoteV2[]> {
  if (!walletAddress) return []
  const addr = walletAddress.toLowerCase()

  const raw: StoredNoteV2[] = await new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('walletAddress')
    const request = index.getAll(addr)

    request.onsuccess = () => {
      const notes = (request.result as StoredNoteV2[]).filter(n =>
        !n.spent && n.chainId === chainId && n.leafIndex === -1
      )
      resolve(notes)
    }
    request.onerror = () => reject(request.error)
  })

  if (!encKey) return raw
  return Promise.all(raw.map(n => decryptFromStorage(n, encKey)))
}

/**
 * Update a note's compliance status after proof verification.
 */
export function updateNoteComplianceStatus(
  db: IDBDatabase,
  commitmentHex: string,
  complianceStatus: 'unverified' | 'verified' | 'inherited',
  complianceTxHash?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getRequest = store.get(commitmentHex)

    getRequest.onsuccess = () => {
      const note = getRequest.result as StoredNoteV2 | undefined
      if (!note) {
        resolve()
        return
      }

      note.complianceStatus = complianceStatus
      if (complianceTxHash) note.complianceTxHash = complianceTxHash
      const putRequest = store.put(note)
      putRequest.onsuccess = () => resolve()
      putRequest.onerror = () => reject(putRequest.error)
    }

    getRequest.onerror = () => reject(getRequest.error)
  })
}

/**
 * Delete all notes for a wallet address. Intended for testing/reset.
 */
export function deleteAllNotes(db: IDBDatabase, walletAddress: string): Promise<void> {
  const addr = walletAddress.toLowerCase()

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('walletAddress')
    const request = index.openCursor(addr)

    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      } else {
        resolve()
      }
    }

    request.onerror = () => reject(request.error)
  })
}
