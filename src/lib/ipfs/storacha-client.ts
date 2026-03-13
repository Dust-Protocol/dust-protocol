/**
 * IPFS pinning utility for PL Genesis Hackathon.
 *
 * Supports multiple providers via IPFS_PROVIDER env var:
 *   - 'pinata'  — Pinata pinning API (requires PINATA_API_KEY + PINATA_SECRET_KEY)
 *   - 'local'   — Mock provider returning deterministic fake CIDs (testing)
 *
 * Gateway URL is configurable via IPFS_GATEWAY_URL (defaults to w3s.link).
 */

import { createHash } from 'crypto'

// ─── Types ──────────────────────────────────────────────────────────────────────

export type IPFSProvider = 'pinata' | 'local'

export interface PinResult {
  cid: string
  gatewayUrl: string
  provider: IPFSProvider
}

// ─── Config ─────────────────────────────────────────────────────────────────────

const DEFAULT_GATEWAY = 'https://gateway.pinata.cloud/ipfs'
const PINATA_PIN_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS'
const PINATA_PIN_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS'

function getProvider(): IPFSProvider {
  const val = process.env.IPFS_PROVIDER?.toLowerCase()
  if (val === 'pinata' || val === 'local') return val
  return 'local'
}

function getGatewayBase(): string {
  return process.env.IPFS_GATEWAY_URL || DEFAULT_GATEWAY
}

function getPinataKeys(): { apiKey: string; secretKey: string } {
  const apiKey = process.env.PINATA_API_KEY
  const secretKey = process.env.PINATA_SECRET_KEY
  if (!apiKey || !secretKey) {
    throw new Error('PINATA_API_KEY and PINATA_SECRET_KEY are required for pinata provider')
  }
  return { apiKey, secretKey }
}

// ─── Errors ─────────────────────────────────────────────────────────────────────

export class IPFSPinError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: string
  ) {
    super(message)
    this.name = 'IPFSPinError'
  }
}

// ─── Pinata Provider ────────────────────────────────────────────────────────────

async function pinataUploadJSON(data: unknown): Promise<string> {
  const { apiKey, secretKey } = getPinataKeys()

  const response = await fetch(PINATA_PIN_JSON_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      pinata_api_key: apiKey,
      pinata_secret_api_key: secretKey,
    },
    body: JSON.stringify({ pinataContent: data }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => undefined)
    throw new IPFSPinError(
      `Pinata upload failed: ${response.status} ${response.statusText}`,
      response.status,
      body
    )
  }

  const result = await response.json() as { IpfsHash: string }
  return result.IpfsHash
}

async function pinataUploadFile(content: Buffer, fileName: string): Promise<string> {
  const { apiKey, secretKey } = getPinataKeys()

  const formData = new FormData()
  const blob = new Blob([content])
  formData.append('file', blob, fileName)

  const response = await fetch(PINATA_PIN_URL, {
    method: 'POST',
    headers: {
      pinata_api_key: apiKey,
      pinata_secret_api_key: secretKey,
    },
    body: formData,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => undefined)
    throw new IPFSPinError(
      `Pinata file upload failed: ${response.status} ${response.statusText}`,
      response.status,
      body
    )
  }

  const result = await response.json() as { IpfsHash: string }
  return result.IpfsHash
}

// ─── Local/Mock Provider ────────────────────────────────────────────────────────

// Deterministic fake CID from content hash (useful for testing)
function localFakeCID(content: Buffer | string): string {
  const hash = createHash('sha256')
    .update(typeof content === 'string' ? content : content)
    .digest('hex')
    .slice(0, 46)
  return `bafybeig${hash}`
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns a public gateway URL for the given CID.
 */
export function getIPFSGatewayURL(cid: string): string {
  const base = getGatewayBase().replace(/\/$/, '')
  return `${base}/${cid}`
}

/**
 * Pins JSON-serializable data to IPFS. Returns the CID.
 */
export async function pinToIPFS(data: string | Record<string, unknown>): Promise<PinResult> {
  const provider = getProvider()
  let cid: string

  if (provider === 'pinata') {
    const payload = typeof data === 'string' ? JSON.parse(data) : data
    cid = await pinataUploadJSON(payload)
  } else {
    const raw = typeof data === 'string' ? data : JSON.stringify(data)
    cid = localFakeCID(raw)
  }

  return { cid, gatewayUrl: getIPFSGatewayURL(cid), provider }
}

/**
 * Pins raw file content (Buffer) to IPFS. Returns the CID.
 */
export async function pinFileToIPFS(
  content: Buffer,
  fileName = 'upload'
): Promise<PinResult> {
  const provider = getProvider()
  let cid: string

  if (provider === 'pinata') {
    cid = await pinataUploadFile(content, fileName)
  } else {
    cid = localFakeCID(content)
  }

  return { cid, gatewayUrl: getIPFSGatewayURL(cid), provider }
}
