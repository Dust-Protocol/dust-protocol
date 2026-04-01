import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { zeroAddress, type Address, type PublicClient } from 'viem'

import {
  FHE_BUCKET_COUNT,
  FHE_MAX_BUCKET_SIZE,
  FHE_GATEWAY_TIMEOUT_MS,
  FHE_POLL_INTERVAL_MS,
  FHE_MAX_POLL_ATTEMPTS,
  type FHEPoolStatsSnapshot,
  type FHEDecryptedPoolStats,
} from '../types'

const mockReadContract = vi.fn()

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: mockReadContract,
    })),
  }
})

const mockIsFHEComplianceEnabled = vi.fn(() => false)
const mockGetFHEConfig = vi.fn(() => ({
  chainId: 11155111,
  rpcUrl: 'https://eth-sepolia.public.blastapi.io',
  oracleAddress: zeroAddress as Address,
  bridgeAddress: zeroAddress as Address,
  poolStatsAddress: zeroAddress as Address,
  enabled: false,
}))

vi.mock('../fhe-compliance', () => ({
  isFHEComplianceEnabled: () => mockIsFHEComplianceEnabled(),
  getFHEConfig: () => mockGetFHEConfig(),
}))

import { getPoolStatsSnapshot, isAuditor } from '../fhe-pool-stats'

const TEST_ASSET: Address = '0x1234567890abcdef1234567890abcdef12345678'
const POOL_STATS_ADDRESS: Address = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const ORACLE_ADDRESS: Address = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

function enableFHEWithPoolStats(): void {
  mockIsFHEComplianceEnabled.mockReturnValue(true)
  mockGetFHEConfig.mockReturnValue({
    chainId: 11155111,
    rpcUrl: 'https://eth-sepolia.public.blastapi.io',
    oracleAddress: ORACLE_ADDRESS,
    bridgeAddress: zeroAddress as Address,
    poolStatsAddress: POOL_STATS_ADDRESS,
    enabled: true,
  })
}

describe('FHE Pool Stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFHEComplianceEnabled.mockReturnValue(false)
    mockGetFHEConfig.mockReturnValue({
      chainId: 11155111,
      rpcUrl: 'https://eth-sepolia.public.blastapi.io',
      oracleAddress: zeroAddress as Address,
      bridgeAddress: zeroAddress as Address,
      poolStatsAddress: zeroAddress as Address,
      enabled: false,
    })
  })

  describe('getPoolStatsSnapshot', () => {
    it('returns default snapshot when FHE is not enabled', async () => {
      const snapshot = await getPoolStatsSnapshot(TEST_ASSET)

      expect(snapshot).toEqual({
        asset: TEST_ASSET,
        depositCount: 0,
        withdrawalCount: 0,
        swapCount: 0,
        hasAuditAccess: false,
      })
      expect(mockReadContract).not.toHaveBeenCalled()
    })

    it('returns default snapshot when poolStatsAddress is zero', async () => {
      mockIsFHEComplianceEnabled.mockReturnValue(true)

      const snapshot = await getPoolStatsSnapshot(TEST_ASSET)

      expect(snapshot.asset).toBe(TEST_ASSET)
      expect(snapshot.depositCount).toBe(0)
      expect(snapshot.withdrawalCount).toBe(0)
      expect(snapshot.swapCount).toBe(0)
      expect(snapshot.hasAuditAccess).toBe(false)
      expect(mockReadContract).not.toHaveBeenCalled()
    })

    it('reads contract data when FHE is enabled with valid pool stats address', async () => {
      enableFHEWithPoolStats()
      mockReadContract
        .mockResolvedValueOnce([42n, 10n])
        .mockResolvedValueOnce(7n)

      const snapshot = await getPoolStatsSnapshot(TEST_ASSET)

      expect(snapshot).toEqual({
        asset: TEST_ASSET,
        depositCount: 42,
        withdrawalCount: 10,
        swapCount: 7,
        hasAuditAccess: false,
      })

      expect(mockReadContract).toHaveBeenCalledTimes(2)
      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: POOL_STATS_ADDRESS,
          functionName: 'getTransactionCounts',
          args: [TEST_ASSET],
        }),
      )
      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: POOL_STATS_ADDRESS,
          functionName: 'totalSwapCount',
        }),
      )
    })

    it('uses provided publicClient instead of creating a new one', async () => {
      enableFHEWithPoolStats()

      const clientReadContract = vi.fn()
        .mockResolvedValueOnce([5n, 3n])
        .mockResolvedValueOnce(1n)
      const externalClient = { readContract: clientReadContract } as unknown as PublicClient

      const snapshot = await getPoolStatsSnapshot(TEST_ASSET, externalClient)

      expect(snapshot.depositCount).toBe(5)
      expect(snapshot.withdrawalCount).toBe(3)
      expect(snapshot.swapCount).toBe(1)
      expect(clientReadContract).toHaveBeenCalledTimes(2)
      // The fallback mockReadContract from createPublicClient should not be used
      expect(mockReadContract).not.toHaveBeenCalled()
    })

    it('preserves asset address in the returned snapshot', async () => {
      const otherAsset: Address = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
      const snapshot = await getPoolStatsSnapshot(otherAsset)
      expect(snapshot.asset).toBe(otherAsset)
    })
  })

  describe('isAuditor', () => {
    it('returns false when FHE is not enabled', async () => {
      const result = await isAuditor(TEST_ASSET)
      expect(result).toBe(false)
      expect(mockReadContract).not.toHaveBeenCalled()
    })

    it('returns false when poolStatsAddress is zero', async () => {
      mockIsFHEComplianceEnabled.mockReturnValue(true)

      const result = await isAuditor(TEST_ASSET)
      expect(result).toBe(false)
      expect(mockReadContract).not.toHaveBeenCalled()
    })

    it('returns true for auditor address', async () => {
      enableFHEWithPoolStats()
      mockReadContract.mockResolvedValue(true)

      const result = await isAuditor(TEST_ASSET)

      expect(result).toBe(true)
      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: POOL_STATS_ADDRESS,
          functionName: 'isAuditor',
          args: [TEST_ASSET],
        }),
      )
    })

    it('returns false for non-auditor address', async () => {
      enableFHEWithPoolStats()
      mockReadContract.mockResolvedValue(false)

      const result = await isAuditor(TEST_ASSET)
      expect(result).toBe(false)
    })
  })
})

describe('FHE Types Constants', () => {
  it('has correct bucket count', () => {
    expect(FHE_BUCKET_COUNT).toBe(256)
  })

  it('has correct max bucket size', () => {
    expect(FHE_MAX_BUCKET_SIZE).toBe(100)
  })

  it('has correct gateway timeout', () => {
    expect(FHE_GATEWAY_TIMEOUT_MS).toBe(60_000)
  })

  it('has correct poll interval', () => {
    expect(FHE_POLL_INTERVAL_MS).toBe(3_000)
  })

  it('has correct max poll attempts', () => {
    expect(FHE_MAX_POLL_ATTEMPTS).toBe(20)
  })

  it('poll attempts * interval covers gateway timeout', () => {
    expect(FHE_MAX_POLL_ATTEMPTS * FHE_POLL_INTERVAL_MS).toBe(FHE_GATEWAY_TIMEOUT_MS)
  })
})

describe('FHE Type Shape Checks', () => {
  it('FHEPoolStatsSnapshot has required fields', () => {
    const snapshot: FHEPoolStatsSnapshot = {
      asset: zeroAddress,
      depositCount: 0,
      withdrawalCount: 0,
      swapCount: 0,
      hasAuditAccess: false,
    }

    expect(snapshot).toHaveProperty('asset')
    expect(snapshot).toHaveProperty('depositCount')
    expect(snapshot).toHaveProperty('withdrawalCount')
    expect(snapshot).toHaveProperty('swapCount')
    expect(snapshot).toHaveProperty('hasAuditAccess')
  })

  it('FHEDecryptedPoolStats extends FHEPoolStatsSnapshot with bigint fields', () => {
    const decrypted: FHEDecryptedPoolStats = {
      asset: zeroAddress,
      depositCount: 0,
      withdrawalCount: 0,
      swapCount: 0,
      hasAuditAccess: true,
      totalDeposits: 100n,
      totalWithdrawals: 50n,
      netBalance: 50n,
    }

    expect(typeof decrypted.totalDeposits).toBe('bigint')
    expect(typeof decrypted.totalWithdrawals).toBe('bigint')
    expect(typeof decrypted.netBalance).toBe('bigint')
  })
})
