// ERC-20 token configuration per chain
import { ethers } from 'ethers';

export interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

// Ethereum Sepolia testnet tokens (well-known faucet/deployed addresses)
const ETHEREUM_SEPOLIA_TOKENS: TokenConfig[] = [
  {
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
  },
  {
    address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    symbol: 'USDT',
    decimals: 6,
    name: 'Tether USD',
  },
  {
    address: '0x68194a729C2450ad26072b3D33ADaCbcef39D574',
    symbol: 'DAI',
    decimals: 18,
    name: 'Dai Stablecoin',
  },
  {
    address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    symbol: 'WETH',
    decimals: 18,
    name: 'Wrapped Ether',
  },
];

// Thanos Sepolia — uses wrapped TON + common test tokens
const THANOS_SEPOLIA_TOKENS: TokenConfig[] = [
  {
    address: '0x7c6b91D9Be155A6Db01f749217d76fF02A7227F2',
    symbol: 'WTON',
    decimals: 18,
    name: 'Wrapped TON',
  },
  {
    address: '0x3c5B140E5e8265c525E6F81DCf68bF51520d9921',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
  },
  {
    address: '0x267B5B8EB2B48B0417b8b7BfC906AaD5a0CBdeFF',
    symbol: 'USDT',
    decimals: 6,
    name: 'Tether USD',
  },
  {
    address: '0xD46aF4e5003aF1dDc6FcCb8D02A8f64768F7f5c8',
    symbol: 'DAI',
    decimals: 18,
    name: 'Dai Stablecoin',
  },
];

// Arbitrum Sepolia testnet tokens
const ARBITRUM_SEPOLIA_TOKENS: TokenConfig[] = [
  {
    address: '0xf3C3351D6bd0098EEb33ca8f830FAf2a141Ea2e1',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
  },
  {
    address: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
    symbol: 'WETH',
    decimals: 18,
    name: 'Wrapped Ether',
  },
];

// OP Sepolia testnet tokens
const OP_SEPOLIA_TOKENS: TokenConfig[] = [
  {
    address: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
  },
  {
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    decimals: 18,
    name: 'Wrapped Ether',
  },
];

// Base Sepolia testnet tokens
const BASE_SEPOLIA_TOKENS: TokenConfig[] = [
  {
    address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
  },
  {
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    decimals: 18,
    name: 'Wrapped Ether',
  },
];

// Flow EVM Testnet tokens
const FLOW_EVM_TESTNET_TOKENS: TokenConfig[] = [
  {
    address: '0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e',
    symbol: 'WFLOW',
    decimals: 18,
    name: 'Wrapped FLOW',
  },
  {
    address: '0xd431955D55a99EF69BEb96BA34718d0f9fBc91b1',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
  },
];

const TOKEN_REGISTRY: Record<number, TokenConfig[]> = {
  [11155111]: ETHEREUM_SEPOLIA_TOKENS,
  [111551119090]: THANOS_SEPOLIA_TOKENS,
  [421614]: ARBITRUM_SEPOLIA_TOKENS,
  [11155420]: OP_SEPOLIA_TOKENS,
  [84532]: BASE_SEPOLIA_TOKENS,
  [545]: FLOW_EVM_TESTNET_TOKENS,
};

export function getTokensForChain(chainId: number): TokenConfig[] {
  return TOKEN_REGISTRY[chainId] ?? [];
}

export function getTokenByAddress(chainId: number, tokenAddress: string): TokenConfig | undefined {
  return getTokensForChain(chainId).find(
    t => t.address.toLowerCase() === tokenAddress.toLowerCase()
  );
}

export function getTokenBySymbol(chainId: number, symbol: string): TokenConfig | undefined {
  return getTokensForChain(chainId).find(
    t => t.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

/** Special value representing native currency in token selectors */
export const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// C3: On-chain decimal validation utility
const ERC20_DECIMALS_ABI = ['function decimals() view returns (uint8)'];

/**
 * Validate that a token's on-chain decimals match the expected value from our registry.
 * Returns true if decimals match or if verification is not possible (e.g. network error).
 */
export async function validateTokenDecimals(
  provider: ethers.providers.Provider,
  tokenAddress: string,
  expectedDecimals: number
): Promise<boolean> {
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_DECIMALS_ABI, provider);
    const onChainDecimals = await contract.decimals();
    const match = Number(onChainDecimals) === expectedDecimals;
    if (!match) {
      console.warn(
        `[tokens] Decimal mismatch for ${tokenAddress}: expected ${expectedDecimals}, got ${Number(onChainDecimals)}`
      );
    }
    return match;
  } catch {
    console.warn(`[tokens] Could not verify decimals for ${tokenAddress}`);
    return true; // Assume correct if can't verify
  }
}

/**
 * Check if a token address is in the known registry for a given chain.
 */
export function isKnownToken(chainId: number, tokenAddress: string): boolean {
  return getTokensForChain(chainId).some(
    t => t.address.toLowerCase() === tokenAddress.toLowerCase()
  );
}
