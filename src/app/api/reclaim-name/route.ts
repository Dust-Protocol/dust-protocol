// GET /api/reclaim-name?metaAddress=0x...
// Server-side lookup: metaAddress → registered name
// Used by the "I already have an account" reclaim flow.
// The user derives their metaAddress via PIN, and we search for names
// that were registered with that metaAddress (even if owned by deployer).

import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getServerProvider } from '@/lib/server-provider';
import { getVisibleChains } from '@/config/chains';

export const maxDuration = 15;

const NAME_REGISTRY_ABI = [
  'function getNamesOwnedBy(address owner) external view returns (string[] memory)',
  'function resolveName(string calldata name) external view returns (bytes)',
];

const DEPLOYER = process.env.SPONSOR_ADDRESS ?? '0x8d56E94a02F06320BDc68FAfE23DEc9Ad7463496';

// The Graph subgraph URL
const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL
  || 'https://api.studio.thegraph.com/query/1741961/dust-protocol-sepolia/v0.0.2';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const metaAddress = searchParams.get('metaAddress');
  // registrant param intentionally removed — name transfers use sponsor-name-transfer with auth

  if (!metaAddress || !/^0x[0-9a-fA-F]+$/.test(metaAddress)) {
    return NextResponse.json({ error: 'Invalid metaAddress' }, { status: 400 });
  }

  const normalizedMeta = metaAddress.toLowerCase();

  try {
    // Strategy 1: Query subgraph for names with this metaAddress
    let foundName: string | null = null;
    try {
      const res = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query($meta: String!) { names(where: { metaAddress: $meta }, first: 1) { name metaAddress ownerAddress } }`,
          variables: { meta: normalizedMeta },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const names = data?.data?.names;
        if (names?.length > 0) {
          foundName = names[0].name;
        }
      }
    } catch { /* silent */ }

    // Strategy 2: Direct RPC — scan deployer-owned names on all chains
    if (!foundName) {
      const chains = getVisibleChains();
      for (const chain of chains) {
        if (!chain.contracts.nameRegistry) continue;
        try {
          const provider = getServerProvider(chain.id);
          const registry = new ethers.Contract(chain.contracts.nameRegistry, NAME_REGISTRY_ABI, provider);
          const deployerNames: string[] = await registry.getNamesOwnedBy(DEPLOYER);
          for (const name of deployerNames) {
            try {
              const resolved: string = await registry.resolveName(name);
              if (resolved && resolved.toLowerCase() === normalizedMeta) {
                foundName = name;
                break;
              }
            } catch { continue; }
          }
          if (foundName) break;
        } catch { continue; }
      }
    }

    if (!foundName) {
      return NextResponse.json({ name: null }, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    return NextResponse.json({
      name: foundName,
      metaAddress: normalizedMeta,
    }, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  } catch (e) {
    console.error('[reclaim-name] Error:', e);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
