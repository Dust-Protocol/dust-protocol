// Stealth name registry (.dust names)

import { ethers } from 'ethers';

export const NAME_SUFFIX = '.dust';

const NAME_REGISTRY_ABI = [
  'function registerName(string calldata name, bytes calldata stealthMetaAddress) external',
  'function resolveName(string calldata name) external view returns (bytes)',
  'function updateMetaAddress(string calldata name, bytes calldata newMetaAddress) external',
  'function transferName(string calldata name, address newOwner) external',
  'function isNameAvailable(string calldata name) external view returns (bool)',
  'function getOwner(string calldata name) external view returns (address)',
  'function getNamesOwnedBy(address owner) external view returns (string[] memory)',
];

let registryAddress = '';

export function setNameRegistryAddress(address: string): void {
  registryAddress = address;
}

// Intentionally chain-agnostic: all name writes go to the canonical chain (Eth Sepolia).
// L2 chains resolve names via cross-chain NameVerifier contracts.
export function getNameRegistryAddress(): string {
  // In Next.js, NEXT_PUBLIC_* vars are inlined at build time
  const envAddr = process.env.NEXT_PUBLIC_STEALTH_NAME_REGISTRY_ADDRESS;
  if (envAddr) return envAddr;

  // Fallback to window.__ENV for runtime injection
  if (typeof window !== 'undefined') {
    const windowEnv = (window as unknown as { __ENV?: Record<string, string> }).__ENV
      ?.NEXT_PUBLIC_STEALTH_NAME_REGISTRY_ADDRESS;
    if (windowEnv) return windowEnv;
  }

  // Hardcoded fallback (Ethereum Sepolia canonical, deployed 2026-02-20)
  return registryAddress || '0x857e17A85891Ef1C595e51Eb7Cd56c607dB21313';
}

export function isNameRegistryConfigured(): boolean {
  const addr = getNameRegistryAddress();
  return !!addr;
}

export function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

export function stripNameSuffix(name: string): string {
  const n = normalizeName(name);
  return n.endsWith(NAME_SUFFIX) ? n.slice(0, -NAME_SUFFIX.length) : n;
}

export function formatNameWithSuffix(name: string): string {
  return stripNameSuffix(name) + NAME_SUFFIX;
}

export function isValidName(name: string): boolean {
  const stripped = stripNameSuffix(name);
  return stripped.length > 0 && stripped.length <= 32 && /^[a-zA-Z0-9_-]+$/.test(stripped);
}

export function isStealthName(input: string): boolean {
  const n = normalizeName(input);
  return n.endsWith(NAME_SUFFIX) || isValidName(n);
}

function toBytes(metaAddress: string): string {
  if (metaAddress.startsWith('st:')) {
    const match = metaAddress.match(/st:[a-z]+:0x([0-9a-fA-F]+)/);
    if (!match) throw new Error('Invalid stealth meta-address URI');
    return '0x' + match[1];
  }
  return metaAddress.startsWith('0x') ? metaAddress : '0x' + metaAddress;
}

import { getChainConfig, DEFAULT_CHAIN_ID, getSupportedChains, getCanonicalNamingChain } from '@/config/chains';

import { getChainProvider } from '@/lib/providers';

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

function getReadOnlyProvider(chainId?: number): ethers.providers.BaseProvider {
  return getChainProvider(chainId ?? DEFAULT_CHAIN_ID);
}

function getNameRegistryForChain(chainId?: number): string {
  const config = getChainConfig(chainId ?? DEFAULT_CHAIN_ID);
  return config.contracts.nameRegistry;
}

// Routes naming operations to canonical chain when active chain has no nameRegistry (L2s)
function getEffectiveNamingChainId(chainId?: number): number {
  const id = chainId ?? DEFAULT_CHAIN_ID;
  const config = getChainConfig(id);
  if (config.contracts.nameRegistry) return id;
  return getCanonicalNamingChain().id;
}

function getRegistry(signerOrProvider: ethers.Signer | ethers.providers.Provider) {
  const addr = getNameRegistryAddress();
  if (!addr) throw new Error('Name registry not configured');
  return new ethers.Contract(addr, NAME_REGISTRY_ABI, signerOrProvider);
}

// ─── Merkle Proof Resolution ──────────────────────────────────────────────────

const NAME_VERIFIER_ABI = [
  'function isKnownRoot(bytes32 root) view returns (bool)',
];

interface TreeCacheEntry {
  root: string;
  entries: Array<{
    name: string;
    nameHash: string;
    metaAddress: string;
    leafIndex: number;
    version: number;
  }>;
  fetchedAt: number;
}

const TREE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let treeCache: TreeCacheEntry | null = null;

async function fetchNameTree(): Promise<TreeCacheEntry | null> {
  // Return cached tree if still valid
  if (treeCache && Date.now() - treeCache.fetchedAt < TREE_CACHE_TTL_MS) {
    return treeCache;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch('/api/name-tree', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const data = await res.json();
    treeCache = {
      root: data.root,
      entries: data.entries ?? [],
      fetchedAt: Date.now(),
    };
    return treeCache;
  } catch (e) {
    console.error('[names] Failed to fetch name tree:', e);
    return null;
  }
}

/**
 * Resolve a .dust name via the Merkle proof tree (privacy mode).
 * Fetches the full tree from /api/name-tree, finds the name locally,
 * and verifies the root is known on the destination chain's NameVerifier.
 */
export async function resolveViaMerkleProof(name: string, chainId?: number): Promise<string | null> {
  const stripped = stripNameSuffix(name);

  try {
    const tree = await fetchNameTree();
    if (!tree || !tree.entries.length) return null;

    // Find the name entry in the tree
    const entry = tree.entries.find(e => e.name.toLowerCase() === stripped.toLowerCase());
    if (!entry) return null;

    // Determine which chain to verify on. If the active chain has a nameVerifier, use it.
    // Otherwise try the canonical chain's nameRegistryMerkle for isKnownRoot.
    const activeChainId = chainId ?? DEFAULT_CHAIN_ID;
    const activeConfig = getChainConfig(activeChainId);

    let verifierAddress: string | null = null;
    let verifyChainId: number = activeChainId;

    if (activeConfig.contracts.nameVerifier) {
      // Destination chain — use NameVerifier
      verifierAddress = activeConfig.contracts.nameVerifier;
      verifyChainId = activeChainId;
    } else if (activeConfig.canonicalForNaming && activeConfig.contracts.nameRegistryMerkle) {
      // We're on the canonical chain — verify against NameRegistryMerkle (same isKnownRoot interface)
      verifierAddress = activeConfig.contracts.nameRegistryMerkle;
      verifyChainId = activeChainId;
    } else {
      // Try to find any chain with a nameVerifier
      const destChain = getSupportedChains().find(c => c.contracts.nameVerifier);
      if (destChain) {
        verifierAddress = destChain.contracts.nameVerifier;
        verifyChainId = destChain.id;
      }
    }

    // If verifier address is the zero address (placeholder), skip on-chain check
    // but still return the entry since we trust the server-side tree
    const isPlaceholder = verifierAddress === '0x0000000000000000000000000000000000000000';

    if (isPlaceholder) {
      console.warn('[names] On-chain verification skipped — contracts not deployed. Running in trusted-server mode.');
    }

    if (verifierAddress && !isPlaceholder) {
      const provider = getReadOnlyProvider(verifyChainId);
      const verifier = new ethers.Contract(verifierAddress, NAME_VERIFIER_ABI, provider);
      const isKnown: boolean = await withTimeout(verifier.isKnownRoot(tree.root), 8_000, 'isKnownRoot');
      if (!isKnown) {
        console.warn('[names] Merkle root not recognized on-chain, falling back');
        return null;
      }
    }

    // Root is known (or contracts not yet deployed) — return the metaAddress
    return entry.metaAddress;
  } catch (e) {
    console.error('[names] resolveViaMerkleProof error:', e);
    return null;
  }
}

export async function registerStealthName(signer: ethers.Signer, name: string, metaAddress: string): Promise<string> {
  const normalized = stripNameSuffix(name);
  if (!isValidName(normalized)) throw new Error('Invalid name');

  const registry = getRegistry(signer);
  const tx = await registry.registerName(normalized, toBytes(metaAddress));
  return (await tx.wait()).transactionHash;
}

export async function resolveStealthName(_provider: ethers.providers.Provider | null, name: string, chainId?: number): Promise<string | null> {
  const stripped = stripNameSuffix(name);

  // 15s overall timeout prevents infinite spinner on broken RPCs
  return withTimeout((async () => {
    // 1. Try privacy tree cache (Merkle proof) first
    try {
      const merkleResult = await resolveViaMerkleProof(stripped, chainId);
      if (merkleResult) return merkleResult;
    } catch (e) {
      console.warn('[names] Merkle resolution failed, trying legacy:', e);
    }

    // 2. Legacy on-chain nameRegistry fallback — try active chain first
    if (chainId) {
      const result = await resolveOnChain(chainId, stripped);
      if (result) return result;
    }

    // Fall back to canonical chain
    const result = await resolveOnChain(undefined, stripped);
    return result;
  })(), 15_000, 'resolveStealthName');
}

async function resolveOnChain(chainId: number | undefined, stripped: string): Promise<string | null> {
  try {
    const effectiveChainId = getEffectiveNamingChainId(chainId);
    const addr = getNameRegistryForChain(effectiveChainId);
    if (!addr) return null;
    const rpcProvider = getReadOnlyProvider(effectiveChainId);
    const registry = new ethers.Contract(addr, NAME_REGISTRY_ABI, rpcProvider);
    const result: string = await withTimeout(registry.resolveName(stripped), 8_000, 'resolveOnChain');
    return result && result !== '0x' && result.length > 4 ? result : null;
  } catch {
    return null;
  }
}

export async function isNameAvailable(_provider: ethers.providers.Provider | null, name: string, chainId?: number): Promise<boolean | null> {
  try {
    const effectiveChainId = getEffectiveNamingChainId(chainId);

    // Try Graph first if enabled
    if (process.env.NEXT_PUBLIC_USE_GRAPH !== 'false') {
      const { isGraphAvailable, checkNameAvailabilityGraph } = await import('@/lib/graph/client');
      if (isGraphAvailable(effectiveChainId)) {
        const graphResult = await checkNameAvailabilityGraph(stripNameSuffix(name), effectiveChainId);
        if (graphResult !== null) return graphResult;
      }
    }

    const addr = getNameRegistryForChain(effectiveChainId);
    if (!addr) return null;
    const rpcProvider = getReadOnlyProvider(effectiveChainId);
    const registry = new ethers.Contract(addr, NAME_REGISTRY_ABI, rpcProvider);
    return await registry.isNameAvailable(stripNameSuffix(name));
  } catch (e) {
    console.error('[names] isNameAvailable error:', e);
    return null;
  }
}

export async function getNameOwner(_provider: ethers.providers.Provider | null, name: string, chainId?: number): Promise<string | null> {
  try {
    const effectiveChainId = getEffectiveNamingChainId(chainId);
    const addr = getNameRegistryForChain(effectiveChainId);
    if (!addr) return null;
    const rpcProvider = getReadOnlyProvider(effectiveChainId);
    const registry = new ethers.Contract(addr, NAME_REGISTRY_ABI, rpcProvider);
    const owner = await registry.getOwner(stripNameSuffix(name));
    return owner === ethers.constants.AddressZero ? null : owner;
  } catch (e) {
    console.error('[names] getNameOwner error:', e);
    return null;
  }
}

export async function getNamesOwnedBy(_provider: ethers.providers.Provider | null, address: string, chainId?: number): Promise<string[]> {
  // Try the requested chain first
  if (chainId) {
    const names = await getNamesOnChain(chainId, address);
    if (names.length > 0) return names;
  }

  // Fall back to canonical chain
  return getNamesOnChain(undefined, address);
}

async function getNamesOnChain(chainId: number | undefined, address: string): Promise<string[]> {
  try {
    const effectiveChainId = getEffectiveNamingChainId(chainId);
    const addr = getNameRegistryForChain(effectiveChainId);
    if (!addr) return [];
    const rpcProvider = getReadOnlyProvider(effectiveChainId);
    const registry = new ethers.Contract(addr, NAME_REGISTRY_ABI, rpcProvider);
    return await registry.getNamesOwnedBy(address);
  } catch {
    return [];
  }
}

export async function updateNameMetaAddress(signer: ethers.Signer, name: string, newMetaAddress: string): Promise<string> {
  const registry = getRegistry(signer);
  const tx = await registry.updateMetaAddress(stripNameSuffix(name), toBytes(newMetaAddress));
  return (await tx.wait()).transactionHash;
}

export async function transferStealthName(signer: ethers.Signer, name: string, newOwner: string): Promise<string> {
  const registry = getRegistry(signer);
  const tx = await registry.transferName(stripNameSuffix(name), newOwner);
  return (await tx.wait()).transactionHash;
}

const DEPLOYER = '0x8d56E94a02F06320BDc68FAfE23DEc9Ad7463496';

/**
 * Discover which name maps to a given meta-address.
 * Checks names owned by the deployer/sponsor on ALL supported chains in parallel.
 */
export async function discoverNameByMetaAddress(
  _provider: ethers.providers.Provider | null,
  metaAddressHex: string,
  _chainId?: number,
): Promise<string | null> {
  // Normalize meta-address to raw hex for comparison
  const targetHex = metaAddressHex.startsWith('st:')
    ? '0x' + (metaAddressHex.match(/st:[a-z]+:0x([0-9a-fA-F]+)/)?.[1] || '')
    : metaAddressHex.startsWith('0x') ? metaAddressHex : '0x' + metaAddressHex;

  if (!targetHex || targetHex === '0x') return null;

  const chains = getSupportedChains().filter(c => c.contracts.nameRegistry);
  const canonical = getCanonicalNamingChain();
  if (!chains.find(c => c.id === canonical.id)) {
    chains.unshift(canonical);
  }

  // Query all chains in parallel — return first match
  const results = await Promise.allSettled(
    chains.map(chain => discoverNameOnChain(chain.id, chain.name, targetHex))
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) return result.value;
  }

  return null;
}

/**
 * Check a single chain's name registry for a deployer-owned name matching the target meta-address.
 */
async function discoverNameOnChain(chainId: number, chainName: string, targetHex: string): Promise<string | null> {
  const addr = getNameRegistryForChain(chainId);
  if (!addr) return null;

  try {
    const rpcProvider = getReadOnlyProvider(chainId);
    const registry = new ethers.Contract(addr, NAME_REGISTRY_ABI, rpcProvider);
    const deployerNames: string[] = await registry.getNamesOwnedBy(DEPLOYER);

    let bestMatch: string | null = null;
    for (const name of deployerNames) {
      try {
        const resolved: string = await registry.resolveName(name);
        if (resolved && resolved.toLowerCase() === targetHex.toLowerCase()) {
          if (!bestMatch || name.length < bestMatch.length) {
            bestMatch = name;
          }
        }
      } catch { continue; }
    }

    if (bestMatch && process.env.NODE_ENV === 'development') {
      console.log(`[names] Discovered name "${bestMatch}" on ${chainName} (${chainId})`);
    }
    return bestMatch;
  } catch (e) {
    console.warn(`[names] discoverNameByMetaAddress failed on ${chainName}:`, e);
    return null;
  }
}

const ERC6538_REGISTRY_ABI = [
  'event StealthMetaAddressSet(address indexed registrant, uint256 indexed schemeId, bytes stealthMetaAddress)',
];

/**
 * Discover name by checking the user's ERC-6538 registration history across ALL chains.
 * When a user re-derives keys, the NameRegistry still has the OLD meta-address.
 * This function scans all historical meta-addresses the user has registered
 * on ERC-6538 across all supported chains, then checks deployer names on all chains
 * for any matching old meta-address.
 * If found, also auto-updates the name's meta-address to the current one.
 *
 * @param erc6538Address - Legacy param, ignored. All chains' registries are queried.
 */
export async function discoverNameByWalletHistory(
  userAddress: string,
  currentMetaAddress: string,
  _erc6538Address?: string,
  _chainId?: number,
): Promise<string | null> {
  const chains = getSupportedChains();

  try {
    // Step 1: Collect historical meta-addresses from ERC-6538 events on ALL chains in parallel
    const historicalMetas = new Set<string>();

    const eventResults = await Promise.allSettled(
      chains.map(async (chain) => {
        const registryAddr = chain.contracts.registry;
        if (!registryAddr) return [];
        try {
          const rpcProvider = getReadOnlyProvider(chain.id);
          const erc6538 = new ethers.Contract(registryAddr, ERC6538_REGISTRY_ABI, rpcProvider);
          const filter = erc6538.filters.StealthMetaAddressSet(userAddress, 1);
          return await erc6538.queryFilter(filter, chain.deploymentBlock);
        } catch (e) {
          console.warn(`[names] ERC-6538 event scan failed on ${chain.name}:`, e);
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

    if (historicalMetas.size === 0) return null;

    // Step 2: Check deployer names on ALL chains' nameRegistries in parallel
    const namingChains = chains.filter(c => c.contracts.nameRegistry);
    const canonical = getCanonicalNamingChain();
    if (!namingChains.find(c => c.id === canonical.id)) {
      namingChains.unshift(canonical);
    }
    const nameResults = await Promise.allSettled(
      namingChains.map(async (chain) => {
        const addr = getNameRegistryForChain(chain.id);
        if (!addr) return null;
        try {
          const rpcProvider = getReadOnlyProvider(chain.id);
          const registry = new ethers.Contract(addr, NAME_REGISTRY_ABI, rpcProvider);
          const deployerNames: string[] = await registry.getNamesOwnedBy(DEPLOYER);

          let bestMatch: string | null = null;
          for (const name of deployerNames) {
            try {
              const resolved: string = await registry.resolveName(name);
              if (resolved && historicalMetas.has(resolved.toLowerCase())) {
                if (!bestMatch || name.length < bestMatch.length) {
                  bestMatch = name;
                }
              }
            } catch { continue; }
          }

          if (bestMatch) {
            if (process.env.NODE_ENV === 'development') console.log(`[names] Discovered name "${bestMatch}" via wallet history on ${chain.name} (${chain.id})`);
            return bestMatch;
          }
        } catch (e) {
          console.warn(`[names] Name registry scan failed on ${chain.name}:`, e);
        }
        return null;
      })
    );

    for (const result of nameResults) {
      if (result.status === 'fulfilled' && result.value) return result.value;
    }

    return null;
  } catch (e) {
    console.error('[names] discoverNameByWalletHistory error:', e);
    return null;
  }
}

