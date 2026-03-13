import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash } from 'crypto'

import {
  pinToIPFS,
  pinFileToIPFS,
  getIPFSGatewayURL,
} from '../storacha-client'
import {
  getArtifactURL,
  verifyArtifactIntegrity,
  getPinnedCircuits,
  ZK_ARTIFACT_MANIFEST,
} from '../zk-artifact-manifest'
import {
  backupNotesToLighthouse,
  restoreFromLighthouse,
  getBackupManifestKey,
} from '../lighthouse-backup'
import type { StoredNoteV2 } from '../../dustpool/v2/storage'

// ─── Helpers ────────────────────────────────────────────────────────────────────

function makeMockNote(overrides: Partial<StoredNoteV2> = {}): StoredNoteV2 {
  return {
    id: '0xabc123',
    walletAddress: '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
    chainId: 11155111,
    commitment: '0xabc123',
    owner: '0x111',
    amount: '0x1000',
    asset: '0x222',
    blinding: '0x333',
    leafIndex: 0,
    spent: false,
    createdAt: Date.now(),
    ...overrides,
  }
}

async function generateAESKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

// ─── storacha-client.ts ─────────────────────────────────────────────────────────

describe('storacha-client', () => {
  beforeEach(() => {
    delete process.env.IPFS_PROVIDER
    delete process.env.IPFS_GATEWAY_URL
    delete process.env.PINATA_API_KEY
    delete process.env.PINATA_SECRET_KEY
  })

  describe('pinToIPFS', () => {
    it('returns CID with local provider (default)', async () => {
      // #given
      const data = { foo: 'bar' }

      // #when
      const result = await pinToIPFS(data)

      // #then
      expect(result.cid).toMatch(/^bafybeig[a-f0-9]{46}$/)
      expect(result.provider).toBe('local')
      expect(result.gatewayUrl).toContain(result.cid)
    })

    it('returns consistent CID for same data', async () => {
      // #given
      const data = { deterministic: true, value: 42 }

      // #when
      const first = await pinToIPFS(data)
      const second = await pinToIPFS(data)

      // #then — local provider is deterministic
      expect(first.cid).toBe(second.cid)
    })

    it('calls fetch with pinata provider', async () => {
      // #given
      process.env.IPFS_PROVIDER = 'pinata'
      process.env.PINATA_API_KEY = 'test-key'
      process.env.PINATA_SECRET_KEY = 'test-secret'

      const fakeCID = 'QmTestHash123'
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ IpfsHash: fakeCID }),
      })
      vi.stubGlobal('fetch', mockFetch)

      // #when
      const result = await pinToIPFS({ hello: 'world' })

      // #then
      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toBe('https://api.pinata.cloud/pinning/pinJSONToIPFS')
      expect(opts.headers.pinata_api_key).toBe('test-key')
      expect(opts.headers.pinata_secret_api_key).toBe('test-secret')
      expect(result.cid).toBe(fakeCID)
      expect(result.provider).toBe('pinata')

      vi.unstubAllGlobals()
    })
  })

  describe('pinFileToIPFS', () => {
    it('works with Buffer using local provider', async () => {
      // #given
      const content = Buffer.from('binary file content')

      // #when
      const result = await pinFileToIPFS(content, 'test.bin')

      // #then
      expect(result.cid).toMatch(/^bafybeig/)
      expect(result.provider).toBe('local')
      expect(result.gatewayUrl).toContain(result.cid)
    })
  })

  describe('getIPFSGatewayURL', () => {
    it('constructs correct URL with default gateway', () => {
      // #given
      const cid = 'bafybeigtest123'

      // #when
      const url = getIPFSGatewayURL(cid)

      // #then
      expect(url).toBe(`https://gateway.pinata.cloud/ipfs/${cid}`)
    })

    it('uses custom gateway from env', () => {
      // #given
      process.env.IPFS_GATEWAY_URL = 'https://custom.gateway.io/ipfs'
      const cid = 'bafybeigtest456'

      // #when
      const url = getIPFSGatewayURL(cid)

      // #then
      expect(url).toBe(`https://custom.gateway.io/ipfs/${cid}`)
    })
  })
})

// ─── zk-artifact-manifest.ts ────────────────────────────────────────────────────

describe('zk-artifact-manifest', () => {
  describe('getArtifactURL', () => {
    it('returns local path when CID is null', () => {
      // #given — all CIDs in manifest are null by default

      // #when
      const url = getArtifactURL('v1-pool', 'wasm')

      // #then — falls back to wasmPath
      expect(url).toBe('/zk/DustPoolWithdraw.wasm')
    })

    it('returns gateway URL when CID is set', () => {
      // #given — temporarily set a CID
      const original = ZK_ARTIFACT_MANIFEST['v1-pool'].wasmCID
      ZK_ARTIFACT_MANIFEST['v1-pool'].wasmCID = 'bafybeigfakecid123'

      try {
        // #when
        const url = getArtifactURL('v1-pool', 'wasm')

        // #then
        expect(url).toContain('bafybeigfakecid123')
        expect(url).toMatch(/^https:\/\//)
      } finally {
        ZK_ARTIFACT_MANIFEST['v1-pool'].wasmCID = original
      }
    })
  })

  describe('verifyArtifactIntegrity', () => {
    it('returns true for matching hash', async () => {
      // #given — build a CID that contains the first 32 hex chars of the SHA-256
      const data = new TextEncoder().encode('test artifact data')
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      const fakeCID = `bafybeig${hashHex.slice(0, 32)}remaining`

      // #when
      const result = await verifyArtifactIntegrity(data.buffer as ArrayBuffer, fakeCID)

      // #then
      expect(result).toBe(true)
    })

    it('returns false for mismatched hash', async () => {
      // #given
      const data = new TextEncoder().encode('real data')
      const fakeCID = 'bafybeig00000000000000000000000000000000nomatch'

      // #when
      const result = await verifyArtifactIntegrity(data.buffer as ArrayBuffer, fakeCID)

      // #then
      expect(result).toBe(false)
    })
  })

  describe('getPinnedCircuits', () => {
    it('returns empty when no CIDs are set', () => {
      // #given — default manifest has all null CIDs

      // #when
      const pinned = getPinnedCircuits()

      // #then
      expect(pinned).toEqual([])
    })

    it('returns circuit name when at least one CID is set', () => {
      // #given
      const original = ZK_ARTIFACT_MANIFEST['v2-transaction'].wasmCID
      ZK_ARTIFACT_MANIFEST['v2-transaction'].wasmCID = 'bafybeigsome'

      try {
        // #when
        const pinned = getPinnedCircuits()

        // #then
        expect(pinned).toContain('v2-transaction')
      } finally {
        ZK_ARTIFACT_MANIFEST['v2-transaction'].wasmCID = original
      }
    })
  })
})

// ─── lighthouse-backup.ts ───────────────────────────────────────────────────────

describe('lighthouse-backup', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY
  })

  describe('backupNotesToLighthouse', () => {
    it('encrypts and uploads (mock fetch)', async () => {
      // #given
      process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY = 'test-lh-key'
      const key = await generateAESKey()
      const notes = [makeMockNote(), makeMockNote({ id: '0xdef456', commitment: '0xdef456' })]
      const fakeCID = 'QmLighthouseTest123'

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ Hash: fakeCID, Name: 'backup.enc', Size: '1024' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      // #when
      const result = await backupNotesToLighthouse(notes, key, '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF')

      // #then
      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toBe('https://node.lighthouse.storage/api/v0/add')
      expect(opts.headers.Authorization).toBe('Bearer test-lh-key')
      expect(result.cid).toBe(fakeCID)
      expect(result.noteCount).toBe(2)
      expect(result.gatewayUrl).toContain(fakeCID)
      expect(result.timestamp).toBeGreaterThan(0)
    })

    it('throws without API key', async () => {
      // #given
      delete process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY
      const key = await generateAESKey()

      // #when / #then
      await expect(
        backupNotesToLighthouse([], key, '0xabc')
      ).rejects.toThrow(/NEXT_PUBLIC_LIGHTHOUSE_API_KEY/)
    })
  })

  describe('restoreFromLighthouse', () => {
    it('fetches and decrypts (mock fetch)', async () => {
      // #given — encrypt notes the same way the backup function does
      const key = await generateAESKey()
      const notes = [makeMockNote()]
      const plaintext = JSON.stringify(notes)

      const iv = crypto.getRandomValues(new Uint8Array(12))
      const ciphertextBuf = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(plaintext)
      )

      // base64 encode helpers (matching lighthouse-backup internals)
      const toBase64 = (buf: ArrayBuffer): string => {
        const bytes = new Uint8Array(buf)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        return btoa(binary)
      }

      const envelope = {
        version: 1,
        walletAddress: '0xdeadbeef',
        noteCount: 1,
        timestamp: Date.now(),
        ciphertext: toBase64(ciphertextBuf),
        iv: toBase64(iv.buffer),
      }

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => envelope,
      })
      vi.stubGlobal('fetch', mockFetch)

      // #when
      const restored = await restoreFromLighthouse('QmTestRestore', key)

      // #then
      expect(mockFetch).toHaveBeenCalledOnce()
      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://gateway.lighthouse.storage/ipfs/QmTestRestore'
      )
      expect(restored).toHaveLength(1)
      expect(restored[0].id).toBe(notes[0].id)
      expect(restored[0].commitment).toBe(notes[0].commitment)
    })

    it('throws on unsupported backup version', async () => {
      // #given
      const key = await generateAESKey()
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: 99, ciphertext: '', iv: '' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      // #when / #then
      await expect(
        restoreFromLighthouse('QmBadVersion', key)
      ).rejects.toThrow(/Unsupported backup version: 99/)
    })

    it('throws on fetch failure', async () => {
      // #given
      const key = await generateAESKey()
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })
      vi.stubGlobal('fetch', mockFetch)

      // #when / #then
      await expect(
        restoreFromLighthouse('QmMissing', key)
      ).rejects.toThrow(/Lighthouse fetch failed: 404/)
    })
  })

  describe('getBackupManifestKey', () => {
    it('returns correct format', () => {
      // #given
      const wallet = '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF'
      const chainId = 11155111

      // #when
      const key = getBackupManifestKey(wallet, chainId)

      // #then — lowercase address, scoped by chain
      expect(key).toBe('dust-v2-backup-0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef-11155111')
    })

    it('lowercases the wallet address', () => {
      // #given
      const upper = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12'

      // #when
      const key = getBackupManifestKey(upper, 1)

      // #then
      expect(key).toBe('dust-v2-backup-0xabcdef1234567890abcdef1234567890abcdef12-1')
    })
  })
})
