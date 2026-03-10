/**
 * Backup client for cross-device note recovery.
 *
 * Encrypts UTXO notes with AES-256-GCM (keyed by spendingKey) and pushes
 * ciphertext to the relayer. On restore, the relayer returns encrypted blobs
 * that only the key holder can decrypt. The relayer never sees plaintext.
 */

import { deriveStorageKey } from './storage-crypto'
import { computeOwnerPubKey } from './commitment'
import type { StoredNoteV2 } from './storage'

// ── Types ───────────────────────────────────────────────────────────────────────

export type { StoredNoteV2 }

export interface BackupNote {
  commitment: string
  ciphertext: string
  iv: string
}

export interface AccountMetadata {
  encryptedPin: string
  recoveryHash: string
  keyVersion: number
}

export interface EncryptedAccountMetadata {
  ciphertext: string
  iv: string
}

export interface BackupRestoreResponse {
  notes: BackupNote[]
  account: EncryptedAccountMetadata | null
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

async function aesEncrypt(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)

  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  )

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuf),
    iv: arrayBufferToBase64(iv.buffer),
  }
}

async function aesDecrypt(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const ciphertextBuf = base64ToArrayBuffer(ciphertext)
  const ivBuf = base64ToArrayBuffer(iv)

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuf },
    key,
    ciphertextBuf
  )

  return new TextDecoder().decode(plaintext)
}

// ── Owner Hash ──────────────────────────────────────────────────────────────────

/**
 * Deterministic owner identifier: Poseidon(spendingKey) as 0x-prefixed hex.
 * Used as the server-side key for backup storage (never reveals spendingKey).
 */
export async function computeOwnerHash(spendingKey: bigint): Promise<string> {
  const pubKey = await computeOwnerPubKey(spendingKey)
  return '0x' + pubKey.toString(16).padStart(64, '0')
}

// ── Note Encryption ─────────────────────────────────────────────────────────────

/**
 * Encrypt a full StoredNoteV2 for backup. The entire note (all fields needed
 * for restore) is serialized to JSON and encrypted as a single AES-256-GCM blob.
 */
export async function encryptNoteForBackup(
  note: StoredNoteV2,
  spendingKey: bigint
): Promise<BackupNote> {
  const key = await deriveStorageKey(spendingKey)
  const plaintext = JSON.stringify(note)
  const { ciphertext, iv } = await aesEncrypt(plaintext, key)

  return {
    commitment: note.commitment,
    ciphertext,
    iv,
  }
}

/**
 * Decrypt a backup blob back into a StoredNoteV2.
 */
export async function decryptNoteFromBackup(
  backup: BackupNote,
  spendingKey: bigint
): Promise<StoredNoteV2> {
  const key = await deriveStorageKey(spendingKey)
  const plaintext = await aesDecrypt(backup.ciphertext, backup.iv, key)
  return JSON.parse(plaintext) as StoredNoteV2
}

// ── Account Metadata Encryption ─────────────────────────────────────────────────

export async function encryptAccountMetadata(
  meta: AccountMetadata,
  spendingKey: bigint
): Promise<EncryptedAccountMetadata> {
  const key = await deriveStorageKey(spendingKey)
  const plaintext = JSON.stringify(meta)
  return aesEncrypt(plaintext, key)
}

export async function decryptAccountMetadata(
  encrypted: EncryptedAccountMetadata,
  spendingKey: bigint
): Promise<AccountMetadata> {
  const key = await deriveStorageKey(spendingKey)
  const plaintext = await aesDecrypt(encrypted.ciphertext, encrypted.iv, key)
  return JSON.parse(plaintext) as AccountMetadata
}

// ── Relayer API ─────────────────────────────────────────────────────────────────

export async function pushNoteBackup(
  note: StoredNoteV2,
  spendingKey: bigint,
  chainId: number
): Promise<void> {
  const [ownerHash, backupNote] = await Promise.all([
    computeOwnerHash(spendingKey),
    encryptNoteForBackup(note, spendingKey),
  ])

  const res = await fetch('/api/v2/backup/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerHash, chainId, note: backupNote }),
  })

  if (!res.ok) {
    throw new Error(`Backup push failed: ${res.status}`)
  }
}

export async function pushAccountBackup(
  meta: AccountMetadata,
  spendingKey: bigint
): Promise<void> {
  const [ownerHash, account] = await Promise.all([
    computeOwnerHash(spendingKey),
    encryptAccountMetadata(meta, spendingKey),
  ])

  const res = await fetch('/api/v2/backup/account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerHash, account }),
  })

  if (!res.ok) {
    throw new Error(`Account backup failed: ${res.status}`)
  }
}

export async function markNoteSpentOnBackup(
  commitment: string,
  spendingKey: bigint
): Promise<void> {
  const ownerHash = await computeOwnerHash(spendingKey)

  const res = await fetch('/api/v2/backup/notes/spent', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerHash, commitment }),
  })

  if (!res.ok) {
    throw new Error(`Mark spent failed: ${res.status}`)
  }
}

export async function restoreFromRelayer(
  spendingKey: bigint
): Promise<BackupRestoreResponse> {
  const ownerHash = await computeOwnerHash(spendingKey)

  const res = await fetch(`/api/v2/backup/restore?owner=${ownerHash}`)

  if (!res.ok) {
    throw new Error(`Restore failed: ${res.status}`)
  }

  return res.json() as Promise<BackupRestoreResponse>
}
