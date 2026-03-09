// Shared provider and signing utilities — single source of truth
import { ethers } from 'ethers';
import { getChainConfig, DEFAULT_CHAIN_ID } from '@/config/chains';

/** Get ethers Web3Provider from injected wallet (MetaMask etc.) */
export function getProvider(): ethers.providers.Web3Provider | null {
  if (typeof window === 'undefined' || !window.ethereum) return null;
  return new ethers.providers.Web3Provider(window.ethereum as ethers.providers.ExternalProvider);
}

/** Get ethers Web3Provider with accounts unlocked */
export async function getProviderWithAccounts(): Promise<ethers.providers.Web3Provider | null> {
  const provider = getProvider();
  if (!provider) return null;
  await provider.send('eth_requestAccounts', []);
  return provider;
}

// Provider caches — avoid creating a new provider on every call
// TTL prevents stale/broken providers from persisting indefinitely
const PROVIDER_TTL_MS = 5 * 60 * 1000
const providerCache = new Map<number, { provider: ethers.providers.BaseProvider; created: number }>();
const batchProviderCache = new Map<number, ethers.providers.JsonRpcBatchProvider>();
const batchUrlIdx = new Map<number, number>();

/**
 * Get read-only provider with automatic failover across all configured RPCs.
 * Uses FallbackProvider (quorum=1) for chains with multiple RPC URLs.
 * Priority-ordered: paid/archive RPCs first, public last.
 * Handles 429s with automatic backoff, stalls with 2s timeout before trying next.
 */
export function getChainProvider(chainId?: number): ethers.providers.BaseProvider {
  const id = chainId ?? DEFAULT_CHAIN_ID;
  const cached = providerCache.get(id);
  if (cached && Date.now() - cached.created < PROVIDER_TTL_MS) {
    return cached.provider;
  }
  const config = getChainConfig(id);
  const urls = config.rpcUrls;
  // Specify network explicitly so ethers skips the detectNetwork() RPC call.
  // Prevents NETWORK_ERROR when public RPCs are slow or rate-limited.
  const network = { chainId: id, name: config.name };
  let provider: ethers.providers.BaseProvider;
  if (urls.length <= 1) {
    provider = new ethers.providers.JsonRpcProvider(urls[0], network);
  } else {
    provider = new ethers.providers.FallbackProvider(
      urls.map((url, i) => ({
        provider: new ethers.providers.JsonRpcProvider(url, network),
        priority: i + 1,
        weight: 1,
        stallTimeout: 2000,
      })),
      1
    );
  }
  providerCache.set(id, { provider, created: Date.now() });
  return provider;
}

/** Get batch provider for parallel balance queries (cached per chain) */
export function getChainBatchProvider(chainId?: number): ethers.providers.JsonRpcBatchProvider {
  const id = chainId ?? DEFAULT_CHAIN_ID;
  let provider = batchProviderCache.get(id);
  if (!provider) {
    const config = getChainConfig(id);
    const urlIdx = batchUrlIdx.get(id) ?? 0;
    const network = { chainId: id, name: config.name };
    provider = new ethers.providers.JsonRpcBatchProvider(config.rpcUrls[urlIdx] ?? config.rpcUrl, network);
    batchProviderCache.set(id, provider);
  }
  return provider;
}

/** Rotate batch provider to next RPC URL on failure. Returns the new provider. */
export function rotateBatchProvider(chainId?: number): ethers.providers.JsonRpcBatchProvider {
  const id = chainId ?? DEFAULT_CHAIN_ID;
  const config = getChainConfig(id);
  const currentIdx = batchUrlIdx.get(id) ?? 0;
  const nextIdx = (currentIdx + 1) % config.rpcUrls.length;
  batchUrlIdx.set(id, nextIdx);
  batchProviderCache.delete(id);
  return getChainBatchProvider(id);
}


/** Sign a message using wagmi wallet client (preferred) or ethers fallback */
export async function signMessage(
  message: string,
  walletClient?: { signMessage: (args: { message: string }) => Promise<string> } | null,
): Promise<string> {
  if (walletClient) {
    return walletClient.signMessage({ message });
  }
  const provider = await getProviderWithAccounts();
  if (!provider) throw new Error('No wallet provider found. Is MetaMask installed?');
  return provider.getSigner().signMessage(message);
}
