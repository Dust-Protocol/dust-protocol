import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Address } from 'viem'

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: vi.fn().mockReturnValue({
      readContract: vi.fn(),
    }),
  }
})

import {
  computeBucketHint,
  setFHEConfig,
  getFHEConfig,
  isFHEComplianceEnabled,
  checkFHEBridgeCache,
  resetFHEInstance,
} from '../fhe-compliance'
import { createPublicClient } from 'viem'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address
const ALICE = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as Address
const BOB = '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B' as Address

describe('FHE Compliance Client', () => {
  beforeEach(() => {
    setFHEConfig({
      chainId: 11155111,
      rpcUrl: 'https://eth-sepolia.public.blastapi.io',
      oracleAddress: ZERO_ADDRESS,
      bridgeAddress: ZERO_ADDRESS,
      poolStatsAddress: ZERO_ADDRESS,
      enabled: false,
    })
    resetFHEInstance()
    vi.clearAllMocks()
  })

  describe('computeBucketHint', () => {
    it('should return a value in range 0-255 for any address', () => {
      // #given
      const addresses: Address[] = [ALICE, BOB, ZERO_ADDRESS]

      // #when / #then
      for (const addr of addresses) {
        const bucket = computeBucketHint(addr)
        expect(bucket).toBeGreaterThanOrEqual(0)
        expect(bucket).toBeLessThanOrEqual(255)
      }
    })

    it('should be deterministic for the same address', () => {
      // #given
      const addr = ALICE

      // #when
      const first = computeBucketHint(addr)
      const second = computeBucketHint(addr)

      // #then
      expect(first).toBe(second)
    })

    it('should produce different buckets for different addresses', () => {
      // #given / #when
      const bucketAlice = computeBucketHint(ALICE)
      const bucketBob = computeBucketHint(BOB)

      // #then — keccak256 of distinct addresses yields distinct first bytes
      expect(bucketAlice).not.toBe(bucketBob)
    })
  })

  describe('setFHEConfig / getFHEConfig', () => {
    it('should store and retrieve full config', () => {
      // #given
      const oracle = '0x1111111111111111111111111111111111111111' as Address

      // #when
      setFHEConfig({ enabled: true, oracleAddress: oracle })

      // #then
      const config = getFHEConfig()
      expect(config.enabled).toBe(true)
      expect(config.oracleAddress).toBe(oracle)
    })

    it('should merge partial updates without clobbering other fields', () => {
      // #given
      setFHEConfig({ chainId: 42, enabled: true })

      // #when
      setFHEConfig({ rpcUrl: 'https://new-rpc.io' })

      // #then
      const config = getFHEConfig()
      expect(config.chainId).toBe(42)
      expect(config.enabled).toBe(true)
      expect(config.rpcUrl).toBe('https://new-rpc.io')
    })
  })

  describe('isFHEComplianceEnabled', () => {
    it('should return false when disabled', () => {
      // #given
      setFHEConfig({ enabled: false })

      // #then
      expect(isFHEComplianceEnabled()).toBe(false)
    })

    it('should return false when enabled but oracle is zero address', () => {
      // #given
      setFHEConfig({ enabled: true, oracleAddress: ZERO_ADDRESS })

      // #then
      expect(isFHEComplianceEnabled()).toBe(false)
    })

    it('should return true when enabled and oracle is set', () => {
      // #given
      const oracle = '0x1111111111111111111111111111111111111111' as Address

      // #when
      setFHEConfig({ enabled: true, oracleAddress: oracle })

      // #then
      expect(isFHEComplianceEnabled()).toBe(true)
    })
  })

  describe('checkFHEBridgeCache', () => {
    it('should return null when FHE compliance is not enabled', async () => {
      // #given — default config has enabled=false
      setFHEConfig({ enabled: false })

      // #when
      const result = await checkFHEBridgeCache(ALICE)

      // #then
      expect(result).toBeNull()
    })

    it('should return null when enabled but oracle is zero address', async () => {
      // #given
      setFHEConfig({ enabled: true, oracleAddress: ZERO_ADDRESS })

      // #when
      const result = await checkFHEBridgeCache(ALICE)

      // #then
      expect(result).toBeNull()
    })

    it('should query bridge contract when FHE is enabled', async () => {
      // #given
      const oracle = '0x1111111111111111111111111111111111111111' as Address
      const bridge = '0x2222222222222222222222222222222222222222' as Address
      setFHEConfig({ enabled: true, oracleAddress: oracle, bridgeAddress: bridge })

      const mockReadContract = vi.fn()
        .mockResolvedValueOnce(true)   // isScreened
        .mockResolvedValueOnce(false)  // isBlocked
      const mockClient = { readContract: mockReadContract } as unknown as import('viem').PublicClient

      // #when
      const result = await checkFHEBridgeCache(ALICE, mockClient)

      // #then
      expect(result).toEqual({ screened: true, isBlocked: false })
      expect(mockReadContract).toHaveBeenCalledTimes(2)
    })

    it('should return screened=false when address is not screened', async () => {
      // #given
      const oracle = '0x1111111111111111111111111111111111111111' as Address
      const bridge = '0x2222222222222222222222222222222222222222' as Address
      setFHEConfig({ enabled: true, oracleAddress: oracle, bridgeAddress: bridge })

      const mockReadContract = vi.fn().mockResolvedValueOnce(false) // isScreened = false
      const mockClient = { readContract: mockReadContract } as unknown as import('viem').PublicClient

      // #when
      const result = await checkFHEBridgeCache(ALICE, mockClient)

      // #then
      expect(result).toEqual({ screened: false, isBlocked: false })
      expect(mockReadContract).toHaveBeenCalledTimes(1)
    })

    it('should return null when bridge read throws', async () => {
      // #given
      const oracle = '0x1111111111111111111111111111111111111111' as Address
      const bridge = '0x2222222222222222222222222222222222222222' as Address
      setFHEConfig({ enabled: true, oracleAddress: oracle, bridgeAddress: bridge })

      const mockReadContract = vi.fn().mockRejectedValue(new Error('RPC failure'))
      const mockClient = { readContract: mockReadContract } as unknown as import('viem').PublicClient

      // #when
      const result = await checkFHEBridgeCache(ALICE, mockClient)

      // #then
      expect(result).toBeNull()
    })
  })
})
