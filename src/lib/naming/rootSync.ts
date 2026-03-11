// Root sync relayer for Merkle naming.
// Watches the canonical chain (Ethereum Sepolia) for root changes and
// pushes them to all destination chain NameVerifier contracts.

import { ethers } from 'ethers';
import { getChainConfig, getSupportedChains, getCanonicalNamingChain } from '@/config/chains';
import { getServerProvider, getServerSponsor, getTxGasOverrides } from '@/lib/server-provider';

const NAME_REGISTRY_MERKLE_ABI = [
  'function getLastRoot() view returns (bytes32)',
];

const NAME_VERIFIER_ABI = [
  'function updateRoot(bytes32 newRoot) external',
  'function getLastRoot() view returns (bytes32)',
];

// ─── State ──────────────────────────────────────────────────────────────

let lastSyncedRoot: string | null = null;
let registrationsSinceSync = 0;
let syncTimer: ReturnType<typeof setInterval> | null = null;

const BATCH_THRESHOLD = 10;
const SYNC_INTERVAL_MS = 600_000; // 10 minutes

// ─── Core Sync ──────────────────────────────────────────────────────────

export async function syncRootToAllChains(): Promise<{
  root: string;
  synced: { chainId: number; txHash: string }[];
  errors: { chainId: number; error: string }[];
}> {
  const canonicalChain = getCanonicalNamingChain();
  const canonicalChainId = canonicalChain.id;
  const canonicalConfig = getChainConfig(canonicalChainId);
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  if (!canonicalConfig.contracts.nameRegistryMerkle || canonicalConfig.contracts.nameRegistryMerkle === ZERO_ADDRESS) {
    return { root: ethers.constants.HashZero, synced: [], errors: [{ chainId: canonicalChainId, error: 'No nameRegistryMerkle configured' }] };
  }

  const canonicalProvider = getServerProvider(canonicalChainId);
  const canonicalRegistry = new ethers.Contract(
    canonicalConfig.contracts.nameRegistryMerkle,
    NAME_REGISTRY_MERKLE_ABI,
    canonicalProvider,
  );
  let currentRoot: string;
  try {
    currentRoot = await canonicalRegistry.getLastRoot();
  } catch (e) {
    // getLastRoot reverts on a fresh tree with no leaves — treat as empty
    console.warn('[RootSync] getLastRoot failed on canonical chain (empty tree?):', e instanceof Error ? e.message : e);
    return { root: ethers.constants.HashZero, synced: [], errors: [] };
  }

  if (currentRoot === lastSyncedRoot) {
    return { root: currentRoot, synced: [], errors: [] };
  }

  const destinationChains = getSupportedChains().filter(
    c => c.id !== canonicalChainId
      && c.contracts.nameVerifier
      && c.contracts.nameVerifier !== ZERO_ADDRESS
  );

  const synced: { chainId: number; txHash: string }[] = [];
  const errors: { chainId: number; error: string }[] = [];

  await Promise.allSettled(
    destinationChains.map(async (chain) => {
      try {
        const sponsor = getServerSponsor(chain.id);
        const verifier = new ethers.Contract(
          chain.contracts.nameVerifier!,
          NAME_VERIFIER_ABI,
          sponsor,
        );

        let chainRoot: string;
        try {
          chainRoot = await verifier.getLastRoot();
        } catch {
          // Fresh verifier with no root set — needs update
          chainRoot = ethers.constants.HashZero;
        }
        if (chainRoot === currentRoot) {
          synced.push({ chainId: chain.id, txHash: 'already-synced' });
          return;
        }

        const gasOverrides = await getTxGasOverrides(chain.id, 200_000);
        const tx = await verifier.updateRoot(currentRoot, gasOverrides);
        const receipt = await tx.wait();
        synced.push({ chainId: chain.id, txHash: receipt.transactionHash });
        console.log(`[RootSync] Synced root to ${chain.name}: ${receipt.transactionHash}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ chainId: chain.id, error: msg });
        console.warn(`[RootSync] Failed to sync to chain ${chain.id}:`, msg);
      }
    })
  );

  lastSyncedRoot = currentRoot;
  registrationsSinceSync = 0;

  return { root: currentRoot, synced, errors };
}

// ─── Triggers ───────────────────────────────────────────────────────────

/** Called after each name registration. Syncs if batch threshold reached. */
export function onNameRegistered(): void {
  registrationsSinceSync++;
  if (registrationsSinceSync >= BATCH_THRESHOLD) {
    syncRootToAllChains().catch(e =>
      console.error('[RootSync] Batch sync failed:', e)
    );
  }
}

/** Start the periodic sync timer. Call once on server startup. */
export function startPeriodicSync(): void {
  if (syncTimer) return;
  syncTimer = setInterval(() => {
    syncRootToAllChains().catch(e =>
      console.error('[RootSync] Periodic sync failed:', e)
    );
  }, SYNC_INTERVAL_MS);

  syncRootToAllChains().catch(e =>
    console.error('[RootSync] Initial sync failed:', e)
  );
}

/** Stop the periodic sync timer. */
export function stopPeriodicSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}
