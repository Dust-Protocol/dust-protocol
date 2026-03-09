import { ethers } from 'ethers';
import { NextResponse } from 'next/server';
import { getChainConfig, getSupportedChains, DEFAULT_CHAIN_ID } from '@/config/chains';
import { getServerSponsor, getServerProvider, waitForTx } from '@/lib/server-provider';

export const maxDuration = 60;

const SPONSOR_KEY = process.env.RELAYER_PRIVATE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

const NAME_REGISTRY_ABI = [
  'function registerName(string calldata name, bytes calldata stealthMetaAddress) external',
  'function isNameAvailable(string calldata name) external view returns (bool)',
  'function resolveName(string calldata name) external view returns (bytes)',
  'function getNamesOwnedBy(address owner) external view returns (string[] memory)',
];

/**
 * POST /api/sync-names
 * Syncs all names from the canonical chain (Ethereum Sepolia) to all other chains.
 * This ensures cross-chain name resolution works for existing users.
 */
export async function POST(req: Request) {
  try {
    // Admin-only: requires ADMIN_SECRET bearer token (this endpoint spends deployer gas)
    if (!ADMIN_SECRET) {
      return NextResponse.json({ error: 'Admin secret not configured' }, { status: 500 });
    }
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${ADMIN_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!SPONSOR_KEY) {
      return NextResponse.json({ error: 'Sponsor not configured' }, { status: 500 });
    }

    const canonicalConfig = getChainConfig(DEFAULT_CHAIN_ID);
    const canonicalProvider = getServerProvider(DEFAULT_CHAIN_ID);
    const canonicalRegistry = new ethers.Contract(
      canonicalConfig.contracts.nameRegistry,
      NAME_REGISTRY_ABI,
      canonicalProvider,
    );

    // Get deployer address (names are registered by deployer on behalf of users)
    const deployer = new ethers.Wallet(SPONSOR_KEY).address;

    // Get all names owned by deployer on canonical chain
    const deployerNames: string[] = await canonicalRegistry.getNamesOwnedBy(deployer);

    if (deployerNames.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No names to sync' });
    }

    // Resolve meta-addresses for each name
    const nameData: Array<{ name: string; metaBytes: string }> = [];
    for (const name of deployerNames) {
      try {
        const metaBytes: string = await canonicalRegistry.resolveName(name);
        if (metaBytes && metaBytes !== '0x' && metaBytes.length > 4) {
          nameData.push({ name, metaBytes });
        }
      } catch {
        continue;
      }
    }

    // Mirror to all other chains
    const otherChains = getSupportedChains().filter(c => c.id !== DEFAULT_CHAIN_ID && c.contracts.nameRegistry);
    let totalSynced = 0;
    const results: Array<{ chain: string; synced: number; errors: number }> = [];

    for (const chain of otherChains) {
      let synced = 0;
      let errors = 0;

      try {
        const sponsor = getServerSponsor(chain.id);
        const registry = new ethers.Contract(chain.contracts.nameRegistry, NAME_REGISTRY_ABI, sponsor);

        for (const { name, metaBytes } of nameData) {
          try {
            const available = await registry.isNameAvailable(name);
            if (!available) continue; // already registered

            const tx = await registry.registerName(name, metaBytes);
            await waitForTx(tx);
            synced++;
            totalSynced++;
            console.log(`[SyncNames] Synced "${name}" to ${chain.name}`);
          } catch (e) {
            errors++;
            console.warn(`[SyncNames] Failed to sync "${name}" to ${chain.name}:`, e);
          }
        }
      } catch (e) {
        console.error(`[SyncNames] Chain ${chain.name} error:`, e);
        errors = nameData.length;
      }

      results.push({ chain: chain.name, synced, errors });
    }

    return NextResponse.json({
      totalNames: nameData.length,
      totalSynced,
      results,
    });
  } catch (e) {
    console.error('[SyncNames] Error:', e);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
