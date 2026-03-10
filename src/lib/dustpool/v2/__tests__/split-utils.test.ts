import { describe, it, expect, vi, beforeEach } from 'vitest'
import { zeroAddress } from 'viem'
import {
  resolveTokenSymbol,
  parseSplitCalldata,
  splitOutputToNoteCommitment,
} from '../split-utils'

/**
 * Tests for the pure utility functions extracted from useV2Split.
 *
 * TODO: Full orchestration test (split → poll → batch-withdraw) requires
 * a React testing harness (@testing-library/react-hooks) plus mocking of:
 * - snarkjs fflonk.fullProve / fflonk.verify
 * - relayer API (createRelayerClient)
 * - publicClient.waitForTransactionReceipt
 * - IndexedDB (openV2Database)
 * This file covers the extractable pure functions instead.
 */

describe('resolveTokenSymbol', () => {
  it('returns ETH for the zero address', () => {
    // #given
    const asset = zeroAddress
    const chainId = 11155111

    // #when
    const result = resolveTokenSymbol(asset, chainId)

    // #then
    expect(result).toBe('ETH')
  })

  it('returns USDC for the known Sepolia USDC address', () => {
    // #given
    const asset = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`
    const chainId = 11155111

    // #when
    const result = resolveTokenSymbol(asset, chainId)

    // #then
    expect(result).toBe('USDC')
  })

  it('matches USDC address case-insensitively', () => {
    // #given — all lowercase
    const asset = '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238' as `0x${string}`
    const chainId = 11155111

    // #when
    const result = resolveTokenSymbol(asset, chainId)

    // #then
    expect(result).toBe('USDC')
  })

  it('throws for unknown token address', () => {
    // #given
    const unknownToken = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as `0x${string}`
    const chainId = 11155111

    // #when / #then
    expect(() => resolveTokenSymbol(unknownToken, chainId)).toThrow('Unknown token')
  })

  it('throws for USDC address on unsupported chain', () => {
    // #given — USDC address is only mapped for chain 11155111
    const asset = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`
    const unknownChainId = 999

    // #when / #then
    expect(() => resolveTokenSymbol(asset, unknownChainId)).toThrow('Unknown token')
  })

  it('returns native token symbol for zero address on supported chains', () => {
    // #given — zero address is native token, symbol varies by chain
    const expected: [number, string][] = [
      [11155111, 'ETH'],
      [111551119090, 'TON'],
      [545, 'FLOW'],
    ]

    for (const [chainId, symbol] of expected) {
      // #when
      const result = resolveTokenSymbol(zeroAddress, chainId)

      // #then
      expect(result).toBe(symbol)
    }
  })
})

describe('parseSplitCalldata', () => {
  it('parses calldata with correct number of hex elements', () => {
    // #given — 24 proof elements + 15 public signals = 39 hex elements
    const numPublicSignals = 15
    const proofHexParts = Array.from({ length: 24 }, (_, i) =>
      '0x' + (i + 1).toString(16).padStart(64, '0')
    )
    const signalHexParts = Array.from({ length: numPublicSignals }, (_, i) =>
      '0x' + (100 + i).toString(16).padStart(64, '0')
    )
    const calldata = [...proofHexParts, ...signalHexParts].join(',')

    // #when
    const result = parseSplitCalldata(calldata, numPublicSignals)

    // #then
    expect(result.proofCalldata.startsWith('0x')).toBe(true)
    expect(result.publicSignals).toHaveLength(numPublicSignals)
    expect(result.publicSignals[0]).toBe(signalHexParts[0])
  })

  it('throws when calldata has too few hex elements', () => {
    // #given — only 10 hex elements, need 24 + 15 = 39
    const calldata = Array.from({ length: 10 }, (_, i) => '0x' + i.toString(16)).join(',')

    // #when / #then
    expect(() => parseSplitCalldata(calldata, 15)).toThrow('Failed to parse split proof calldata')
  })

  it('throws when calldata is empty', () => {
    // #given
    const calldata = ''

    // #when / #then
    expect(() => parseSplitCalldata(calldata, 15)).toThrow('Failed to parse split proof calldata')
  })

  it('throws when calldata has no hex elements', () => {
    // #given
    const calldata = 'not,hex,data'

    // #when / #then
    expect(() => parseSplitCalldata(calldata, 15)).toThrow('got 0')
  })

  it('concatenates proof elements correctly', () => {
    // #given — 24 proof elements of known value + 1 signal
    const proofHexParts = Array.from({ length: 24 }, () => '0xabcd')
    const signals = ['0x1234']
    const calldata = [...proofHexParts, ...signals].join(' ')

    // #when
    const result = parseSplitCalldata(calldata, 1)

    // #then — proof is concatenated without 0x prefixes
    expect(result.proofCalldata).toBe('0x' + 'abcd'.repeat(24))
    expect(result.publicSignals).toEqual(['0x1234'])
  })
})

describe('splitOutputToNoteCommitment', () => {
  it('maps SplitOutputNote fields to NoteCommitmentV2', () => {
    // #given
    const output = {
      commitment: 12345n,
      owner: 111n,
      amount: 1000000000000000000n,
      asset: 222n,
      blinding: 333n,
    }

    // #when
    const result = splitOutputToNoteCommitment(output, 42, 11155111)

    // #then
    expect(result.note.owner).toBe(111n)
    expect(result.note.amount).toBe(1000000000000000000n)
    expect(result.note.asset).toBe(222n)
    expect(result.note.blinding).toBe(333n)
    expect(result.note.chainId).toBe(11155111)
    expect(result.commitment).toBe(12345n)
    expect(result.leafIndex).toBe(42)
    expect(result.spent).toBe(false)
  })

  it('sets spent to false for new output notes', () => {
    // #given
    const output = {
      commitment: 1n,
      owner: 1n,
      amount: 1n,
      asset: 1n,
      blinding: 1n,
    }

    // #when
    const result = splitOutputToNoteCommitment(output, 0, 1)

    // #then — split outputs are always unspent
    expect(result.spent).toBe(false)
  })

  it('sets createdAt to a recent timestamp', () => {
    // #given
    const before = Date.now()
    const output = {
      commitment: 1n,
      owner: 1n,
      amount: 1n,
      asset: 1n,
      blinding: 1n,
    }

    // #when
    const result = splitOutputToNoteCommitment(output, 0, 1)
    const after = Date.now()

    // #then — timestamp is within the test execution window
    expect(result.createdAt).toBeGreaterThanOrEqual(before)
    expect(result.createdAt).toBeLessThanOrEqual(after)
  })

  it('preserves large bigint values without truncation', () => {
    // #given — BN254-scale values
    const largeValue = 21888242871839275222246405745257275088548364400416034343698204186575808495616n
    const output = {
      commitment: largeValue,
      owner: largeValue - 1n,
      amount: largeValue - 2n,
      asset: largeValue - 3n,
      blinding: largeValue - 4n,
    }

    // #when
    const result = splitOutputToNoteCommitment(output, 999, 11155111)

    // #then
    expect(result.commitment).toBe(largeValue)
    expect(result.note.owner).toBe(largeValue - 1n)
    expect(result.note.amount).toBe(largeValue - 2n)
    expect(result.note.asset).toBe(largeValue - 3n)
    expect(result.note.blinding).toBe(largeValue - 4n)
  })
})
