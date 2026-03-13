/**
 * Chainalysis Free Sanctions Screening API client
 *
 * Uses the public endpoint (no API key) to check whether addresses appear
 * on OFAC or other sanctions lists. Results are cached for 5 minutes to
 * reduce redundant lookups.
 */

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SanctionsIdentification {
  category: string
  name: string
  description: string
  url: string
}

interface ChainalysisResponse {
  identifications: SanctionsIdentification[]
}

export interface SanctionsCheckResult {
  address: string
  sanctioned: boolean
  identifications: SanctionsIdentification[]
  checkedAt: number
}

// ─── Config ─────────────────────────────────────────────────────────────────────

const DEFAULT_API_URL = 'https://public.chainalysis.com/api/v1'
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 1000
const BATCH_DELAY_MS = 100
const CACHE_TTL_MS = 5 * 60 * 1000

function getBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env?.CHAINALYSIS_API_URL) {
    return process.env.CHAINALYSIS_API_URL
  }
  return DEFAULT_API_URL
}

// ─── Errors ─────────────────────────────────────────────────────────────────────

export class ChainalysisApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string
  ) {
    super(message)
    this.name = 'ChainalysisApiError'
  }
}

// ─── Cache ──────────────────────────────────────────────────────────────────────

interface CacheEntry {
  result: SanctionsCheckResult
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

function getCached(address: string): SanctionsCheckResult | null {
  const key = address.toLowerCase()
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.result
}

function setCache(result: SanctionsCheckResult): void {
  cache.set(result.address.toLowerCase(), {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

// ─── Fetch with retries ─────────────────────────────────────────────────────────

async function chainalysisFetch<T>(path: string): Promise<T> {
  const url = `${getBaseUrl()}${path}`

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    })

    if (response.ok) {
      return response.json() as Promise<T>
    }

    const body = await response.text().catch(() => undefined)
    const error = new ChainalysisApiError(
      `Chainalysis API request failed: ${response.status} ${response.statusText}`,
      response.status,
      body
    )

    // Only retry server errors (5xx)
    const isRetryable = response.status >= 500 && attempt < MAX_RETRIES
    if (!isRetryable) throw error

    await new Promise(r => setTimeout(r, RETRY_BASE_DELAY_MS * Math.pow(2, attempt)))
  }

  throw new Error('chainalysisFetch: unreachable')
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Check sanctions status for a single address.
 * Returns cached result if available and not expired.
 */
export async function checkSanctionsStatus(address: string): Promise<SanctionsCheckResult> {
  const cached = getCached(address)
  if (cached) return cached

  const data = await chainalysisFetch<ChainalysisResponse>(`/address/${address}`)

  const result: SanctionsCheckResult = {
    address,
    sanctioned: data.identifications.length > 0,
    identifications: data.identifications,
    checkedAt: Date.now(),
  }

  setCache(result)
  return result
}

/**
 * Check sanctions status for multiple addresses.
 * Introduces a 100ms delay between requests to respect rate limits.
 * Uses cache where available.
 */
export async function batchCheckSanctions(
  addresses: string[]
): Promise<Map<string, SanctionsCheckResult>> {
  const results = new Map<string, SanctionsCheckResult>()
  const uncached: string[] = []

  for (const addr of addresses) {
    const cached = getCached(addr)
    if (cached) {
      results.set(addr, cached)
    } else {
      uncached.push(addr)
    }
  }

  for (let i = 0; i < uncached.length; i++) {
    if (i > 0) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
    }
    const result = await checkSanctionsStatus(uncached[i])
    results.set(uncached[i], result)
  }

  return results
}

/**
 * Simple boolean check — true if the address is on a sanctions list.
 */
export async function isSanctioned(address: string): Promise<boolean> {
  const result = await checkSanctionsStatus(address)
  return result.sanctioned
}

/**
 * Clear the internal sanctions check cache.
 * Useful for testing or forcing fresh lookups.
 */
export function clearSanctionsCache(): void {
  cache.clear()
}
