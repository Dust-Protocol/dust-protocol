import { describe, it, expect } from 'vitest'
import {
  ETH_ADDRESS,
  USDC_ADDRESS_SEPOLIA,
  SUPPORTED_TOKENS,
  getUSDCAddress,
  RELAYER_FEE_BPS,
  POOL_FEE,
  POOL_TICK_SPACING,
  SWAP_GAS_LIMIT,
  TX_RECEIPT_TIMEOUT,
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_SLIPPAGE_MULTIPLIER,
  RPC_LOG_BATCH_SIZE,
  MERKLE_TREE_DEPTH,
  MAX_DEPOSITS,
} from '../constants'

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

describe('SwapToken address types (L1 fix)', () => {
  it('ETH address matches 0x-prefixed 40-hex pattern', () => {
    // #given SUPPORTED_TOKENS.ETH
    // #when checking address format
    // #then matches valid Ethereum address
    expect(SUPPORTED_TOKENS.ETH.address).toMatch(ADDRESS_RE)
  })

  it('USDC address matches 0x-prefixed 40-hex pattern', () => {
    // #given SUPPORTED_TOKENS.USDC
    // #when checking address format
    // #then matches valid Ethereum address
    expect(SUPPORTED_TOKENS.USDC.address).toMatch(ADDRESS_RE)
  })

  it('ETH address is zero address', () => {
    // #given ETH is native token
    // #when checking address
    // #then is zero address
    expect(SUPPORTED_TOKENS.ETH.address).toBe(ETH_ADDRESS)
    expect(ETH_ADDRESS).toBe('0x0000000000000000000000000000000000000000')
  })

  it('USDC address matches USDC_ADDRESS_SEPOLIA constant', () => {
    // #given SUPPORTED_TOKENS.USDC
    // #when checking address
    // #then matches the Sepolia USDC constant
    expect(SUPPORTED_TOKENS.USDC.address).toBe(USDC_ADDRESS_SEPOLIA)
  })

  it('ETH has 18 decimals', () => {
    expect(SUPPORTED_TOKENS.ETH.decimals).toBe(18)
  })

  it('USDC has 6 decimals', () => {
    expect(SUPPORTED_TOKENS.USDC.decimals).toBe(6)
  })
})

describe('getUSDCAddress', () => {
  it('returns valid address for Eth Sepolia', () => {
    // #given chainId 11155111
    // #when requesting USDC address
    const addr = getUSDCAddress(11155111)
    // #then returns valid address
    expect(addr).toMatch(ADDRESS_RE)
    expect(addr).toBe(USDC_ADDRESS_SEPOLIA)
  })

  it('returns valid address for Eth Sepolia (explicit)', () => {
    // #given chainId 11155111
    // #when requesting USDC address
    const addr = getUSDCAddress(11155111)
    // #then returns the Sepolia address
    expect(addr).toBe(USDC_ADDRESS_SEPOLIA)
  })

  it('throws for unsupported chain', () => {
    // #given unknown chainId
    // #when requesting USDC address
    // #then throws with descriptive message
    expect(() => getUSDCAddress(999999)).toThrow(/USDC not configured for chain 999999/)
  })

  it('throws for Thanos Sepolia (no USDC configured)', () => {
    // #given Thanos Sepolia chainId
    // #when requesting USDC address
    // #then throws
    expect(() => getUSDCAddress(111551119090)).toThrow(/USDC not configured/)
  })
})

describe('pool config constants', () => {
  it('RELAYER_FEE_BPS is 200 (2%)', () => {
    expect(RELAYER_FEE_BPS).toBe(200)
  })

  it('POOL_FEE is 500 (0.05%)', () => {
    expect(POOL_FEE).toBe(500)
  })

  it('POOL_TICK_SPACING is 10', () => {
    expect(POOL_TICK_SPACING).toBe(10)
  })

  it('MERKLE_TREE_DEPTH is 20', () => {
    expect(MERKLE_TREE_DEPTH).toBe(20)
  })

  it('MAX_DEPOSITS is 2^20', () => {
    expect(MAX_DEPOSITS).toBe(2 ** 20)
  })
})

describe('transaction constants', () => {
  it('SWAP_GAS_LIMIT is bigint 500_000', () => {
    // #given the swap gas limit
    // #when checking type and value
    // #then is bigint
    expect(typeof SWAP_GAS_LIMIT).toBe('bigint')
    expect(SWAP_GAS_LIMIT).toBe(500_000n)
  })

  it('TX_RECEIPT_TIMEOUT is 120 seconds', () => {
    expect(TX_RECEIPT_TIMEOUT).toBe(120_000)
  })

  it('DEFAULT_SLIPPAGE_BPS is 100 (1%)', () => {
    expect(DEFAULT_SLIPPAGE_BPS).toBe(100)
  })

  it('DEFAULT_SLIPPAGE_MULTIPLIER is 0.99', () => {
    expect(DEFAULT_SLIPPAGE_MULTIPLIER).toBe(0.99)
  })

  it('RPC_LOG_BATCH_SIZE is bigint', () => {
    expect(typeof RPC_LOG_BATCH_SIZE).toBe('bigint')
    expect(RPC_LOG_BATCH_SIZE).toBe(50_000n)
  })
})
