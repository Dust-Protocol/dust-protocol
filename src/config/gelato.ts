// Gelato Relay configuration
// Uses 1Balance for managed, multi-chain gas sponsorship

export const GELATO_API_KEY = process.env.GELATO_API_KEY || '';

// Chains where Gelato Relay is available for sponsoredCall
// Thanos Sepolia is NOT supported by Gelato — uses sponsor wallet fallback
const GELATO_SUPPORTED_CHAIN_IDS = new Set<number>([
  11155111,   // Ethereum Sepolia
  421614,     // Arbitrum Sepolia
  11155420,   // OP Sepolia
  84532,      // Base Sepolia
]);

export function isGelatoSupported(chainId: number): boolean {
  return GELATO_SUPPORTED_CHAIN_IDS.has(chainId);
}

export function isGelatoConfigured(): boolean {
  return GELATO_API_KEY.length > 0;
}
