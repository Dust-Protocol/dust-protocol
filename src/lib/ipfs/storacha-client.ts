/**
 * IPFS pinning utility for PL Genesis Hackathon.
 *
 * Supports multiple providers via IPFS_PROVIDER env var:
 *   - 'storacha' — Storacha (w3up-client) with UCAN delegations (requires W3_PRIVATE_KEY + W3_PROOF)
 *   - 'pinata'   — Pinata pinning API (requires PINATA_API_KEY + PINATA_SECRET_KEY)
 *   - 'local'    — Mock provider returning deterministic fake CIDs (testing)
 *
 * Gateway URL is configurable via IPFS_GATEWAY_URL (defaults to w3s.link).
 */

import { createHash } from 'crypto'

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

// ─── Storacha Provider ──────────────────────────────────────────────────────────

// Singleton w3up-client — avoids re-initializing on every request.
// StoreMemory holds agent keypair + proofs in RAM only (serverless-safe).
let storachaClientPromise: Promise<unknown> | null = null

async function getStorachaClient() {
  if (storachaClientPromise) return storachaClientPromise

  storachaClientPromise = (async () => {
    const privateKey = process.env.W3_PRIVATE_KEY
    const proofStr = process.env.W3_PROOF
    if (!privateKey || !proofStr) {
      throw new Error('W3_PRIVATE_KEY and W3_PROOF env vars required for storacha provider')
    }

    // Dynamic imports — these are large packages, only load when needed
    const Client = await import('@web3-storage/w3up-client')
    const { StoreMemory } = await import('@web3-storage/w3up-client/stores/memory')
    const Proof = await import('@web3-storage/w3up-client/proof')
    const { Signer } = await import('@web3-storage/w3up-client/principal/ed25519')

    const signer = Signer.parse(privateKey)
    const store = new StoreMemory()
    const client = await Client.create({ principal: signer, store })

    const proof = await Proof.parse(proofStr)
    const space = await client.addSpace(proof)
    await client.setCurrentSpace(space.did())

    return client
  })()

  return storachaClientPromise
}

async function storachaUploadJSON(data: unknown): Promise<string> {
  const client = await getStorachaClient() as { uploadFile: (file: Blob) => Promise<{ toString: () => string }> }
  const json = JSON.stringify(data)
  const blob = new Blob([json], { type: 'application/json' })
  const cid = await client.uploadFile(blob)
  return cid.toString()
}

async function storachaUploadFile(content: Buffer, fileName: string): Promise<string> {
  const client = await getStorachaClient() as { uploadFile: (file: File) => Promise<{ toString: () => string }> }
  const blob = new Blob([content])
  const file = new File([blob], fileName)
  const cid = await client.uploadFile(file)
  return cid.toString()
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
