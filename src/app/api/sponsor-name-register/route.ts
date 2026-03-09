import { ethers } from 'ethers';
import { NextResponse } from 'next/server';
import { getChainConfig, getCanonicalNamingChain, getSupportedChains } from '@/config/chains';
import { getServerSponsor, parseChainId, waitForTx } from '@/lib/server-provider';
import { onNameRegistered } from '@/lib/naming/rootSync';
import { getNameMerkleTree } from '@/lib/naming/merkleTree';
import { checkOrigin } from '@/lib/api-auth';

export const maxDuration = 60;

const SPONSOR_KEY = process.env.RELAYER_PRIVATE_KEY;

const NAME_REGISTRY_ABI = [
  'function registerName(string calldata name, bytes calldata stealthMetaAddress) external',
  'function isNameAvailable(string calldata name) external view returns (bool)',
  'function resolveName(string calldata name) external view returns (bytes)',
  'function transferName(string calldata name, address newOwner) external',
];

const NAME_REGISTRY_MERKLE_ABI = [
  'function registerName(string calldata name, bytes calldata stealthMetaAddress) external',
  'function isNameAvailable(string calldata name) external view returns (bool)',
];

// Rate limiting: 1 registration per name per 30s + 3 per registrant per 5min
const registerCooldowns = new Map<string, number>();
const REGISTER_COOLDOWN_MS = 30_000;
const MAX_REGISTER_ENTRIES = 500;

const registrantTimestamps = new Map<string, number[]>();
const REGISTRANT_WINDOW_MS = 5 * 60 * 1000;
const REGISTRANT_MAX_NAMES = 3;

function checkRegisterCooldown(key: string): boolean {
  const now = Date.now();
  if (registerCooldowns.size > MAX_REGISTER_ENTRIES) {
    for (const [k, t] of registerCooldowns) {
      if (now - t > REGISTER_COOLDOWN_MS) registerCooldowns.delete(k);
    }
  }
  const last = registerCooldowns.get(key);
  if (last && now - last < REGISTER_COOLDOWN_MS) return false;
  registerCooldowns.set(key, now);
  return true;
}

/** Register a name on a single chain. Returns txHash or null on failure.
 *  If registrant is provided, auto-transfers ownership from deployer to the user. */
async function registerOnChain(
  chainId: number,
  stripped: string,
  metaBytes: string,
  registrant?: string,
): Promise<string | null> {
  try {
    const config = getChainConfig(chainId);
    if (!config.contracts.nameRegistry) return null;
    const sponsor = getServerSponsor(chainId);
    const registry = new ethers.Contract(config.contracts.nameRegistry, NAME_REGISTRY_ABI, sponsor);
    const available = await registry.isNameAvailable(stripped);
    if (!available) return null; // already registered on this chain
    // Manual gas limit prevents UNPREDICTABLE_GAS_LIMIT when RPC estimation fails transiently
    const tx = await registry.registerName(stripped, metaBytes, { gasLimit: 300_000 });
    const receipt = await waitForTx(tx);
    console.log(`[SponsorNameRegister] Registered "${stripped}" on ${config.name}, tx: ${receipt.transactionHash}`);

    // Auto-transfer ownership to the user so getNamesOwnedBy(userAddress) works
    // on future logins (even without ERC-6538 registration)
    if (registrant && /^0x[0-9a-fA-F]{40}$/.test(registrant)) {
      try {
        const transferTx = await registry.transferName(stripped, registrant);
        await waitForTx(transferTx);
        console.log(`[SponsorNameRegister] Auto-transferred "${stripped}" to ${registrant}`);
      } catch (e) {
        // Non-fatal: name is registered but still deployer-owned
        console.warn(`[SponsorNameRegister] Auto-transfer failed for "${stripped}":`, e);
      }
    }

    return receipt.transactionHash;
  } catch (e) {
    console.warn(`[SponsorNameRegister] Failed to register "${stripped}" on chain ${chainId}:`, e);
    return null;
  }
}

/** Register a name on the canonical NameRegistryMerkle (Ethereum Sepolia). */
async function registerOnCanonicalMerkle(
  stripped: string,
  metaBytes: string,
): Promise<string | null> {
  try {
    const canonicalChain = getCanonicalNamingChain();
    const merkleAddr = canonicalChain.contracts.nameRegistryMerkle;
    if (!merkleAddr || merkleAddr === '0x0000000000000000000000000000000000000000') {
      console.warn('[SponsorNameRegister] Canonical NameRegistryMerkle not deployed yet, skipping');
      return null;
    }

    const sponsor = getServerSponsor(canonicalChain.id);
    const merkleRegistry = new ethers.Contract(merkleAddr, NAME_REGISTRY_MERKLE_ABI, sponsor);
    const available = await merkleRegistry.isNameAvailable(stripped);
    if (!available) {
      console.log(`[SponsorNameRegister] Name "${stripped}" already on canonical Merkle registry`);
      return null;
    }

    const tx = await merkleRegistry.registerName(stripped, metaBytes);
    const receipt = await waitForTx(tx);
    console.log(`[SponsorNameRegister] Registered "${stripped}" on canonical Merkle registry, tx: ${receipt.transactionHash}`);
    return receipt.transactionHash;
  } catch (e) {
    console.warn('[SponsorNameRegister] Failed to register on canonical Merkle registry:', e);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const originError = checkOrigin(req);
    if (originError) return originError;

    if (!SPONSOR_KEY) {
      return NextResponse.json({ error: 'Sponsor not configured' }, { status: 500 });
    }

    const body = await req.json();
    const primaryChainId = parseChainId(body);

    const { name, metaAddress, registrant } = body;

    if (!name || !metaAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate name
    const stripped = name.toLowerCase().replace(/\.dust$/, '').trim();
    if (!stripped || stripped.length > 32 || !/^[a-zA-Z0-9_-]+$/.test(stripped)) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    // Rate limit by name
    if (!checkRegisterCooldown(stripped)) {
      return NextResponse.json({ error: 'Please wait before registering again' }, { status: 429 });
    }

    // Per-registrant rate limit: max 3 names per 5 minutes
    if (registrant && /^0x[0-9a-fA-F]{40}$/.test(registrant)) {
      const now = Date.now();
      const key = registrant.toLowerCase();
      const timestamps = (registrantTimestamps.get(key) ?? []).filter(t => now - t < REGISTRANT_WINDOW_MS);
      if (timestamps.length >= REGISTRANT_MAX_NAMES) {
        return NextResponse.json({ error: 'Too many registrations — try again later' }, { status: 429 });
      }
      timestamps.push(now);
      registrantTimestamps.set(key, timestamps);
    }

    const metaBytes = metaAddress.startsWith('st:')
      ? '0x' + (metaAddress.match(/st:[a-z]+:0x([0-9a-fA-F]+)/)?.[1] || '')
      : metaAddress.startsWith('0x') ? metaAddress : '0x' + metaAddress;

    if (!metaBytes || metaBytes === '0x') {
      return NextResponse.json({ error: 'Invalid meta-address' }, { status: 400 });
    }

    // Route to canonical chain if primary has no nameRegistry (L2s)
    const primaryConfig = getChainConfig(primaryChainId);
    const effectivePrimaryChainId = primaryConfig.contracts.nameRegistry
      ? primaryChainId
      : getCanonicalNamingChain().id;

    // Register on the effective primary chain
    const primaryTxHash = await registerOnChain(effectivePrimaryChainId, stripped, metaBytes, registrant);
    if (!primaryTxHash) {
      const config = getChainConfig(effectivePrimaryChainId);
      if (!config.contracts.nameRegistry) {
        return NextResponse.json({ error: 'Name registration failed' }, { status: 500 });
      }
      const sponsor = getServerSponsor(effectivePrimaryChainId);
      const registry = new ethers.Contract(config.contracts.nameRegistry, NAME_REGISTRY_ABI, sponsor);
      const available = await registry.isNameAvailable(stripped);
      if (!available) {
        try {
          const storedMeta: string = await registry.resolveName(stripped);
          const normalizeHex = (h: string) => h.toLowerCase().replace(/^0x/, '');
          if (normalizeHex(storedMeta) === normalizeHex(metaBytes)) {
            console.log(`[SponsorNameRegister] Name "${stripped}" already registered to same meta-address — idempotent success`);
            return NextResponse.json({ success: true, txHash: null, name: stripped, alreadyRegistered: true }, { headers: { 'Cache-Control': 'no-store' } });
          }
        } catch (e) {
          console.warn('[SponsorNameRegister] Could not resolve existing name meta-address:', e);
        }
        return NextResponse.json({ error: 'Name already taken' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Name registration failed' }, { status: 500 });
    }

    // Insert into server Merkle tree immediately (optimistic — primary chain succeeded)
    try {
      const tree = getNameMerkleTree();
      tree.insert(stripped, metaBytes);
      onNameRegistered();
    } catch (e) {
      console.warn('[SponsorNameRegister] Failed to insert into server Merkle tree:', e);
    }

    // Fire-and-forget: also register on canonical NameRegistryMerkle
    registerOnCanonicalMerkle(stripped, metaBytes).then((merkleTxHash) => {
      if (merkleTxHash) {
        onNameRegistered(); // Trigger root sync only if on-chain succeeded
      }
    }).catch((e) => {
      console.warn('[SponsorNameRegister] Canonical Merkle registration error:', e);
    });

    // Mirror to all other supported chains (fire and forget — don't block the response)
    const otherChains = getSupportedChains().filter(
      c => c.id !== effectivePrimaryChainId && c.contracts.nameRegistry
    );
    if (otherChains.length > 0) {
      Promise.allSettled(
        otherChains.map(c => registerOnChain(c.id, stripped, metaBytes, registrant))
      ).then(results => {
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            console.warn(`[SponsorNameRegister] Mirror to ${otherChains[i].name} failed:`, r.reason);
          }
        });
      });
    }

    return NextResponse.json({
      success: true,
      txHash: primaryTxHash,
      name: stripped,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[SponsorNameRegister] Error:', e);
    return NextResponse.json({ error: 'Name registration failed' }, { status: 500 });
  }
}
