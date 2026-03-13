/**
 * ZK artifact URL resolution with IPFS gateway fallback.
 *
 * Priority order:
 *   1. Environment variable override (NEXT_PUBLIC_V2_ZKEY_URL, etc.)
 *   2. R2 CDN URL from the manifest
 *   3. IPFS gateway URL (when CID is populated in the manifest)
 *   4. Local path from the manifest
 */

import {
  ZK_ARTIFACT_MANIFEST,
  type CircuitName,
} from '../../ipfs/zk-artifact-manifest'
import { getIPFSGatewayURL } from '../../ipfs/storacha-client'

type ArtifactType = 'wasm' | 'zkey' | 'vkey'

// Env var overrides per circuit+type (only the ones that exist today)
const ENV_OVERRIDES: Partial<Record<string, string | undefined>> = {
  'v2-transaction:zkey': process.env.NEXT_PUBLIC_V2_ZKEY_URL,
  'v2-split:zkey': process.env.NEXT_PUBLIC_V2_SPLIT_ZKEY_URL,
}

/**
 * Resolve the best available URL for a ZK artifact.
 *
 * Falls through: env var → R2 CDN → IPFS gateway → local path.
 * IPFS is only returned when the manifest has a non-null CID for the artifact.
 */
export function getZkArtifactWithFallback(
  circuit: CircuitName,
  type: ArtifactType
): string {
  const envVal = ENV_OVERRIDES[`${circuit}:${type}`]
  if (envVal) return envVal

  const entry = ZK_ARTIFACT_MANIFEST[circuit]
  if (!entry) throw new Error(`Unknown circuit: ${circuit}`)

  const pathKey = `${type}Path` as const
  const cdnPath = entry[pathKey]

  // R2 CDN paths start with https://
  if (cdnPath.startsWith('https://')) return cdnPath

  const cidKey = `${type}CID` as const
  const cid = entry[cidKey]
  if (cid) return getIPFSGatewayURL(cid)

  return cdnPath
}

/**
 * Returns the IPFS gateway URL for a specific artifact, or null if no CID is set.
 * Useful for prefetch hints where you only want to prefetch if IPFS is available.
 */
export function getIPFSArtifactURL(
  circuit: CircuitName,
  type: ArtifactType
): string | null {
  const entry = ZK_ARTIFACT_MANIFEST[circuit]
  if (!entry) return null

  const cidKey = `${type}CID` as const
  const cid = entry[cidKey]
  return cid ? getIPFSGatewayURL(cid) : null
}
