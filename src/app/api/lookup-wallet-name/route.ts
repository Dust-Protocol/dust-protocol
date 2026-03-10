// GET /api/lookup-wallet-name?address=0x...
// Server-side lookup: wallet address → registered name
// Multi-strategy lookup (in order of reliability):
//   1. Direct contract read: stealthMetaAddressOf(wallet, 1) → match against subgraph names
//   2. ERC-6538 StealthMetaAddressSet events (to get historical on-chain metaAddresses)
//   3. Name tree entries (name → metaAddress mapping)
//   4. Direct RPC scan of deployer names (slowest but most thorough)
// This is the most reliable fallback for cleared-cache / new-browser scenarios.

import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getServerProvider } from '@/lib/server-provider';
import { getVisibleChains } from '@/config/chains';
import { getNameMerkleTree } from '@/lib/naming/merkleTree';

export const maxDuration = 15;

const ERC6538_ABI = [
  'event StealthMetaAddressSet(indexed address registrant, indexed uint256 schemeId, bytes stealthMetaAddress)',
  'function stealthMetaAddressOf(address registrant, uint256 schemeId) external view returns (bytes)',
];

const NAME_REGISTRY_ABI = [
  'function getNamesOwnedBy(address owner) external view returns (string[] memory)',
  'function resolveName(string calldata name) external view returns (bytes)',
];

const DEPLOYER = process.env.SPONSOR_ADDRESS ?? '0x8d56E94a02F06320BDc68FAfE23DEc9Ad7463496';

// Chain-specific subgraph URLs (matches client-side src/lib/graph/client.ts)
const SUBGRAPH_URLS: Record<number, string | undefined> = {
  111551119090: process.env.NEXT_PUBLIC_SUBGRAPH_URL_THANOS || undefined,
  11155111: process.env.NEXT_PUBLIC_SUBGRAPH_URL_SEPOLIA
    || 'https://api.studio.thegraph.com/query/1741961/dust-protocol-sepolia/v0.0.2',
};

/** Query all chain subgraphs for names matching a metaAddress */
async function querySubgraphNamesByMeta(metaAddress: string): Promise<{ name: string; metaAddress: string } | null> {
  const urls = Object.values(SUBGRAPH_URLS).filter(Boolean) as string[];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query($meta: String!) { names(where: { metaAddress: $meta }, first: 1) { name metaAddress } }`,
          variables: { meta: metaAddress.toLowerCase() },
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const names = data?.data?.names;
      if (names?.length > 0) return names[0];
    } catch { continue; }
  }
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  }

  try {
    const chains = getVisibleChains();
    const historicalMetas = new Set<string>();

    // Strategy 0: Direct name ownership — check if wallet directly owns names
    // (catches cases where sponsor-name-register auto-transfer succeeded)
    for (const chain of chains) {
      if (!chain.contracts.nameRegistry) continue;
      try {
        const provider = getServerProvider(chain.id);
        const registry = new ethers.Contract(chain.contracts.nameRegistry, NAME_REGISTRY_ABI, provider);
        const userNames: string[] = await registry.getNamesOwnedBy(address);
        if (userNames.length > 0) {
          const resolved: string = await registry.resolveName(userNames[0]);
          return NextResponse.json({
            name: userNames[0],
            metaAddress: resolved || '',
            source: 'direct-ownership',
          }, {
            headers: { 'Cache-Control': 'private, max-age=60' },
          });
        }
      } catch { /* continue to next chain */ }
    }

    // Strategy 1: Direct contract read — stealthMetaAddressOf(wallet, 1)
    // This is the fastest and most reliable check (single RPC call per chain)
    const directReadResults = await Promise.allSettled(
      chains.map(async (chain) => {
        const registryAddr = chain.contracts.registry;
        if (!registryAddr) return null;
        try {
          const provider = getServerProvider(chain.id);
          const erc6538 = new ethers.Contract(registryAddr, ERC6538_ABI, provider);
          const meta: string = await erc6538.stealthMetaAddressOf(address, 1);
          if (meta && meta !== '0x' && meta.length > 2) {
            return meta;
          }
        } catch { /* silent */ }
        return null;
      })
    );

    for (const result of directReadResults) {
      if (result.status === 'fulfilled' && result.value) {
        historicalMetas.add(result.value.toLowerCase());
      }
    }

    // If we found a current metaAddress, search subgraph for matching names
    if (historicalMetas.size > 0) {
      for (const meta of historicalMetas) {
        const nameFromGraph = await querySubgraphNamesByMeta(meta);
        if (nameFromGraph) {
          return NextResponse.json({
            name: nameFromGraph.name,
            metaAddress: nameFromGraph.metaAddress,
            source: 'direct-read+graph',
          }, {
            headers: { 'Cache-Control': 'private, max-age=60' },
          });
        }
      }
    }

    // Strategy 2: ERC-6538 event scanning (catches historical registrations that may have been overwritten)
    const eventResults = await Promise.allSettled(
      chains.map(async (chain) => {
        const registryAddr = chain.contracts.registry;
        if (!registryAddr) return [];
        try {
          const provider = getServerProvider(chain.id);
          const erc6538 = new ethers.Contract(registryAddr, ERC6538_ABI, provider);
          const filter = erc6538.filters.StealthMetaAddressSet(address, 1);
          return await erc6538.queryFilter(filter, chain.deploymentBlock);
        } catch {
          return [];
        }
      })
    );

    for (const result of eventResults) {
      if (result.status !== 'fulfilled') continue;
      for (const evt of result.value) {
        if (evt.args) {
          historicalMetas.add((evt.args.stealthMetaAddress as string).toLowerCase());
        }
      }
    }

    // Check new metas from events against subgraph
    if (historicalMetas.size > 0) {
      for (const meta of historicalMetas) {
        const nameFromGraph = await querySubgraphNamesByMeta(meta);
        if (nameFromGraph) {
          return NextResponse.json({
            name: nameFromGraph.name,
            metaAddress: nameFromGraph.metaAddress,
            source: 'events+graph',
          }, {
            headers: { 'Cache-Control': 'private, max-age=60' },
          });
        }
      }
    }

    // Strategy 3: Match against name tree entries
    const tree = getNameMerkleTree().exportTree();
    if (tree.entries.length > 0 && historicalMetas.size > 0) {
      for (const entry of tree.entries) {
        if (historicalMetas.has(entry.metaAddress.toLowerCase())) {
          return NextResponse.json({
            name: entry.name,
            metaAddress: entry.metaAddress,
            source: 'tree',
          }, {
            headers: { 'Cache-Control': 'private, max-age=60' },
          });
        }
      }
    }

    // Strategy 4: Direct RPC — check deployer-owned names on all chains
    // Always runs as last resort (catches cases where ERC-6538 was never registered)
    if (historicalMetas.size > 0) {
      for (const chain of chains) {
        if (!chain.contracts.nameRegistry) continue;
        try {
          const provider = getServerProvider(chain.id);
          const registry = new ethers.Contract(chain.contracts.nameRegistry, NAME_REGISTRY_ABI, provider);
          const deployerNames: string[] = await registry.getNamesOwnedBy(DEPLOYER);
          for (const name of deployerNames) {
            try {
              const resolved: string = await registry.resolveName(name);
              if (resolved && historicalMetas.has(resolved.toLowerCase())) {
                return NextResponse.json({
                  name,
                  metaAddress: resolved,
                  source: 'rpc',
                }, {
                  headers: { 'Cache-Control': 'private, max-age=60' },
                });
              }
            } catch { continue; }
          }
        } catch { continue; }
      }
    }

    // No name found
    return NextResponse.json({ name: null }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    console.error('[lookup-wallet-name] Error:', e);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
