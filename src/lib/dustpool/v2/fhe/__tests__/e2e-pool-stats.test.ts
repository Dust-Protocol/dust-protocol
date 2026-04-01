import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Address, PublicClient } from 'viem'

import { setFHEConfig, resetFHEInstance } from '../fhe-compliance'
import {
  FHE_BUCKET_COUNT,
  FHE_MAX_BUCKET_SIZE,
  FHE_GATEWAY_TIMEOUT_MS,
  FHE_POLL_INTERVAL_MS,
  FHE_MAX_POLL_ATTEMPTS,
} from '../types'

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: vi.fn().mockReturnValue({
      readContract: vi.fn(),
    }),
  }
})

import { getPoolStatsSnapshot, isAuditor } from '../fhe-pool-stats'
import { createPublicClient } from 'viem'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address
const POOL_STATS = '0xAA00000000000000000000000000000000000001' as Address
const ORACLE = '0xBB00000000000000000000000000000000000002' as Address
const BRIDGE = '0xCC00000000000000000000000000000000000003' as Address
const ETH_ASSET = ZERO_ADDRESS
const ALICE = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as Address

function enableFHE(): void {
  setFHEConfig({
    chainId: 11155111,
    rpcUrl: 'https://eth-sepolia.public.blastapi.io',
    oracleAddress: ORACLE,
    bridgeAddress: BRIDGE,
    poolStatsAddress: POOL_STATS,
    enabled: true,
  })
}

function disableFHE(): void {
  setFHEConfig({
    chainId: 11155111,
    rpcUrl: 'https://eth-sepolia.public.blastapi.io',
    oracleAddress: ZERO_ADDRESS,
    bridgeAddress: ZERO_ADDRESS,
    poolStatsAddress: ZERO_ADDRESS,
    enabled: false,
  })
}

describe('FHE Pool Stats E2E', () => {
  beforeEach(() => {
    disableFHE()
    resetFHEInstance()
    vi.clearAllMocks()
  })

  describe('getPoolStatsSnapshot', () => {
    it('should return defaults when FHE is disabled', async () => {
      // #given
      disableFHE()

      // #when
      const snapshot = await getPoolStatsSnapshot(ETH_ASSET)

      // #then
      expect(snapshot).toEqual({
        asset: ETH_ASSET,
        depositCount: 0,
        withdrawalCount: 0,
        swapCount: 0,
        hasAuditAccess: false,
      })
    })

    it('should return defaults when enabled but poolStatsAddress is zero', async () => {
      // #given
      setFHEConfig({
        enabled: true,
        oracleAddress: ORACLE,
        poolStatsAddress: ZERO_ADDRESS,
      })

      // #when
      const snapshot = await getPoolStatsSnapshot(ETH_ASSET)

      // #then
      expect(snapshot.depositCount).toBe(0)
      expect(snapshot.withdrawalCount).toBe(0)
      expect(snapshot.swapCount).toBe(0)
    })

    it('should read contract values when FHE is enabled', async () => {
      // #given
      enableFHE()

      const mockReadContract = vi.fn()
        .mockResolvedValueOnce([42n, 17n] as [bigint, bigint])
        .mockResolvedValueOnce(5n)
      const mockClient = { readContract: mockReadContract } as unknown as PublicClient

      // #when
      const snapshot = await getPoolStatsSnapshot(ETH_ASSET, mockClient)

      // #then
      expect(snapshot.asset).toBe(ETH_ASSET)
      expect(snapshot.depositCount).toBe(42)
      expect(snapshot.withdrawalCount).toBe(17)
      expect(snapshot.swapCount).toBe(5)
      expect(snapshot.hasAuditAccess).toBe(false)
    })

    it('should call getTransactionCounts with the correct asset', async () => {
      // #given
      enableFHE()

      const mockReadContract = vi.fn()
        .mockResolvedValueOnce([0n, 0n] as [bigint, bigint])
        .mockResolvedValueOnce(0n)
      const mockClient = { readContract: mockReadContract } as unknown as PublicClient

      // #when
      await getPoolStatsSnapshot(ALICE, mockClient)

      // #then
      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: POOL_STATS,
          functionName: 'getTransactionCounts',
          args: [ALICE],
        }),
      )
    })

    it('should use createPublicClient when no client is provided', async () => {
      // #given
      enableFHE()

      const mockReadContract = vi.fn()
        .mockResolvedValueOnce([1n, 2n] as [bigint, bigint])
        .mockResolvedValueOnce(3n)
      vi.mocked(createPublicClient).mockReturnValue({
        readContract: mockReadContract,
      } as unknown as ReturnType<typeof createPublicClient>)

      // #when
      const snapshot = await getPoolStatsSnapshot(ETH_ASSET)

      // #then
      expect(createPublicClient).toHaveBeenCalled()
      expect(snapshot.depositCount).toBe(1)
    })
  })

  describe('isAuditor', () => {
    it('should return false when FHE is disabled', async () => {
      // #given
      disableFHE()

      // #when
      const result = await isAuditor(ALICE)

      // #then
      expect(result).toBe(false)
    })

    it('should return false when poolStatsAddress is zero', async () => {
      // #given
      setFHEConfig({
        enabled: true,
        oracleAddress: ORACLE,
        poolStatsAddress: ZERO_ADDRESS,
      })

      // #when
      const result = await isAuditor(ALICE)

      // #then
      expect(result).toBe(false)
    })

    it('should return true when contract reports auditor', async () => {
      // #given
      enableFHE()

      const mockReadContract = vi.fn().mockResolvedValueOnce(true)
      const mockClient = { readContract: mockReadContract } as unknown as PublicClient

      // #when
      const result = await isAuditor(ALICE, mockClient)

      // #then
      expect(result).toBe(true)
      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: POOL_STATS,
          functionName: 'isAuditor',
          args: [ALICE],
        }),
      )
    })

    it('should return false when contract reports non-auditor', async () => {
      // #given
      enableFHE()

      const mockReadContract = vi.fn().mockResolvedValueOnce(false)
      const mockClient = { readContract: mockReadContract } as unknown as PublicClient

      // #when
      const result = await isAuditor(ALICE, mockClient)

      // #then
      expect(result).toBe(false)
    })
  })

  describe('constants', () => {
    it('should have correct bucket count', () => {
      expect(FHE_BUCKET_COUNT).toBe(256)
    })

    it('should have correct max bucket size', () => {
      expect(FHE_MAX_BUCKET_SIZE).toBe(100)
    })

    it('should have correct gateway timeout', () => {
      expect(FHE_GATEWAY_TIMEOUT_MS).toBe(60_000)
    })

    it('should have correct poll interval', () => {
      expect(FHE_POLL_INTERVAL_MS).toBe(3_000)
    })

    it('should have correct max poll attempts', () => {
      expect(FHE_MAX_POLL_ATTEMPTS).toBe(20)
    })
  })
})
