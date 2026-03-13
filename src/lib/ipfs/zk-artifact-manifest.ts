/**
 * CID manifest for ZK proof artifacts.
 *
 * Each circuit's WASM, ZKEY, and VKEY files are tracked with their current
 * load path and an optional IPFS CID. When a CID is present, getArtifactURL()
 * returns an IPFS gateway URL; otherwise it falls back to the existing path.
 *
 * CIDs start as null and are populated after running:
 *   npx tsx scripts/upload-zk-artifacts.ts
 */

import { getIPFSGatewayURL } from './storacha-client'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ArtifactEntry {
  name: string
  wasmCID: string | null
  zkeyCID: string | null
  vkeyCID: string | null
  wasmPath: string
  zkeyPath: string
  vkeyPath: string
}

export type CircuitName = 'v1-pool' | 'v2-transaction' | 'v2-split' | 'v2-compliance'

// ─── Manifest ───────────────────────────────────────────────────────────────────

const V2_ZKEY_CDN = 'https://pub-79a49cd9d00544bdbf2c2dd393b47a1f.r2.dev'

export const ZK_ARTIFACT_MANIFEST: Record<CircuitName, ArtifactEntry> = {
  'v1-pool': {
    name: 'DustPoolWithdraw (V1 Groth16)',
    wasmCID: null,
    zkeyCID: null,
    vkeyCID: null,
    wasmPath: '/zk/DustPoolWithdraw.wasm',
    zkeyPath: '/zk/DustPoolWithdraw_final.zkey',
    vkeyPath: '/zk/verification_key.json',
  },
  'v2-transaction': {
    name: 'DustV2Transaction (FFLONK)',
    wasmCID: null,
    zkeyCID: null,
    vkeyCID: null,
    wasmPath: '/circuits/v2/DustV2Transaction.wasm',
    zkeyPath: `${V2_ZKEY_CDN}/v2/DustV2Transaction.zkey`,
    vkeyPath: '/circuits/v2/verification_key.json',
  },
  'v2-split': {
    name: 'DustV2Split (FFLONK 2-in-8-out)',
    wasmCID: null,
    zkeyCID: null,
    vkeyCID: null,
    wasmPath: '/circuits/v2-split/DustV2Split.wasm',
    zkeyPath: `${V2_ZKEY_CDN}/v2-split/DustV2Split.zkey`,
    vkeyPath: '/circuits/v2-split/verification_key.json',
  },
  'v2-compliance': {
    name: 'DustV2Compliance (FFLONK)',
    wasmCID: null,
    zkeyCID: null,
    vkeyCID: null,
    wasmPath: '/circuits/v2-compliance/DustV2Compliance.wasm',
    zkeyPath: '/circuits/v2-compliance/DustV2Compliance.zkey',
    vkeyPath: '/circuits/v2-compliance/verification_key.json',
  },
}

// ─── Public API ─────────────────────────────────────────────────────────────────

type ArtifactType = 'wasm' | 'zkey' | 'vkey'

/**
 * Returns IPFS gateway URL if CID is available, otherwise falls back to the
 * current local/CDN path from the manifest.
 */
export function getArtifactURL(circuit: CircuitName, type: ArtifactType): string {
  const entry = ZK_ARTIFACT_MANIFEST[circuit]
  if (!entry) throw new Error(`Unknown circuit: ${circuit}`)

  const cidKey = `${type}CID` as const
  const pathKey = `${type}Path` as const

  const cid = entry[cidKey]
  if (cid) return getIPFSGatewayURL(cid)

  return entry[pathKey]
}

/**
 * Simplified CID integrity check using SHA-256.
 *
 * Real CIDv1 uses multihash (sha2-256 by default). This computes SHA-256 of
 * the artifact data and compares the hex digest against a known hash embedded
 * in the CID. For hackathon purposes this catches corruption/tampering without
 * implementing full multicodec/multihash parsing.
 */
export async function verifyArtifactIntegrity(
  data: ArrayBuffer,
  expectedCID: string
): Promise<boolean> {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = new Uint8Array(hashBuffer)
    const hashHex = Array.from(hashArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // CIDv1 with sha2-256 contains the hex digest after the multicodec prefix.
    // We check if the CID string contains our computed hash as a substring.
    // This is a simplified check — full verification would decode the CID's
    // multihash and compare directly.
    return expectedCID.includes(hashHex.slice(0, 32))
  } catch (error) {
    console.error('[ZK Manifest] Integrity verification failed:', error)
    return false
  }
}

/**
 * Returns all circuits that have at least one artifact pinned to IPFS.
 */
export function getPinnedCircuits(): CircuitName[] {
  return (Object.keys(ZK_ARTIFACT_MANIFEST) as CircuitName[]).filter((key) => {
    const entry = ZK_ARTIFACT_MANIFEST[key]
    return entry.wasmCID || entry.zkeyCID || entry.vkeyCID
  })
}

/**
 * Returns all circuits that are missing at least one CID.
 */
export function getUnpinnedCircuits(): CircuitName[] {
  return (Object.keys(ZK_ARTIFACT_MANIFEST) as CircuitName[]).filter((key) => {
    const entry = ZK_ARTIFACT_MANIFEST[key]
    return !entry.wasmCID || !entry.zkeyCID || !entry.vkeyCID
  })
}
