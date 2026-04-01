import { type Address } from 'viem'

import { type FHEChainConfig } from '@/lib/dustpool/v2/fhe/types'

const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000'

// fhEVM chain configs — keyed by the chain ID where FHE precompiles are available.
// All addresses are populated from env vars at build time.
// ConfidentialDustPool, FHEComplianceOracle, FHEPoolStats all live on the FHE chain (Sepolia).
// The bridge address is a legacy field for the Flow cross-chain cache (optional).

function buildFHEConfig(
  chainId: number,
  rpcUrlEnvKey: string,
  defaultRpcUrl: string,
): FHEChainConfig {
  const rpcUrl = process.env[rpcUrlEnvKey] || defaultRpcUrl
  const oracleAddress = (process.env.NEXT_PUBLIC_FHE_ORACLE_ADDRESS as Address) || ZERO_ADDRESS
  const bridgeAddress = (process.env.NEXT_PUBLIC_FHE_BRIDGE_ADDRESS as Address) || ZERO_ADDRESS
  const poolStatsAddress = (process.env.NEXT_PUBLIC_FHE_POOL_STATS_ADDRESS as Address) || ZERO_ADDRESS
  const confidentialDustPoolAddress = (process.env.NEXT_PUBLIC_CONFIDENTIAL_DUST_POOL_ADDRESS as Address) || ZERO_ADDRESS

  return {
    chainId,
    rpcUrl,
    oracleAddress,
    bridgeAddress,
    poolStatsAddress,
    confidentialDustPoolAddress,
    get enabled() {
      // FHE is enabled if we have the oracle address (core requirement)
      return oracleAddress !== ZERO_ADDRESS
    },
  }
}

// Build configs for known fhEVM-compatible chains.
// Users set NEXT_PUBLIC_FHE_CHAIN_ID to select the active one.
const FHE_CHAIN_CONFIGS: Record<number, FHEChainConfig> = {}

// Zama fhEVM on Ethereum Sepolia (chain 11155111)
const fheChainId = Number(process.env.NEXT_PUBLIC_FHE_CHAIN_ID || '0')
if (fheChainId > 0) {
  FHE_CHAIN_CONFIGS[fheChainId] = buildFHEConfig(
    fheChainId,
    'NEXT_PUBLIC_FHE_RPC_URL',
    process.env.NEXT_PUBLIC_FHE_RPC_URL || '',
  )
}

export { FHE_CHAIN_CONFIGS }

export function getFHEChainConfig(chainId: number): FHEChainConfig | null {
  return FHE_CHAIN_CONFIGS[chainId] ?? null
}

export function isFHEAvailable(chainId: number): boolean {
  const config = getFHEChainConfig(chainId)
  return config !== null && config.enabled
}
