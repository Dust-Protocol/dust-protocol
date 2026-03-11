/**
 * Extract a human-readable error from a RelayerError response.
 * RelayerError carries a `body` string with JSON `{ error: "..." }` from the server.
 */
export function extractRelayerError(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback
  const body = (e as { body?: string }).body
  if (body) {
    try {
      const parsed = JSON.parse(body) as { error?: string }
      if (parsed.error) return parsed.error
    } catch (parseErr: unknown) {
      const detail = parseErr instanceof Error ? parseErr.message : 'unknown parse error'
      console.warn(`[extractRelayerError] Failed to parse relayer body: ${detail}`)
    }
  }
  return e.message || fallback
}

const ERROR_MAP: [pattern: RegExp, message: string][] = [
  [/no note with sufficient balance/i, 'Not enough shielded balance for this amount'],
  [/proof failed local verification/i, 'Proof generation failed. Please try again.'],
  [/unknown merkle root|UnknownRoot|unknown root/i, 'Pool state changed during operation. Please retry.'],
  [/insufficient pool balance/i, 'Not enough liquidity in pool. Try a smaller amount.'],
  [/NullifierAlreadyUsed|nullifier already/i, 'This withdrawal was already processed.'],
  [/invalid proof|proof verification/i, 'Proof verification failed. Please retry.'],
  [/timeout|ETIMEDOUT/i, 'Network timeout. Check your connection and retry.'],
  [/nonce/i, 'Transaction nonce conflict. Please wait and retry.'],
  [/insufficient funds|INSUFFICIENT_FUNDS/i, 'Insufficient funds to cover gas fees.'],
  [/rejected by user|user denied|user rejected|ACTION_REJECTED/i, 'Transaction cancelled by user.'],
  [/rate limit|429/i, 'Too many requests. Please wait a moment and retry.'],
  [/underpriced|REPLACEMENT_UNDERPRICED/i, 'Gas price too low. Please retry.'],
  [/wallet not connected/i, 'Please connect your wallet first'],
  [/keys not available/i, 'Please unlock your V2 keys first'],
  [/transaction reverted/i, 'Transaction failed on-chain. Please try again.'],
  [/relayer rejected/i, 'Relayer rejected the transaction. Please try again.'],
  [/amount must be positive/i, 'Amount must be greater than zero'],
  [/amount exceeds maximum/i, 'Amount exceeds the maximum allowed deposit'],
  [/not deployed on chain/i, 'V2 pool is not available on this network'],
  [/public client not available/i, 'Network connection lost. Please refresh and try again.'],
  [/recipient address is sanctioned/i, 'Recipient address is blocked by compliance screening. Try a different address.'],
  [/compliance screening unavailable/i, 'Compliance screening is temporarily unavailable. Please try again later.'],
  [/cooldown active|CooldownActive/i, 'This deposit is still in its 1-hour cooldown period. You can only withdraw to the original deposit address.'],
]

export function errorToUserMessage(raw: string): string {
  for (const [pattern, message] of ERROR_MAP) {
    if (pattern.test(raw)) return message
  }
  return 'Something went wrong. Please try again.'
}
