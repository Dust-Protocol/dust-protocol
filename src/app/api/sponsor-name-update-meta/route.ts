import { ethers } from 'ethers';
import { NextResponse } from 'next/server';
import { getChainConfig, getCanonicalNamingChain } from '@/config/chains';
import { getServerSponsor, parseChainId, waitForTx } from '@/lib/server-provider';
import { checkOrigin } from '@/lib/api-auth';

export const maxDuration = 60;

const SPONSOR_KEY = process.env.RELAYER_PRIVATE_KEY;

const NAME_REGISTRY_ABI = [
  'function updateMetaAddress(string calldata name, bytes calldata newMetaAddress) external',
  'function getOwner(string calldata name) external view returns (address)',
];

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const updateCooldowns = new Map<string, number>();
const UPDATE_COOLDOWN_MS = 30_000;
const MAX_UPDATE_ENTRIES = 500;

export async function POST(req: Request) {
  try {
    const originError = checkOrigin(req);
    if (originError) return originError;

    if (!SPONSOR_KEY) {
      return NextResponse.json({ error: 'Sponsor not configured' }, { status: 500 });
    }

    const body = await req.json();
    const requestedChainId = parseChainId(body);
    const requestedConfig = getChainConfig(requestedChainId);
    // Route to canonical chain when chain has no nameRegistry (L2s)
    const chainId = requestedConfig.contracts.nameRegistry ? requestedChainId : getCanonicalNamingChain().id;
    const config = getChainConfig(chainId);

    const { name, newMetaAddress } = body;

    if (!name || !newMetaAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const stripped = name.toLowerCase().replace(/\.dust$/, '').trim();
    if (!stripped || stripped.length > 32 || !/^[a-zA-Z0-9_-]+$/.test(stripped)) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    const metaBytes = newMetaAddress.startsWith('st:')
      ? '0x' + (newMetaAddress.match(/st:[a-z]+:0x([0-9a-fA-F]+)/)?.[1] || '')
      : newMetaAddress.startsWith('0x') ? newMetaAddress : '0x' + newMetaAddress;

    if (!metaBytes || metaBytes === '0x') {
      return NextResponse.json({ error: 'Invalid meta-address' }, { status: 400 });
    }

    // Rate limiting per name
    const now = Date.now();
    if (updateCooldowns.size > MAX_UPDATE_ENTRIES) {
      for (const [k, t] of updateCooldowns) {
        if (now - t > UPDATE_COOLDOWN_MS) updateCooldowns.delete(k);
      }
    }
    const lastUpdate = updateCooldowns.get(stripped);
    if (lastUpdate && now - lastUpdate < UPDATE_COOLDOWN_MS) {
      return NextResponse.json({ error: 'Please wait before updating again' }, { status: 429, headers: NO_STORE });
    }
    updateCooldowns.set(stripped, now);

    const sponsor = getServerSponsor(chainId);
    const registry = new ethers.Contract(config.contracts.nameRegistry, NAME_REGISTRY_ABI, sponsor);

    // Verify the sponsor (deployer) owns this name
    const owner = await registry.getOwner(stripped);
    if (owner.toLowerCase() !== sponsor.address.toLowerCase()) {
      return NextResponse.json({ error: 'Name not owned by sponsor' }, { status: 403 });
    }

    const tx = await registry.updateMetaAddress(stripped, metaBytes);
    const receipt = await waitForTx(tx);
    if (receipt.status === 0) {
      return NextResponse.json({ error: 'Meta-address update reverted on-chain' }, { status: 500, headers: NO_STORE });
    }

    console.log('[SponsorNameUpdateMeta] Updated:', stripped, 'tx:', receipt.transactionHash);

    return NextResponse.json({
      success: true,
      txHash: receipt.transactionHash,
      name: stripped,
    }, { headers: NO_STORE });
  } catch (e) {
    console.error('[SponsorNameUpdateMeta] Error:', e);
    return NextResponse.json({ error: 'Meta-address update failed' }, { status: 500, headers: NO_STORE });
  }
}
