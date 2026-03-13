/**
 * OFAC SDN (Specially Designated Nationals) list parser.
 *
 * Downloads the SDN XML from the US Treasury and extracts sanctioned
 * crypto addresses. Uses regex-based parsing to avoid heavy XML
 * parser dependencies. Results are cached for 1 hour.
 */

import { getAddress } from 'viem'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface OFACAddress {
  address: string
  currency: string
  name: string
  sdnId: string
}

// ─── Config ─────────────────────────────────────────────────────────────────────

const SDN_XML_URL = 'https://www.treasury.gov/ofac/downloads/sdn.xml'
const CACHE_TTL_MS = 60 * 60 * 1000
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 1000

// ─── Cache ──────────────────────────────────────────────────────────────────────

interface OFACCacheEntry {
  addresses: OFACAddress[]
  expiresAt: number
}

let ofacCache: OFACCacheEntry | null = null

function getCachedAddresses(): OFACAddress[] | null {
  if (!ofacCache) return null
  if (Date.now() > ofacCache.expiresAt) {
    ofacCache = null
    return null
  }
  return ofacCache.addresses
}

function setCachedAddresses(addresses: OFACAddress[]): void {
  ofacCache = {
    addresses,
    expiresAt: Date.now() + CACHE_TTL_MS,
  }
}

// ─── XML Parsing ────────────────────────────────────────────────────────────────

// Pattern: full <sdnEntry>...</sdnEntry> blocks
const SDN_ENTRY_REGEX = /<sdnEntry>([\s\S]*?)<\/sdnEntry>/g

// Pattern: <uid> from SDN entry
const UID_REGEX = /<uid>(\d+)<\/uid>/

// Pattern: name fields
const FIRST_NAME_REGEX = /<firstName>([\s\S]*?)<\/firstName>/
const LAST_NAME_REGEX = /<lastName>([\s\S]*?)<\/lastName>/

// Pattern: individual <id> blocks within an SDN entry
const ID_BLOCK_REGEX = /<id>([\s\S]*?)<\/id>/g

// Pattern: "Digital Currency Address - ETH" (or XBT, USDT, etc.)
const ID_TYPE_REGEX = /<idType>\s*Digital Currency Address\s*-\s*(\w+)\s*<\/idType>/

// Pattern: the actual address value
const ID_NUMBER_REGEX = /<idNumber>([\s\S]*?)<\/idNumber>/

function extractTag(xml: string, regex: RegExp): string {
  const match = regex.exec(xml)
  return match ? match[1].trim() : ''
}

/**
 * Parse raw SDN XML and extract all Digital Currency Address entries.
 * Uses regex matching to avoid XML parser dependencies.
 */
export function parseSDNXML(xml: string): OFACAddress[] {
  const results: OFACAddress[] = []

  let entryMatch: RegExpExecArray | null
  while ((entryMatch = SDN_ENTRY_REGEX.exec(xml)) !== null) {
    const entryBlock = entryMatch[1]

    const sdnId = extractTag(entryBlock, UID_REGEX)
    const firstName = extractTag(entryBlock, FIRST_NAME_REGEX)
    const lastName = extractTag(entryBlock, LAST_NAME_REGEX)
    const name = [firstName, lastName].filter(Boolean).join(' ')

    let idMatch: RegExpExecArray | null
    ID_BLOCK_REGEX.lastIndex = 0
    while ((idMatch = ID_BLOCK_REGEX.exec(entryBlock)) !== null) {
      const idBlock = idMatch[1]

      const typeMatch = ID_TYPE_REGEX.exec(idBlock)
      if (!typeMatch) continue

      const currency = typeMatch[1]
      const address = extractTag(idBlock, ID_NUMBER_REGEX)
      if (!address) continue

      results.push({ address, currency, name, sdnId })
    }
  }

  return results
}

// ─── Fetch with retries ─────────────────────────────────────────────────────────

async function fetchSDNXML(): Promise<string> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(SDN_XML_URL, {
      headers: { Accept: 'application/xml' },
    })

    if (response.ok) {
      return response.text()
    }

    const isRetryable = response.status >= 500 && attempt < MAX_RETRIES
    if (!isRetryable) {
      throw new Error(
        `OFAC SDN fetch failed: ${response.status} ${response.statusText}`
      )
    }

    await new Promise(r => setTimeout(r, RETRY_BASE_DELAY_MS * Math.pow(2, attempt)))
  }

  throw new Error('fetchSDNXML: unreachable')
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Download and parse the OFAC SDN list, extracting all crypto addresses.
 * Results are cached for 1 hour.
 */
export async function fetchOFACAddresses(): Promise<OFACAddress[]> {
  const cached = getCachedAddresses()
  if (cached) return cached

  const xml = await fetchSDNXML()
  const addresses = parseSDNXML(xml)
  setCachedAddresses(addresses)
  return addresses
}

/**
 * Fetch only ETH/EVM addresses from the OFAC SDN list.
 * Returns deduplicated EIP-55 checksummed addresses.
 */
export async function fetchOFACEthAddresses(): Promise<string[]> {
  const all = await fetchOFACAddresses()

  const ethEntries = all.filter(
    entry => entry.currency.toUpperCase() === 'ETH'
  )

  const seen = new Set<string>()
  const results: string[] = []

  for (const entry of ethEntries) {
    const lower = entry.address.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)

    try {
      results.push(getAddress(lower))
    } catch {
      // Malformed address — skip
      continue
    }
  }

  return results
}

/**
 * Clear the OFAC address cache.
 * Useful for testing or forcing a fresh download.
 */
export function clearOFACCache(): void {
  ofacCache = null
}
