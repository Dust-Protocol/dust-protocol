import { describe, it, expect } from 'vitest'
import { isSwapSupported } from '../constants'
import { getVanillaPoolKey, computePoolId, getSwapDirection, type PoolKey } from '../contracts'
import { type Address } from 'viem'

describe('V1→V2 migration: isSwapSupported', () => {
  it('returns true for Eth Sepolia (has V2 config)', () => {
    expect(isSwapSupported(11155111)).toBe(true)
  })

  it('returns false for Arbitrum Sepolia (pool not initialized)', () => {
    expect(isSwapSupported(421614)).toBe(false)
  })

  it('returns false for Base Sepolia (pool not initialized)', () => {
    expect(isSwapSupported(84532)).toBe(false)
  })

  it('returns false for Thanos Sepolia (no swap support)', () => {
    expect(isSwapSupported(111551119090)).toBe(false)
  })

  it('returns false for OP Sepolia (no V4)', () => {
    expect(isSwapSupported(11155420)).toBe(false)
  })

  it('returns false for unknown chain', () => {
    expect(isSwapSupported(999999)).toBe(false)
  })

  it('returns true for Eth Sepolia (explicit)', () => {
    expect(isSwapSupported(11155111)).toBe(true)
  })
})

describe('V1→V2 migration: getVanillaPoolKey', () => {
  it('returns PoolKey for Eth Sepolia', () => {
    const key = getVanillaPoolKey(11155111)
    expect(key).not.toBeNull()
    expect(key!.currency0).toBe('0x0000000000000000000000000000000000000000')
    expect(key!.currency1).toBe('0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238')
    expect(key!.fee).toBe(500)
    expect(key!.tickSpacing).toBe(10)
    expect(key!.hooks).toBe('0x0000000000000000000000000000000000000000')
  })

  it('returns null for Thanos Sepolia', () => {
    expect(getVanillaPoolKey(111551119090)).toBeNull()
  })

  it('throws for unknown chain', () => {
    expect(() => getVanillaPoolKey(999999)).toThrow()
  })
})

describe('V1→V2 migration: computePoolId', () => {
  it('returns deterministic bytes32', () => {
    const key = getVanillaPoolKey(11155111)!
    const id1 = computePoolId(key)
    const id2 = computePoolId(key)
    expect(id1).toBe(id2)
    expect(id1).toMatch(/^0x[a-f0-9]{64}$/)
  })

  it('different keys produce different IDs', () => {
    const key1 = getVanillaPoolKey(11155111)!
    const key2: PoolKey = { ...key1, fee: 3000 }
    expect(computePoolId(key1)).not.toBe(computePoolId(key2))
  })
})

describe('V1→V2 migration: getSwapDirection', () => {
  it('ETH→USDC is zeroForOne=true', () => {
    const key = getVanillaPoolKey(11155111)!
    const eth = '0x0000000000000000000000000000000000000000' as Address
    const usdc = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address
    const result = getSwapDirection(eth, usdc, key)
    expect(result.zeroForOne).toBe(true)
    expect(result.sqrtPriceLimitX96).toBe(BigInt('4295128740'))
  })

  it('USDC→ETH is zeroForOne=false', () => {
    const key = getVanillaPoolKey(11155111)!
    const eth = '0x0000000000000000000000000000000000000000' as Address
    const usdc = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address
    const result = getSwapDirection(usdc, eth, key)
    expect(result.zeroForOne).toBe(false)
    expect(result.sqrtPriceLimitX96).toBe(BigInt('1461446703485210103287273052203988822378723970341'))
  })
})
