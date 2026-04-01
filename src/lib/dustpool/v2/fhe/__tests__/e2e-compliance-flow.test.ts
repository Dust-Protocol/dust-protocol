import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import type { Address, PublicClient, WalletClient } from 'viem'

const {
  mockReadContract,
  mockWaitForTransactionReceipt,
  mockEncrypt,
  mockAddAddress,
  mockCreateEncryptedInput,
  mockCreateInstance,
} = vi.hoisted(() => {
  const mockEncrypt = vi.fn()
  const mockAddAddress = vi.fn().mockReturnValue({ encrypt: mockEncrypt })
  const mockCreateEncryptedInput = vi.fn().mockReturnValue({ addAddress: mockAddAddress })
  return {
    mockReadContract: vi.fn(),
    mockWaitForTransactionReceipt: vi.fn(),
    mockEncrypt,
    mockAddAddress,
    mockCreateEncryptedInput,
    mockCreateInstance: vi.fn(),
  }
})

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: vi.fn().mockReturnValue({
      readContract: mockReadContract,
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    }),
  }
})

vi.mock('fhevmjs', () => ({
  createInstance: mockCreateInstance,
}))

import {
  setFHEConfig,
  checkFHECompliance,
  checkFHEBridgeCache,
  computeBucketHint,
  resetFHEInstance,
} from '../fhe-compliance'
import type { FHEComplianceStatus } from '../types'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address
const ORACLE_ADDRESS = '0x1111111111111111111111111111111111111111' as Address
const BRIDGE_ADDRESS = '0x2222222222222222222222222222222222222222' as Address
const POOL_STATS_ADDRESS = '0x3333333333333333333333333333333333333333' as Address
const ALICE = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as Address

const TEST_TX_HASH = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
const TEST_REQUEST_ID = 42n
const FAKE_HANDLE = new Uint8Array([1, 2, 3])
const FAKE_PROOF = new Uint8Array([4, 5, 6])

function enableFHEConfig(): void {
  setFHEConfig({
    chainId: 11155111,
    rpcUrl: 'https://eth-sepolia.test',
    oracleAddress: ORACLE_ADDRESS,
    bridgeAddress: BRIDGE_ADDRESS,
    poolStatsAddress: POOL_STATS_ADDRESS,
    enabled: true,
  })
}

function createMockWalletClient(): WalletClient {
  return {
    account: { address: ALICE },
    writeContract: vi.fn().mockResolvedValue(TEST_TX_HASH),
  } as unknown as WalletClient
}

function setupFHEInstance(): void {
  mockCreateInstance.mockResolvedValue({
    createEncryptedInput: mockCreateEncryptedInput,
  })
  mockEncrypt.mockReturnValue({
    handles: [FAKE_HANDLE],
    inputProof: FAKE_PROOF,
  })
}

function makeReceiptWithRequestId(requestId: bigint): {
  status: string
  logs: { topics: string[]; data: string }[]
} {
  return {
    status: 'success',
    logs: [
      {
        topics: [
          '0xdeadbeef',
          '0x' + requestId.toString(16).padStart(64, '0'),
        ],
        data: '0x',
      },
    ],
  }
}

describe('FHE Compliance E2E Flow', () => {
  beforeEach(() => {
    setFHEConfig({
      chainId: 11155111,
      rpcUrl: 'https://eth-sepolia.test',
      oracleAddress: ZERO_ADDRESS,
      bridgeAddress: ZERO_ADDRESS,
      poolStatsAddress: ZERO_ADDRESS,
      enabled: false,
    })
    resetFHEInstance()

    // Reset only the per-test mocks, preserving vi.mock factory wiring
    mockReadContract.mockReset()
    mockWaitForTransactionReceipt.mockReset()
    mockEncrypt.mockReset()
    mockAddAddress.mockReset()
    mockCreateEncryptedInput.mockReset()
    mockCreateInstance.mockReset()

    // Re-wire chained mocks
    mockAddAddress.mockReturnValue({ encrypt: mockEncrypt })
    mockCreateEncryptedInput.mockReturnValue({ addAddress: mockAddAddress })

    // Default: polling resolves immediately as clear
    mockReadContract.mockResolvedValue([true, false])
  })

  describe('full deposit flow — clear address', () => {
    it('should complete the full FHE compliance check for a clean address', async () => {
      // #given
      enableFHEConfig()
      setupFHEInstance()
      const walletClient = createMockWalletClient()
      mockWaitForTransactionReceipt.mockResolvedValue(
        makeReceiptWithRequestId(TEST_REQUEST_ID),
      )
      mockReadContract.mockResolvedValue([true, false])

      const statuses: FHEComplianceStatus[] = []
      const onStatus = (s: FHEComplianceStatus) => statuses.push(s)

      // #when
      const result = await checkFHECompliance(ALICE, walletClient, onStatus)

      // #then
      expect(result.resolved).toBe(true)
      expect(result.isBlocked).toBe(false)
      expect(result.requestId).toBe(TEST_REQUEST_ID)
      expect(result.txHash).toBe(TEST_TX_HASH)
    })

    it('should emit correct status sequence for a clear address', async () => {
      // #given
      enableFHEConfig()
      setupFHEInstance()
      const walletClient = createMockWalletClient()
      mockWaitForTransactionReceipt.mockResolvedValue(
        makeReceiptWithRequestId(TEST_REQUEST_ID),
      )
      mockReadContract.mockResolvedValue([true, false])

      const statuses: FHEComplianceStatus[] = []
      const onStatus = (s: FHEComplianceStatus) => statuses.push(s)

      // #when
      await checkFHECompliance(ALICE, walletClient, onStatus)

      // #then
      expect(statuses).toHaveLength(4)
      expect(statuses[0]).toEqual({ status: 'encrypting' })
      expect(statuses[1]).toEqual({ status: 'submitting' })
      expect(statuses[2]).toEqual({ status: 'waiting-gateway', requestId: TEST_REQUEST_ID })
      expect(statuses[3]).toEqual({ status: 'resolved', isBlocked: false })
    })

    it('should pass correct bucket hint to writeContract', async () => {
      // #given
      enableFHEConfig()
      setupFHEInstance()
      const walletClient = createMockWalletClient()
      mockWaitForTransactionReceipt.mockResolvedValue(
        makeReceiptWithRequestId(TEST_REQUEST_ID),
      )
      mockReadContract.mockResolvedValue([true, false])

      const expectedBucket = computeBucketHint(ALICE)

      // #when
      await checkFHECompliance(ALICE, walletClient)

      // #then
      const writeCall = (walletClient.writeContract as Mock).mock.calls[0][0]
      expect(writeCall.address).toBe(ORACLE_ADDRESS)
      expect(writeCall.functionName).toBe('checkCompliance')
      expect(writeCall.args[2]).toBe(expectedBucket)
    })
  })

  describe('full deposit flow — blocked address', () => {
    it('should detect a sanctioned address as blocked', async () => {
      // #given
      enableFHEConfig()
      setupFHEInstance()
      const walletClient = createMockWalletClient()
      mockWaitForTransactionReceipt.mockResolvedValue(
        makeReceiptWithRequestId(TEST_REQUEST_ID),
      )
      mockReadContract.mockResolvedValue([true, true])

      const statuses: FHEComplianceStatus[] = []
      const onStatus = (s: FHEComplianceStatus) => statuses.push(s)

      // #when
      const result = await checkFHECompliance(ALICE, walletClient, onStatus)

      // #then
      expect(result.resolved).toBe(true)
      expect(result.isBlocked).toBe(true)
      expect(statuses[3]).toEqual({ status: 'resolved', isBlocked: true })
    })
  })

  describe('polling behavior', () => {
    let originalSetTimeout: typeof globalThis.setTimeout

    beforeEach(() => {
      // Replace setTimeout with immediate resolution to skip poll delays
      originalSetTimeout = globalThis.setTimeout
      globalThis.setTimeout = ((fn: TimerHandler, ..._args: unknown[]) =>
        originalSetTimeout(fn, 0)) as typeof globalThis.setTimeout
    })

    afterEach(() => {
      globalThis.setTimeout = originalSetTimeout
    })

    it('should poll multiple times until gateway resolves', async () => {
      // #given
      enableFHEConfig()
      setupFHEInstance()
      const walletClient = createMockWalletClient()
      mockWaitForTransactionReceipt.mockResolvedValue(
        makeReceiptWithRequestId(TEST_REQUEST_ID),
      )

      // Override default — first 2 not resolved, third resolved + clear, fourth is getResultHandle
      mockReadContract.mockReset()
      mockReadContract
        .mockResolvedValueOnce([false, false])
        .mockResolvedValueOnce([false, false])
        .mockResolvedValueOnce([true, false])
        .mockResolvedValueOnce('0x0000000000000000000000000000000000000000000000000000000000000001')

      // #when
      const result = await checkFHECompliance(ALICE, walletClient)

      // #then
      expect(result.resolved).toBe(true)
      expect(result.isBlocked).toBe(false)
      expect(mockReadContract).toHaveBeenCalledTimes(4)
    })

    it('should throw timeout when gateway never resolves', async () => {
      // #given
      enableFHEConfig()
      setupFHEInstance()
      const walletClient = createMockWalletClient()
      mockWaitForTransactionReceipt.mockResolvedValue(
        makeReceiptWithRequestId(TEST_REQUEST_ID),
      )

      // Override default — never resolve
      mockReadContract.mockReset()
      mockReadContract.mockResolvedValue([false, false])

      // #when / #then
      await expect(
        checkFHECompliance(ALICE, walletClient),
      ).rejects.toThrow('timed out')
    })
  })

  describe('error paths', () => {
    it('should throw when FHE compliance is not enabled', async () => {
      // #given — default config has enabled=false
      const walletClient = createMockWalletClient()

      // #when / #then
      await expect(
        checkFHECompliance(ALICE, walletClient),
      ).rejects.toThrow('FHE compliance is not enabled')
    })

    it('should throw when transaction reverts', async () => {
      // #given
      enableFHEConfig()
      setupFHEInstance()
      const walletClient = createMockWalletClient()
      mockWaitForTransactionReceipt.mockResolvedValue({
        status: 'reverted',
        logs: [],
      })

      // #when / #then
      await expect(
        checkFHECompliance(ALICE, walletClient),
      ).rejects.toThrow('reverted')
    })

    it('should throw when no requestId found in logs', async () => {
      // #given
      enableFHEConfig()
      setupFHEInstance()
      const walletClient = createMockWalletClient()
      mockWaitForTransactionReceipt.mockResolvedValue({
        status: 'success',
        logs: [],
      })

      // #when / #then
      await expect(
        checkFHECompliance(ALICE, walletClient),
      ).rejects.toThrow('Could not extract requestId')
    })

    it('should throw when wallet has no account', async () => {
      // #given
      enableFHEConfig()
      setupFHEInstance()
      const walletClient = {
        account: undefined,
        writeContract: vi.fn(),
      } as unknown as WalletClient

      // #when / #then
      await expect(
        checkFHECompliance(ALICE, walletClient),
      ).rejects.toThrow('Wallet not connected')
    })
  })

  describe('bridge cache integration', () => {
    it('should return null when bridge cache has no entry', async () => {
      // #given
      enableFHEConfig()
      const mockClient = {
        readContract: vi.fn().mockResolvedValueOnce(false),
      } as unknown as PublicClient

      // #when
      const result = await checkFHEBridgeCache(ALICE, mockClient)

      // #then
      expect(result).toEqual({ screened: false, isBlocked: false })
    })

    it('should return screened + blocked status from bridge cache', async () => {
      // #given
      enableFHEConfig()
      const mockClient = {
        readContract: vi.fn()
          .mockResolvedValueOnce(true)  // isScreened
          .mockResolvedValueOnce(true), // isBlocked
      } as unknown as PublicClient

      // #when
      const result = await checkFHEBridgeCache(ALICE, mockClient)

      // #then
      expect(result).toEqual({ screened: true, isBlocked: true })
    })

    it('should return null when FHE is disabled', async () => {
      // #given — default config has enabled=false

      // #when
      const result = await checkFHEBridgeCache(ALICE)

      // #then
      expect(result).toBeNull()
    })
  })

  describe('FHE instance lifecycle', () => {
    it('should create fhevmjs instance with correct chain params', async () => {
      // #given
      enableFHEConfig()
      setupFHEInstance()
      const walletClient = createMockWalletClient()
      mockWaitForTransactionReceipt.mockResolvedValue(
        makeReceiptWithRequestId(TEST_REQUEST_ID),
      )
      mockReadContract.mockResolvedValue([true, false])

      // #when
      await checkFHECompliance(ALICE, walletClient)

      // #then
      expect(mockCreateInstance).toHaveBeenCalledWith({
        chainId: 11155111,
        networkUrl: 'https://eth-sepolia.test',
      })
    })

    it('should scope encryption to oracle address and sender', async () => {
      // #given
      enableFHEConfig()
      setupFHEInstance()
      const walletClient = createMockWalletClient()
      mockWaitForTransactionReceipt.mockResolvedValue(
        makeReceiptWithRequestId(TEST_REQUEST_ID),
      )
      mockReadContract.mockResolvedValue([true, false])

      // #when
      await checkFHECompliance(ALICE, walletClient)

      // #then
      expect(mockCreateEncryptedInput).toHaveBeenCalledWith(ORACLE_ADDRESS, ALICE)
      expect(mockAddAddress).toHaveBeenCalledWith(ALICE)
      expect(mockEncrypt).toHaveBeenCalled()
    })
  })
})
