/**
 * IPFS pinning utility for PL Genesis Hackathon.
 *
 * Supports multiple providers via IPFS_PROVIDER env var:
 *   - 'storacha' — Storacha via `w3` CLI (uses pre-authenticated CLI session)
 *   - 'pinata'   — Pinata pinning API (requires PINATA_API_KEY + PINATA_SECRET_KEY)
 *   - 'local'    — Mock provider returning deterministic fake CIDs (testing)
 *
 * Gateway URL is configurable via IPFS_GATEWAY_URL (defaults to w3s.link).
 */

import { createHash } from 'crypto'
import { execFile } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

// ─── Types ──────────────────────────────────────────────────────────────────────

export type IPFSProvider = 'storacha' | 'pinata' | 'local'

export interface PinResult {
  cid: string
  gatewayUrl: string
  provider: IPFSProvider
}

// ─── Config ─────────────────────────────────────────────────────────────────────

const DEFAULT_GATEWAY = 'https://w3s.link/ipfs'
const PINATA_PIN_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS'
const PINATA_PIN_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS'

function getProvider(): IPFSProvider {
  const val = process.env.IPFS_PROVIDER?.toLowerCase()
  if (val === 'storacha' || val === 'pinata' || val === 'local') return val
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

// ─── Storacha Provider (via w3 CLI) ─────────────────────────────────────────────

// Uses the pre-authenticated `w3` CLI session. The CLI handles UCAN delegations
// internally. Avoids @storacha/client SDK dependency conflicts with multiformats.
function w3Upload(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('npx', ['@web3-storage/w3cli', 'up', '--json', filePath], {
      timeout: 120_000,
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new IPFSPinError(
          `Storacha upload failed: ${error.message}`,
          undefined,
          stderr
        ))
        return
      }
      try {
        const result = JSON.parse(stdout.trim())
        const cid = result.root?.['/'] ?? result.root
        if (!cid) throw new Error(`Unexpected w3 output: ${stdout}`)
        resolve(cid)
      } catch (e) {
        reject(new IPFSPinError(`Failed to parse w3 output: ${stdout}`, undefined, stderr))
      }
    })
  })
}

async function storachaUploadJSON(data: unknown): Promise<string> {
  const tmpPath = join(tmpdir(), `storacha-${Date.now()}.json`)
  try {
    await writeFile(tmpPath, JSON.stringify(data))
    return await w3Upload(tmpPath)
  } finally {
    await unlink(tmpPath).catch(() => {})
  }
}

async function storachaUploadFile(content: Buffer, fileName: string): Promise<string> {
  const tmpPath = join(tmpdir(), `storacha-${Date.now()}-${fileName}`)
  try {
    await writeFile(tmpPath, content)
    return await w3Upload(tmpPath)
  } finally {
    await unlink(tmpPath).catch(() => {})
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

function localFakeCID(content: Buffer | string): string {
  const hash = createHash('sha256')
    .update(typeof content === 'string' ? content : content)
    .digest('hex')
    .slice(0, 46)
  return `bafybeig${hash}`
}

// ─── Public API ─────────────────────────────────────────────────────────────────

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

  if (provider === 'storacha') {
    const payload = typeof data === 'string' ? JSON.parse(data) : data
    cid = await storachaUploadJSON(payload)
  } else if (provider === 'pinata') {
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

  if (provider === 'storacha') {
    cid = await storachaUploadFile(content, fileName)
  } else if (provider === 'pinata') {
    cid = await pinataUploadFile(content, fileName)
  } else {
    cid = localFakeCID(content)
  }

  return { cid, gatewayUrl: getIPFSGatewayURL(cid), provider }
}
