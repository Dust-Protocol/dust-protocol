import fs from 'fs'
import path from 'path'

const BACKUP_DIR = process.env.BACKUP_STORE_DIR || '/tmp/dust-v2-backups'

interface StoredBackupNote {
  commitment: string
  ciphertext: string
  iv: string
  chainId: number
  spent: boolean
  updatedAt: number
}

interface StoredAccount {
  ciphertext: string
  iv: string
  updatedAt: number
}

interface OwnerStore {
  notes: StoredBackupNote[]
  account: StoredAccount | null
}

function ensureDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }
}

function ownerPath(ownerHash: string): string {
  // Prevent path traversal — strip everything except hex chars and 'x' prefix
  const safe = ownerHash.replace(/[^a-f0-9x]/gi, '')
  return path.join(BACKUP_DIR, `${safe}.json`)
}

function loadOwner(ownerHash: string): OwnerStore {
  const p = ownerPath(ownerHash)
  if (!fs.existsSync(p)) return { notes: [], account: null }
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

function saveOwner(ownerHash: string, store: OwnerStore): void {
  ensureDir()
  fs.writeFileSync(ownerPath(ownerHash), JSON.stringify(store))
}

export function upsertNote(ownerHash: string, commitment: string, ciphertext: string, iv: string, chainId: number): void {
  const store = loadOwner(ownerHash)
  const idx = store.notes.findIndex(n => n.commitment === commitment)
  const entry: StoredBackupNote = { commitment, ciphertext, iv, chainId, spent: false, updatedAt: Date.now() }
  if (idx >= 0) store.notes[idx] = entry
  else store.notes.push(entry)
  saveOwner(ownerHash, store)
}

export function markSpent(ownerHash: string, commitment: string): void {
  const store = loadOwner(ownerHash)
  const note = store.notes.find(n => n.commitment === commitment)
  if (note) {
    note.spent = true
    note.updatedAt = Date.now()
    saveOwner(ownerHash, store)
  }
}

export function upsertAccount(ownerHash: string, ciphertext: string, iv: string): void {
  const store = loadOwner(ownerHash)
  store.account = { ciphertext, iv, updatedAt: Date.now() }
  saveOwner(ownerHash, store)
}

export function getRestore(ownerHash: string): {
  notes: Array<{ commitment: string; ciphertext: string; iv: string }>
  account: { ciphertext: string; iv: string } | null
} {
  const store = loadOwner(ownerHash)
  return {
    notes: store.notes.map(n => ({ commitment: n.commitment, ciphertext: n.ciphertext, iv: n.iv })),
    account: store.account ? { ciphertext: store.account.ciphertext, iv: store.account.iv } : null,
  }
}
