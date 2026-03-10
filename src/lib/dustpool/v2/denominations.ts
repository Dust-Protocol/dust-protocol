import { parseEther, parseUnits, formatEther, formatUnits } from 'viem'

// Denomination tables in descending order (largest first for greedy decomposition).
// These define the anonymity set boundaries — all withdrawals of the same
// denomination are indistinguishable from each other on-chain.

const ETH_DENOMINATION_VALUES = [
  '100', '50', '20', '10', '5', '3', '2', '1',
  '0.5', '0.3', '0.2', '0.1',
  '0.05', '0.03', '0.02', '0.01',
] as const

const USDC_DENOMINATION_VALUES = [
  '10000', '5000', '2000', '1000',
  '500', '200', '100', '50',
  '20', '10', '5', '2', '1',
] as const

export const ETH_DENOMINATIONS: bigint[] = ETH_DENOMINATION_VALUES.map(v => parseEther(v))
export const USDC_DENOMINATIONS: bigint[] = USDC_DENOMINATION_VALUES.map(v => parseUnits(v, 6))

// 18-decimal native tokens that share the ETH denomination table
const NATIVE_18_DECIMAL_SYMBOLS = new Set(['ETH', 'FLOW', 'TON'])

/**
 * Get the denomination table for a given token symbol.
 * Returns denominations in descending order (largest first).
 * All 18-decimal native tokens (ETH, FLOW, TON) share the same table.
 */
export function getDenominations(token: string): bigint[] {
  const upper = token.toUpperCase()
  if (NATIVE_18_DECIMAL_SYMBOLS.has(upper)) return ETH_DENOMINATIONS
  if (upper === 'USDC') return USDC_DENOMINATIONS
  throw new Error(`No denomination table for token: ${token}. Supported: ${[...NATIVE_18_DECIMAL_SYMBOLS].join(', ')}, USDC`)
}

/**
 * Greedy decomposition of an amount into denomination chunks.
 *
 * Uses largest-denomination-first strategy. If the amount cannot be
 * exactly decomposed (remainder < smallest denomination), the remainder
 * is included as the final chunk — it won't blend into a denomination
 * set but avoids losing user funds.
 *
 * @returns Array of chunk amounts in descending order. sum(chunks) === amount.
 */
export function decompose(amount: bigint, denominations: bigint[], maxChunks?: number): bigint[] {
  if (amount <= 0n) return []
  if (denominations.length === 0) return [amount]

  const limit = maxChunks ?? Infinity
  const chunks: bigint[] = []
  let remaining = amount

  for (const denom of denominations) {
    while (remaining >= denom && chunks.length < limit) {
      chunks.push(denom)
      remaining -= denom
    }
    if (chunks.length >= limit) break
  }

  if (remaining > 0n) {
    if (chunks.length >= limit && chunks.length > 0) {
      // Merge remainder into last chunk to stay within limit
      chunks[chunks.length - 1] += remaining
    } else {
      chunks.push(remaining)
    }
  }

  return chunks
}

/**
 * Decompose an amount into denomination chunks for a given token.
 * Convenience wrapper around decompose() + getDenominations().
 */
export function decomposeForToken(amount: bigint, token: string): bigint[] {
  return decompose(amount, getDenominations(token))
}

/**
 * Decompose for a split operation with a max chunk count.
 * Default maxChunks=7 leaves room for one change note in the 8-output circuit.
 * If the decomposition would exceed maxChunks, the remainder is merged
 * into the last chunk (losing some denomination privacy for that chunk).
 */
export function decomposeForSplit(amount: bigint, token: string, maxChunks = 7): bigint[] {
  return decompose(amount, getDenominations(token), maxChunks)
}

/**
 * Format a decomposition result as human-readable strings.
 * Returns array of formatted denomination values (e.g., ["1.0", "0.3", "0.05"]).
 */
export function formatChunks(chunks: bigint[], token: string): string[] {
  const decimals = token.toUpperCase() === 'USDC' ? 6 : 18
  return chunks.map(c => decimals === 6 ? formatUnits(c, 6) : formatEther(c))
}

/**
 * Suggest nearby round amounts that decompose into fewer chunks.
 *
 * When a user enters an arbitrary amount (e.g., 1.37 ETH), suggest
 * rounded alternatives that produce fewer withdrawal chunks and thus
 * better privacy (fewer on-chain transactions to correlate).
 *
 * @returns Up to 3 suggestions, each with the amount and chunk count.
 *          Only includes suggestions with strictly fewer chunks than the original.
 */
export function suggestRoundedAmounts(
  amount: bigint,
  token: string,
  maxSuggestions = 3
): Array<{ amount: bigint; chunks: number; formatted: string }> {
  const denoms = getDenominations(token)
  if (denoms.length === 0 || amount <= 0n) return []

  const originalChunks = decompose(amount, denoms).length
  const decimals = token.toUpperCase() === 'USDC' ? 6 : 18

  const suggestions: Array<{ amount: bigint; chunks: number; formatted: string }> = []
  const seen = new Set<string>()

  // Try rounding down to each denomination boundary
  for (const denom of denoms) {
    if (denom >= amount) continue

    // Round down to nearest multiple of this denomination
    const rounded = (amount / denom) * denom
    if (rounded <= 0n || rounded >= amount) continue

    const key = rounded.toString()
    if (seen.has(key)) continue
    seen.add(key)

    const roundedChunks = decompose(rounded, denoms).length
    if (roundedChunks < originalChunks) {
      const formatted = decimals === 6
        ? formatUnits(rounded, 6)
        : formatEther(rounded)
      suggestions.push({ amount: rounded, chunks: roundedChunks, formatted })
    }
  }

  // Sort by fewest chunks, then largest amount (lose least)
  suggestions.sort((a, b) => {
    if (a.chunks !== b.chunks) return a.chunks - b.chunks
    if (a.amount > b.amount) return -1
    if (a.amount < b.amount) return 1
    return 0
  })

  return suggestions.slice(0, maxSuggestions)
}
