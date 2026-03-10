// Server-side Merkle tree manager for the V2 relayer.
//
// Maintains an incremental Poseidon Merkle tree per chain, lazily initialized
// from on-chain DepositQueued events. Module-level singletons survive across
// Next.js API requests within the same serverless function instance.

import { ethers } from 'ethers'
import { readFile, writeFile } from 'fs/promises'
import { getServerProvider, getServerSponsor, getCachedBlockNumber, getTxGasOverrides } from '@/lib/server-provider'
import { getDustPoolV2Address, DUST_POOL_V2_ABI } from './contracts'
import { MerkleTree } from '../merkle'
import { toBytes32Hex } from '../poseidon'

// ─── Constants ──────────────────────────────────────────────────────────────────

// Block to start scanning from per chain (safe lower bound — V2 deployed after V1)
const V2_START_BLOCKS: Record<number, number> = {
  11155111: 10311323,
  111551119090: 6482414,
  421614: 246397522,
  11155420: 40333105,
  84532: 38350239,
  545: 99040904,       // Flow EVM Testnet (matches deploymentBlock in chains.ts)
}

// L2s support larger log ranges; drpc.org enforces 10K on Eth Sepolia
const EVENT_SCAN_CHUNK_BY_CHAIN: Record<number, number> = {
  11155111: 10_000,     // Eth Sepolia (drpc.org limit)
  111551119090: 10_000, // Thanos Sepolia
  84532: 50_000,        // Base Sepolia (2s blocks, native RPC)
  421614: 50_000,       // Arbitrum Sepolia (~0.25s blocks)
  11155420: 50_000,     // OP Sepolia (2s blocks)
  545: 50_000,          // Flow EVM Testnet (~1s blocks)
}
const DEFAULT_EVENT_SCAN_CHUNK = 10_000

function getEventScanChunk(chainId: number): number {
  return EVENT_SCAN_CHUNK_BY_CHAIN[chainId] ?? DEFAULT_EVENT_SCAN_CHUNK
}

// ─── Tree State ─────────────────────────────────────────────────────────────────

interface TreeState {
  tree: MerkleTree
  lastSyncedBlock: number
  /** commitment bytes32 hex → leaf index in Merkle tree */
  commitmentToLeafIndex: Map<string, number>
  /** Last root posted on-chain via updateRoot() */
  lastPostedRoot: bigint
}

const trees = new Map<number, TreeState>()
const syncPromises = new Map<number, Promise<TreeState>>()

// ─── Checkpoint Persistence ─────────────────────────────────────────────────────

interface TreeCheckpoint {
  version: 1
  chainId: number
  lastSyncedBlock: number
  leafCount: number
  commitments: string[]
  savedAt: number
}

function checkpointPath(chainId: number): string {
  return `/tmp/dust-v2-tree-${chainId}.json`
}

async function loadCheckpoint(chainId: number): Promise<TreeCheckpoint | null> {
  try {
    const data = await readFile(checkpointPath(chainId), 'utf-8')
    const cp: TreeCheckpoint = JSON.parse(data)
    if (
      cp.version !== 1 ||
      cp.chainId !== chainId ||
      !Array.isArray(cp.commitments) ||
      cp.commitments.length !== cp.leafCount
    ) {
      return null
    }
    return cp
  } catch {
    return null
  }
}

function saveCheckpointAsync(chainId: number, state: TreeState): void {
  const commitments: string[] = []
  for (let i = 0; i < state.tree.leafCount; i++) {
    const leaf = state.tree.getLeaf(i)
    if (leaf !== undefined) {
      commitments.push('0x' + leaf.toString(16).padStart(64, '0'))
    }
  }

  const checkpoint: TreeCheckpoint = {
    version: 1,
    chainId,
    lastSyncedBlock: state.lastSyncedBlock,
    leafCount: state.tree.leafCount,
    commitments,
    savedAt: Date.now(),
  }

  writeFile(checkpointPath(chainId), JSON.stringify(checkpoint))
    .then(() => console.log(`[V2Relayer] Checkpoint saved: chain=${chainId} leaves=${checkpoint.leafCount} block=${checkpoint.lastSyncedBlock}`))
    .catch(() => {})
}

// ─── Core Sync ──────────────────────────────────────────────────────────────────

/**
 * Ensure the tree for the given chain is synced with on-chain state.
 * Uses promise-based locking to prevent concurrent syncs for the same chain.
 */
export async function ensureSynced(chainId: number): Promise<TreeState> {
  const existing = syncPromises.get(chainId)
  if (existing) return existing

  const promise = syncInternal(chainId)
  syncPromises.set(chainId, promise)

  try {
    return await promise
  } finally {
    syncPromises.delete(chainId)
  }
}

async function syncInternal(chainId: number): Promise<TreeState> {
  const address = getDustPoolV2Address(chainId)
  if (!address) throw new Error(`DustPoolV2 not deployed on chain ${chainId}`)

  let state = trees.get(chainId)
  if (!state) {
    // Cold start — try to restore from checkpoint before full rescan
    const checkpoint = await loadCheckpoint(chainId)
    if (checkpoint && checkpoint.commitments.length > 0) {
      console.log(`[V2Relayer] Restoring from checkpoint: chain=${chainId} leaves=${checkpoint.leafCount} block=${checkpoint.lastSyncedBlock}`)
      const tree = await MerkleTree.create(20)
      const commitmentMap = new Map<string, number>()
      for (const hex of checkpoint.commitments) {
        const leafIndex = await tree.insert(BigInt(hex))
        commitmentMap.set(hex.toLowerCase(), leafIndex)
      }
      state = {
        tree,
        lastSyncedBlock: checkpoint.lastSyncedBlock,
        commitmentToLeafIndex: commitmentMap,
        lastPostedRoot: 0n,
      }
    } else {
      const tree = await MerkleTree.create(20)
      state = {
        tree,
        lastSyncedBlock: (V2_START_BLOCKS[chainId] ?? 0) - 1,
        commitmentToLeafIndex: new Map(),
        lastPostedRoot: 0n,
      }
    }
    trees.set(chainId, state)
  }

  const provider = getServerProvider(chainId)
  const currentBlock = await getCachedBlockNumber(chainId)

  if (state.lastSyncedBlock >= currentBlock) return state

  const contract = new ethers.Contract(address, DUST_POOL_V2_ABI as unknown as ethers.ContractInterface, provider)
  const fromBlock = state.lastSyncedBlock + 1
  const chunkSize = getEventScanChunk(chainId)

  for (let from = fromBlock; from <= currentBlock; from += chunkSize) {
    const to = Math.min(from + chunkSize - 1, currentBlock)
    const events = await contract.queryFilter(
      contract.filters.DepositQueued(),
      from,
      to,
    )

    // Events arrive in block+logIndex order — matches contract queue order
    for (const event of events) {
      const commitment = event.args!.commitment as string
      const commitmentLower = commitment.toLowerCase()

      if (!state.commitmentToLeafIndex.has(commitmentLower)) {
        const leafIndex = await state.tree.insert(BigInt(commitment))
        state.commitmentToLeafIndex.set(commitmentLower, leafIndex)
      }
    }
  }

  state.lastSyncedBlock = currentBlock
  saveCheckpointAsync(chainId, state)
  return state
}

// ─── Root Update ────────────────────────────────────────────────────────────────

/**
 * Post the current Merkle root on-chain if it differs from the last posted root.
 * Returns true if a new root was posted.
 */
export async function postRootIfNeeded(chainId: number): Promise<boolean> {
  const state = trees.get(chainId)
  if (!state) return false

  const currentRoot = state.tree.root
  if (currentRoot === state.lastPostedRoot) return false

  const address = getDustPoolV2Address(chainId)
  if (!address) return false

  const sponsor = getServerSponsor(chainId)
  const contract = new ethers.Contract(address, DUST_POOL_V2_ABI as unknown as ethers.ContractInterface, sponsor)

  const rootHex = toBytes32Hex(currentRoot)

  try {
    const gasOverrides = await getTxGasOverrides(chainId, 200_000)
    const tx = await contract.updateRoot(rootHex, gasOverrides)
    await tx.wait()
    state.lastPostedRoot = currentRoot
    console.log(`[V2Relayer] Posted root ${rootHex.slice(0, 18)}... on chain ${chainId}`)
    return true
  } catch (e) {
    console.error(`[V2Relayer] updateRoot failed on chain ${chainId}:`, e instanceof Error ? e.message : e)
    return false
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Sync tree and post root if needed. Call before serving proofs or processing TXs.
 */
export async function syncAndPostRoot(chainId: number): Promise<TreeState> {
  const state = await ensureSynced(chainId)
  await postRootIfNeeded(chainId)
  return state
}

/**
 * Get the current Merkle tree root for a chain.
 */
export async function getRelayerTreeRoot(chainId: number): Promise<bigint> {
  const state = await syncAndPostRoot(chainId)
  return state.tree.root
}

/**
 * Get a Merkle proof for a leaf at the given index.
 */
export async function getRelayerTreeProof(
  chainId: number,
  leafIndex: number,
): Promise<{ pathElements: bigint[]; pathIndices: number[] }> {
  const state = await syncAndPostRoot(chainId)

  if (leafIndex < 0 || leafIndex >= state.tree.leafCount) {
    throw new Error(`Leaf index ${leafIndex} out of range (tree has ${state.tree.leafCount} leaves)`)
  }

  const proof = await state.tree.getProofAsync(leafIndex)
  return { pathElements: proof.pathElements, pathIndices: proof.pathIndices }
}

/**
 * Check if a commitment has been indexed and return its leaf index.
 * Returns null if the commitment is not in the tree.
 * Normalizes the commitment to bytes32 hex for consistent map lookup
 * (client sends unpadded hex via bigintToHex, events are bytes32).
 */
export async function getDepositLeafIndex(
  chainId: number,
  commitment: string,
): Promise<number | null> {
  const state = await ensureSynced(chainId)
  // Normalize to 0x + 64 hex chars (bytes32 format) for consistent lookup
  const normalized = ('0x' + BigInt(commitment).toString(16).padStart(64, '0')).toLowerCase()
  const idx = state.commitmentToLeafIndex.get(normalized)
  return idx ?? null
}

/**
 * Get the total number of leaves in the tree.
 */
export async function getTreeLeafCount(chainId: number): Promise<number> {
  const state = await ensureSynced(chainId)
  return state.tree.leafCount
}

/**
 * Get the current tree state snapshot for diagnostics (health endpoint).
 * Syncs the tree but does NOT post root — avoids spending gas on health checks.
 */
export async function getTreeSnapshot(chainId: number): Promise<{
  leafCount: number
  root: bigint
  lastSyncedBlock: number
}> {
  const state = await ensureSynced(chainId)
  return {
    leafCount: state.tree.leafCount,
    root: state.tree.root,
    lastSyncedBlock: state.lastSyncedBlock,
  }
}
