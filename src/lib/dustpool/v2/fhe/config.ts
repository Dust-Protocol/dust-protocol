import { type Address } from 'viem'

import { getFHEChainConfig } from '@/config/fhe-chains'

import { setFHEConfig } from './fhe-compliance'

const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000'

// fhEVM chain where the oracle + pool stats + ConfidentialDustPool live (Sepolia).
const FHE_CHAIN_ID = Number(process.env.NEXT_PUBLIC_FHE_CHAIN_ID || '0')

function resolveAddress(
  envVar: string | undefined,
  fallback: Address,
): Address {
  if (envVar && envVar.startsWith('0x') && envVar.length === 42) {
    return envVar as Address
  }
  return fallback
}

function initFHEConfig(): void {
  if (!FHE_CHAIN_ID) return

  const chainConfig = getFHEChainConfig(FHE_CHAIN_ID)

  const oracleAddress = resolveAddress(
    process.env.NEXT_PUBLIC_FHE_ORACLE_ADDRESS,
    chainConfig?.oracleAddress ?? ZERO_ADDRESS,
  )
  const bridgeAddress = resolveAddress(
    process.env.NEXT_PUBLIC_FHE_BRIDGE_ADDRESS,
    chainConfig?.bridgeAddress ?? ZERO_ADDRESS,
  )
  const poolStatsAddress = resolveAddress(
    process.env.NEXT_PUBLIC_FHE_POOL_STATS_ADDRESS,
    chainConfig?.poolStatsAddress ?? ZERO_ADDRESS,
  )
  const confidentialDustPoolAddress = resolveAddress(
    process.env.NEXT_PUBLIC_CONFIDENTIAL_DUST_POOL_ADDRESS,
    chainConfig?.confidentialDustPoolAddress ?? ZERO_ADDRESS,
  )

  setFHEConfig({
    chainId: FHE_CHAIN_ID,
    rpcUrl: chainConfig?.rpcUrl ?? '',
    oracleAddress,
    bridgeAddress,
    poolStatsAddress,
    confidentialDustPoolAddress,
    // FHE is enabled if we have the oracle (core requirement)
    enabled: oracleAddress !== ZERO_ADDRESS,
  })
}

initFHEConfig()
