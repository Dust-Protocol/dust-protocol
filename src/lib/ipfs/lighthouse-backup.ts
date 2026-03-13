/**
 * Lighthouse IPFS encrypted note backup for cross-device recovery.
 *
 * Encrypts notes locally with AES-256-GCM (via storage-crypto.ts) then uploads
 * the ciphertext blob to Lighthouse IPFS. Lighthouse stores opaque bytes — it
 * never sees plaintext. On restore, the client fetches ciphertext by CID and
 * decrypts locally with the same CryptoKey.
 *
 * Uses plain Lighthouse upload API (not their encryption layer) since we
 * already handle encryption ourselves.
 *
 * Env: NEXT_PUBLIC_LIGHTHOUSE_API_KEY (optional — falls back to public
 * gateway fetch-only mode for testing).
 */

import type { StoredNoteV2 } from '../dustpool/v2/storage'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface LighthouseBackupResult {
  cid: string
  gatewayUrl: string
  noteCount: number
  timestamp: number
}

interface LighthouseUploadResponse {
  Hash: string
  Name: string
  Size: string
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const LIGHTHOUSE_UPLOAD_URL = 'https://node.lighthouse.storage/api/v0/add'
const LIGHTHOUSE_GATEWAY = 'https://gateway.lighthouse.storage/ipfs'
// Backup format version — bump on breaking schema changes
const BACKUP_FORMAT_VERSION = 1

// ─── Helpers ────────────────────────────────────────────────────────────────────

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

function getLighthouseApiKey(): string | null {
  return typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY ?? null)
    : null
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Encrypt notes with AES-256-GCM and upload ciphertext to Lighthouse IPFS.
 *
 * The entire note array is serialized, encrypted as a single blob, and wrapped
 * in an envelope with version + metadata. Lighthouse only stores ciphertext.
 *
 * Requires NEXT_PUBLIC_LIGHTHOUSE_API_KEY env var for upload.
 */
export async function backupNotesToLighthouse(
  notes: StoredNoteV2[],
  encryptionKey: CryptoKey,
  walletAddress: string
): Promise<LighthouseBackupResult> {
  const apiKey = getLighthouseApiKey()
  if (!apiKey) {
    throw new Error(
      'NEXT_PUBLIC_LIGHTHOUSE_API_KEY is required for Lighthouse uploads'
    )
  }

  const timestamp = Date.now()

  const plaintext = JSON.stringify(notes)
  const { ciphertext, iv } = await aesEncrypt(plaintext, encryptionKey)

  const envelope = JSON.stringify({
    version: BACKUP_FORMAT_VERSION,
    walletAddress: walletAddress.toLowerCase(),
    noteCount: notes.length,
    timestamp,
    ciphertext,
    iv,
  })

  const blob = new Blob([envelope], { type: 'application/octet-stream' })
  const formData = new FormData()
  formData.append('file', blob, `dust-backup-${timestamp}.enc`)

  const response = await fetch(LIGHTHOUSE_UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(
      `Lighthouse upload failed: ${response.status} ${response.statusText} ${body}`
    )
  }

  const result = (await response.json()) as LighthouseUploadResponse
  const cid = result.Hash

  return {
    cid,
    gatewayUrl: `${LIGHTHOUSE_GATEWAY}/${cid}`,
    noteCount: notes.length,
    timestamp,
  }
}

/**
 * Fetch an encrypted backup from Lighthouse gateway and decrypt it.
 *
 * Works without an API key — gateway reads are public.
 */
export async function restoreFromLighthouse(
  cid: string,
  encryptionKey: CryptoKey
): Promise<StoredNoteV2[]> {
  const url = `${LIGHTHOUSE_GATEWAY}/${cid}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Lighthouse fetch failed: ${response.status} ${response.statusText}`
    )
  }

  const envelope = (await response.json()) as {
    version: number
    ciphertext: string
    iv: string
  }

  if (envelope.version !== BACKUP_FORMAT_VERSION) {
    throw new Error(`Unsupported backup version: ${envelope.version}`)
  }

  const plaintext = await aesDecrypt(
    envelope.ciphertext,
    envelope.iv,
    encryptionKey
  )

  return JSON.parse(plaintext) as StoredNoteV2[]
}

/**
 * Deterministic localStorage key for persisting the latest backup CID.
 *
 * Scoped by wallet + chain so each account/chain pair tracks its own backup.
 * Format: dust-v2-backup-{address}-{chainId}
 */
export function getBackupManifestKey(
  walletAddress: string,
  chainId: number
): string {
  return `dust-v2-backup-${walletAddress.toLowerCase()}-${chainId}`
}
