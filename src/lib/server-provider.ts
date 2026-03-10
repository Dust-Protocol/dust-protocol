// Shared server-side ethers provider that bypasses Next.js fetch patching.
// Used by all API routes — takes rpcUrl and chainId from chain config.

import { ethers } from 'ethers';
import { getChainConfig, DEFAULT_CHAIN_ID } from '@/config/chains';

class ServerJsonRpcProvider extends ethers.providers.JsonRpcProvider {
  private rpcUrl: string;
  private knownNetwork: ethers.providers.Network;

  constructor(rpcUrl: string, network: { name: string; chainId: number }) {
    super(rpcUrl, network);
    this.rpcUrl = rpcUrl;
    this.knownNetwork = { name: network.name, chainId: network.chainId };
  }

  // FallbackProvider calls detectNetwork() on all children during construction
  // and reconciles results. Our send() returns raw hex for eth_chainId which
  // breaks reconciliation. Return the known network directly.
  async detectNetwork(): Promise<ethers.providers.Network> {
    return this.knownNetwork;
  }

  async send(method: string, params: unknown[]): Promise<unknown> {
    const id = this._nextId++;
    const body = JSON.stringify({ jsonrpc: '2.0', method, params, id });

    // Use native fetch with cache: 'no-store' to bypass Next.js fetch patching
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`RPC request failed: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    if (json.error) throw new Error(json.error.message || 'RPC Error');
    return json.result;
  }
}

// Server-side provider cache — avoids recreating providers on every API request
// TTL prevents stale/broken providers from persisting indefinitely
const SERVER_PROVIDER_TTL_MS = 5 * 60 * 1000;
const serverProviderCache = new Map<number, { provider: ethers.providers.BaseProvider; created: number }>();

/**
 * Server-side provider with automatic failover across configured RPCs.
 * Each child provider uses native fetch (cache: 'no-store') to bypass Next.js.
 */
export function getServerProvider(chainId?: number): ethers.providers.BaseProvider {
  const id = chainId ?? DEFAULT_CHAIN_ID;
  const cached = serverProviderCache.get(id);
  if (cached && Date.now() - cached.created < SERVER_PROVIDER_TTL_MS) {
    return cached.provider;
  }
  const config = getChainConfig(id);
  const urls = config.rpcUrls;
  const network = { name: config.name, chainId: config.id };
  let provider: ethers.providers.BaseProvider;
  if (urls.length <= 1) {
    provider = new ServerJsonRpcProvider(urls[0], network);
  } else {
    provider = new ethers.providers.FallbackProvider(
      urls.map((url, i) => ({
        provider: new ServerJsonRpcProvider(url, network),
        priority: i + 1,
        weight: 1,
        stallTimeout: 2000,
      })),
      1
    );
  }
  serverProviderCache.set(id, { provider, created: Date.now() });
  // Recreate sponsor wallet when provider refreshes so it uses the new provider
  sponsorCache.delete(id);
  return provider;
}

// Sponsor wallet cache — reusing the same Wallet instance per chain prevents
// concurrent requests from getting stale EVM nonces
const sponsorCache = new Map<number, ethers.Wallet>();

export function getServerSponsor(chainId?: number): ethers.Wallet {
  const key = process.env.RELAYER_PRIVATE_KEY;
  if (!key) throw new Error('Sponsor not configured');
  const id = chainId ?? DEFAULT_CHAIN_ID;
  let sponsor = sponsorCache.get(id);
  if (!sponsor) {
    sponsor = new ethers.Wallet(key, getServerProvider(id));
    sponsorCache.set(id, sponsor);
  }
  return sponsor;
}

// L2s have much lower gas prices (0.01-1 gwei) — a 100 gwei cap provides no protection there
const MAX_GAS_PRICE_BY_CHAIN: Record<number, ethers.BigNumber> = {
  11155111: ethers.utils.parseUnits('100', 'gwei'),
  111551119090: ethers.utils.parseUnits('100', 'gwei'),
  421614: ethers.utils.parseUnits('5', 'gwei'),
  11155420: ethers.utils.parseUnits('5', 'gwei'),
  84532: ethers.utils.parseUnits('5', 'gwei'),
  8453: ethers.utils.parseUnits('5', 'gwei'),
  // Flow EVM gas is 100 gwei base — cap at 500 gwei to handle spikes
  545: ethers.utils.parseUnits('500', 'gwei'),
};
// Default 10 gwei — conservative for unknown L2s where 100 gwei would waste ETH
const DEFAULT_MAX_GAS = ethers.utils.parseUnits('10', 'gwei');

export function getMaxGasPrice(chainId: number): ethers.BigNumber {
  return MAX_GAS_PRICE_BY_CHAIN[chainId] ?? DEFAULT_MAX_GAS;
}

export class GasPriceTooHighError extends Error {
  constructor(chainId: number, price: ethers.BigNumber) {
    super(`Gas price too high on chain ${chainId}: ${ethers.utils.formatUnits(price, 'gwei')} gwei`)
    this.name = 'GasPriceTooHighError'
  }
}

/**
 * Build gas overrides for a relayer transaction on the given chain.
 * Reads supportsEIP1559 from chain config to decide between type 2 (EIP-1559)
 * and type 0 (legacy). All current chains support EIP-1559.
 */
export async function getTxGasOverrides(
  chainId: number,
  gasLimit: number,
): Promise<Record<string, unknown>> {
  const config = getChainConfig(chainId)
  const sponsor = getServerSponsor(chainId)
  const feeData = await sponsor.provider.getFeeData()

  if (!config.supportsEIP1559) {
    const gasPrice = feeData.gasPrice || ethers.utils.parseUnits('100', 'gwei')
    if (gasPrice.gt(getMaxGasPrice(chainId))) {
      throw new GasPriceTooHighError(chainId, gasPrice)
    }
    return { gasLimit, type: 0, gasPrice }
  }

  const maxFeePerGas = feeData.maxFeePerGas || ethers.utils.parseUnits('5', 'gwei')
  if (maxFeePerGas.gt(getMaxGasPrice(chainId))) {
    throw new GasPriceTooHighError(chainId, maxFeePerGas)
  }
  return {
    gasLimit,
    type: 2,
    maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.utils.parseUnits('1.5', 'gwei'),
  }
}

// Block number cache — avoids redundant RPC calls on hot paths (2s TTL ~ one Base block)
const blockNumberCache = new Map<number, { block: number; timestamp: number }>()
const BLOCK_CACHE_TTL_MS = 2000

export async function getCachedBlockNumber(chainId: number): Promise<number> {
  const cached = blockNumberCache.get(chainId)
  if (cached && Date.now() - cached.timestamp < BLOCK_CACHE_TTL_MS) {
    return cached.block
  }
  const provider = getServerProvider(chainId)
  const block = await provider.getBlockNumber()
  blockNumberCache.set(chainId, { block, timestamp: Date.now() })
  return block
}

const TX_WAIT_TIMEOUT_MS = 120_000

/**
 * Waits for a transaction receipt with a timeout.
 * Prevents relayer from hanging indefinitely on dropped/stuck transactions.
 */
export async function waitForTx(
  tx: ethers.ContractTransaction,
  timeoutMs: number = TX_WAIT_TIMEOUT_MS,
): Promise<ethers.ContractReceipt> {
  const receipt = await Promise.race([
    tx.wait(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`tx.wait() timed out after ${timeoutMs}ms (tx: ${tx.hash})`)), timeoutMs),
    ),
  ])
  return receipt
}

// Per-chain tx mutex — prevents nonce collisions between ethers and viem sponsor wallets
// (both use the same private key; concurrent sendTransaction can fetch same nonce)
const txLocks = new Map<number, Promise<void>>();

/**
 * Acquire a per-chain lock before sending transactions.
 * Returns a release function that MUST be called in a finally block.
 */
export async function acquireTxLock(chainId: number): Promise<() => void> {
  const id = chainId ?? DEFAULT_CHAIN_ID;
  while (txLocks.has(id)) {
    await txLocks.get(id);
  }
  let release!: () => void;
  const lock = new Promise<void>((resolve) => { release = resolve; });
  txLocks.set(id, lock);
  return () => {
    txLocks.delete(id);
    release();
  };
}

export function parseChainId(body: Record<string, unknown>): number {
  const chainId = body.chainId;
  if (typeof chainId === 'number' && Number.isFinite(chainId)) return chainId;
  if (typeof chainId === 'string') {
    const parsed = parseInt(chainId, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return DEFAULT_CHAIN_ID;
}
