import { webcrypto } from 'crypto'
if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
}

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  computeOwnerHash,
  encryptNoteForBackup,
  decryptNoteFromBackup,
  encryptAccountMetadata,
  decryptAccountMetadata,
  pushNoteBackup,
  pushAccountBackup,
  markNoteSpentOnBackup,
  restoreFromRelayer,
  type BackupNote,
  type AccountMetadata,
  type StoredNoteV2,
} from '../backup-client'

const TEST_SPENDING_KEY = 123456789012345678901234567890n
const OTHER_SPENDING_KEY = 987654321098765432109876543210n

function makeTestNote(overrides?: Partial<StoredNoteV2>): StoredNoteV2 {
  return {
    id: '0xabc123',
    walletAddress: '0xdeadbeef',
    chainId: 11155111,
    commitment: '0xcommit1',
    owner: '0x1111',
    amount: '0xde0b6b3a7640000',
    asset: '0x2222',
    blinding: '0x3333',
    leafIndex: 42,
    spent: false,
    createdAt: 1700000000000,
    status: 'confirmed',
    complianceStatus: 'verified',
    blockNumber: 100,
    ...overrides,
  }
}

describe('computeOwnerHash', () => {
  it('returns deterministic 0x-prefixed hex string', async () => {
    // #given
    const key = TEST_SPENDING_KEY

    // #when
    const hash1 = await computeOwnerHash(key)
    const hash2 = await computeOwnerHash(key)

    // #then
    expect(hash1).toBe(hash2)
    expect(hash1).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('different keys produce different hashes', async () => {
    // #when
    const hash1 = await computeOwnerHash(TEST_SPENDING_KEY)
    const hash2 = await computeOwnerHash(OTHER_SPENDING_KEY)

    // #then
    expect(hash1).not.toBe(hash2)
  })
})

describe('encryptNoteForBackup / decryptNoteFromBackup', () => {
  it('roundtrips all StoredNoteV2 fields', async () => {
    // #given
    const note = makeTestNote()

    // #when
    const backup = await encryptNoteForBackup(note, TEST_SPENDING_KEY)
    const restored = await decryptNoteFromBackup(backup, TEST_SPENDING_KEY)

    // #then
    expect(restored).toEqual(note)
  })

  it('backup contains commitment in plaintext', async () => {
    // #given
    const note = makeTestNote()

    // #when
    const backup = await encryptNoteForBackup(note, TEST_SPENDING_KEY)

    // #then — commitment is needed for server-side indexing
    expect(backup.commitment).toBe(note.commitment)
  })

  it('backup ciphertext does not contain plaintext secrets', async () => {
    // #given
    const note = makeTestNote({ blinding: '0xSECRET_BLINDING_VALUE' })

    // #when
    const backup = await encryptNoteForBackup(note, TEST_SPENDING_KEY)

    // #then
    expect(backup.ciphertext).not.toContain('SECRET_BLINDING_VALUE')
  })

  it('produces different ciphertext each time (random IV)', async () => {
    // #given
    const note = makeTestNote()

    // #when
    const backup1 = await encryptNoteForBackup(note, TEST_SPENDING_KEY)
    const backup2 = await encryptNoteForBackup(note, TEST_SPENDING_KEY)

    // #then
    expect(backup1.ciphertext).not.toBe(backup2.ciphertext)
    expect(backup1.iv).not.toBe(backup2.iv)
  })

  it('wrong key fails decryption', async () => {
    // #given
    const note = makeTestNote()
    const backup = await encryptNoteForBackup(note, TEST_SPENDING_KEY)

    // #then
    await expect(
      decryptNoteFromBackup(backup, OTHER_SPENDING_KEY)
    ).rejects.toThrow()
  })

  it('preserves optional fields when present', async () => {
    // #given
    const note = makeTestNote({
      encryptedData: 'some-encrypted',
      iv: 'some-iv',
      complianceTxHash: '0xtxhash',
    })

    // #when
    const backup = await encryptNoteForBackup(note, TEST_SPENDING_KEY)
    const restored = await decryptNoteFromBackup(backup, TEST_SPENDING_KEY)

    // #then
    expect(restored.encryptedData).toBe('some-encrypted')
    expect(restored.iv).toBe('some-iv')
    expect(restored.complianceTxHash).toBe('0xtxhash')
  })
})

describe('encryptAccountMetadata / decryptAccountMetadata', () => {
  it('roundtrips correctly', async () => {
    // #given
    const meta: AccountMetadata = {
      encryptedPin: 'encrypted-pin-data',
      recoveryHash: '0xrecoveryhash',
      keyVersion: 2,
    }

    // #when
    const encrypted = await encryptAccountMetadata(meta, TEST_SPENDING_KEY)
    const decrypted = await decryptAccountMetadata(encrypted, TEST_SPENDING_KEY)

    // #then
    expect(decrypted).toEqual(meta)
  })

  it('wrong key fails decryption', async () => {
    // #given
    const meta: AccountMetadata = {
      encryptedPin: 'pin',
      recoveryHash: '0xhash',
      keyVersion: 1,
    }
    const encrypted = await encryptAccountMetadata(meta, TEST_SPENDING_KEY)

    // #then
    await expect(
      decryptAccountMetadata(encrypted, OTHER_SPENDING_KEY)
    ).rejects.toThrow()
  })
})

describe('API functions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('pushNoteBackup', () => {
    it('POSTs encrypted note to /api/v2/backup/notes', async () => {
      // #given
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      )
      const note = makeTestNote()

      // #when
      await pushNoteBackup(note, TEST_SPENDING_KEY, 11155111)

      // #then
      expect(fetchSpy).toHaveBeenCalledOnce()
      const [url, init] = fetchSpy.mock.calls[0]
      expect(url).toBe('/api/v2/backup/notes')
      expect(init?.method).toBe('POST')
      const body = JSON.parse(init?.body as string)
      expect(body.chainId).toBe(11155111)
      expect(body.note.commitment).toBe(note.commitment)
      expect(body.note.ciphertext).toBeDefined()
      expect(body.ownerHash).toMatch(/^0x[0-9a-f]{64}$/)
    })

    it('throws on non-ok response', async () => {
      // #given
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('error', { status: 500 })
      )

      // #then
      await expect(
        pushNoteBackup(makeTestNote(), TEST_SPENDING_KEY, 11155111)
      ).rejects.toThrow()
    })
  })

  describe('pushAccountBackup', () => {
    it('POSTs encrypted metadata to /api/v2/backup/account', async () => {
      // #given
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      )
      const meta: AccountMetadata = {
        encryptedPin: 'pin',
        recoveryHash: '0xhash',
        keyVersion: 1,
      }

      // #when
      await pushAccountBackup(meta, TEST_SPENDING_KEY)

      // #then
      expect(fetchSpy).toHaveBeenCalledOnce()
      const [url, init] = fetchSpy.mock.calls[0]
      expect(url).toBe('/api/v2/backup/account')
      expect(init?.method).toBe('POST')
      const body = JSON.parse(init?.body as string)
      expect(body.ownerHash).toMatch(/^0x[0-9a-f]{64}$/)
      expect(body.account.ciphertext).toBeDefined()
    })
  })

  describe('markNoteSpentOnBackup', () => {
    it('PUTs to /api/v2/backup/notes/spent', async () => {
      // #given
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      )

      // #when
      await markNoteSpentOnBackup('0xcommit1', TEST_SPENDING_KEY)

      // #then
      expect(fetchSpy).toHaveBeenCalledOnce()
      const [url, init] = fetchSpy.mock.calls[0]
      expect(url).toBe('/api/v2/backup/notes/spent')
      expect(init?.method).toBe('PUT')
      const body = JSON.parse(init?.body as string)
      expect(body.commitment).toBe('0xcommit1')
      expect(body.ownerHash).toMatch(/^0x[0-9a-f]{64}$/)
    })
  })

  describe('restoreFromRelayer', () => {
    it('GETs from /api/v2/backup/restore with ownerHash', async () => {
      // #given
      const ownerHash = await computeOwnerHash(TEST_SPENDING_KEY)
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ notes: [], account: null }), { status: 200 })
      )

      // #when
      const result = await restoreFromRelayer(TEST_SPENDING_KEY)

      // #then
      expect(fetchSpy).toHaveBeenCalledOnce()
      const [url] = fetchSpy.mock.calls[0]
      expect(url).toBe(`/api/v2/backup/restore?owner=${ownerHash}`)
      expect(result.notes).toEqual([])
      expect(result.account).toBeNull()
    })

    it('throws on non-ok response', async () => {
      // #given
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('not found', { status: 404 })
      )

      // #then
      await expect(restoreFromRelayer(TEST_SPENDING_KEY)).rejects.toThrow()
    })
  })
})
