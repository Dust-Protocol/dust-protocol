import { describe, it, expect } from 'vitest'
import { getChainConfig, getSupportedChains, getVisibleChains, isChainSupported, type ChainContracts, type ChainIconFamily } from '../chains'

describe('Chain config: V1 fields removed', () => {
  it('ChainContracts type does not have V1 swap fields', () => {
    const config = getChainConfig(11155111)
    const contracts = config.contracts
    // These V1 fields should not exist on the type
    expect('dustSwapPoolETH' in contracts).toBe(false)
    expect('dustSwapPoolUSDC' in contracts).toBe(false)
    expect('dustSwapHook' in contracts).toBe(false)
    expect('dustSwapVerifier' in contracts).toBe(false)
    expect('dustSwapRouter' in contracts).toBe(false)
    expect('uniswapV4SwapRouter' in contracts).toBe(false)
  })

  it('ChainConfig does not have dustSwapDeploymentBlock', () => {
    const config = getChainConfig(11155111)
    expect('dustSwapDeploymentBlock' in config).toBe(false)
  })
})

describe('Chain config: V2 fields present', () => {
  it('Eth Sepolia has V2 swap adapter', () => {
    const config = getChainConfig(11155111)
    expect(config.contracts.dustSwapAdapterV2).toBe('0xb91Afd19FeB4000E228243f40B8d98ea07127400')
  })

  it('Eth Sepolia has vanilla pool key', () => {
    const config = getChainConfig(11155111)
    const key = config.contracts.dustSwapVanillaPoolKey
    expect(key).not.toBeNull()
    expect(key!.currency0).toBe('0x0000000000000000000000000000000000000000')
    expect(key!.currency1).toBe('0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238')
    expect(key!.fee).toBe(500)
    expect(key!.tickSpacing).toBe(10)
    expect(key!.hooks).toBe('0x0000000000000000000000000000000000000000')
  })

  it('Eth Sepolia has Uniswap V4 infra (PoolManager, StateView, Quoter)', () => {
    const config = getChainConfig(11155111)
    expect(config.contracts.uniswapV4PoolManager).toBeTruthy()
    expect(config.contracts.uniswapV4StateView).toBeTruthy()
    expect(config.contracts.uniswapV4Quoter).toBeTruthy()
  })

  it('Thanos Sepolia has no swap support', () => {
    const config = getChainConfig(111551119090)
    expect(config.contracts.dustSwapAdapterV2).toBeNull()
    expect(config.contracts.dustSwapVanillaPoolKey).toBeNull()
    expect(config.contracts.uniswapV4PoolManager).toBeNull()
  })
})

describe('Chain config: core functions work', () => {
  it('getChainConfig returns valid config for supported chains', () => {
    const eth = getChainConfig(11155111)
    expect(eth.name).toBe('Ethereum Sepolia')
    const thanos = getChainConfig(111551119090)
    expect(thanos.name).toBe('Thanos Sepolia')
  })

  it('getChainConfig throws for unsupported chain', () => {
    expect(() => getChainConfig(999999)).toThrow('Unsupported chain')
  })

  it('getSupportedChains returns all chains', () => {
    const chains = getSupportedChains()
    expect(chains).toHaveLength(6)
  })

  it('isChainSupported works correctly', () => {
    expect(isChainSupported(11155111)).toBe(true)
    expect(isChainSupported(111551119090)).toBe(true)
    expect(isChainSupported(421614)).toBe(true)
    expect(isChainSupported(11155420)).toBe(true)
    expect(isChainSupported(84532)).toBe(true)
    expect(isChainSupported(545)).toBe(true)
    expect(isChainSupported(8453)).toBe(false)
    expect(isChainSupported(1)).toBe(false)
  })

  it('getVisibleChains returns only Flow for hackathon', () => {
    // #given hackathon branch is Flow-only
    // #when fetching visible chains for UI
    // #then only Flow EVM Testnet (545) is returned
    const visible = getVisibleChains()
    expect(visible).toHaveLength(1)
    expect(visible[0].id).toBe(545)
    expect(visible[0].name).toBe('Flow EVM Testnet')
  })
})

// ─── HIGH-8: Chain config completeness (parameterized) ──────────────────────

const VALID_ICON_FAMILIES: ChainIconFamily[] = ['ethereum', 'arbitrum', 'optimism', 'base', 'thanos', 'flow']

// No undeployed chains — all 6 chains have contracts
const UNDEPLOYED_CHAIN_IDS = new Set<number>([])

describe('Chain config completeness: all supported chains', () => {
  const chains = getSupportedChains()

  describe.each(chains.map(c => [c.name, c.id]))('%s (%i)', (_name, chainId) => {
    const config = getChainConfig(chainId as number)
    const deployed = !UNDEPLOYED_CHAIN_IDS.has(chainId as number)

    it('has non-empty rpcUrl', () => {
      expect(config.rpcUrl).toBeTruthy()
      expect(typeof config.rpcUrl).toBe('string')
    })

    it('has at least 1 rpcUrl in rpcUrls array', () => {
      expect(config.rpcUrls.length).toBeGreaterThanOrEqual(1)
    })

    it('has a valid viemChain with matching id', () => {
      expect(config.viemChain).toBeDefined()
      expect(config.viemChain.id).toBe(config.id)
    })

    it.skipIf(!deployed)('has non-empty announcer address', () => {
      expect(config.contracts.announcer).toBeTruthy()
    })

    it.skipIf(!deployed)('has non-empty registry address', () => {
      expect(config.contracts.registry).toBeTruthy()
    })

    it.skipIf(!deployed)('has non-empty accountFactory address', () => {
      expect(config.contracts.accountFactory).toBeTruthy()
    })

    it.skipIf(!deployed)('has non-empty entryPoint address', () => {
      expect(config.contracts.entryPoint).toBeTruthy()
    })

    it.skipIf(!deployed)('has non-empty paymaster address', () => {
      expect(config.contracts.paymaster).toBeTruthy()
    })

    it.skipIf(!deployed)('has a DustPoolV2 address', () => {
      expect(config.contracts.dustPoolV2).toBeTruthy()
    })

    it.skipIf(!deployed)('has a DustPoolV2Verifier address', () => {
      expect(config.contracts.dustPoolV2Verifier).toBeTruthy()
    })

    it.skipIf(!deployed)('has dustPoolV2ComplianceVerifier set', () => {
      expect(config.contracts.dustPoolV2ComplianceVerifier).not.toBeNull()
      expect(config.contracts.dustPoolV2ComplianceVerifier).toBeTruthy()
    })

    it('has a valid iconFamily', () => {
      expect(VALID_ICON_FAMILIES).toContain(config.iconFamily)
    })
  })
})

describe('Chain config completeness: chain-specific assertions', () => {
  it('Arb Sepolia has dustSwapAdapterV2', () => {
    // #given Arbitrum Sepolia supports DustSwap V2
    // #when checking dustSwapAdapterV2
    // #then it is non-null
    const config = getChainConfig(421614)
    expect(config.contracts.dustSwapAdapterV2).not.toBeNull()
    expect(config.contracts.dustSwapAdapterV2).toBeTruthy()
  })

  it('Base Sepolia has dustSwapAdapterV2', () => {
    // #given Base Sepolia supports DustSwap V2
    // #when checking dustSwapAdapterV2
    // #then it is non-null
    const config = getChainConfig(84532)
    expect(config.contracts.dustSwapAdapterV2).not.toBeNull()
    expect(config.contracts.dustSwapAdapterV2).toBeTruthy()
  })

  it('OP Sepolia does NOT have dustSwapAdapterV2', () => {
    // #given OP Sepolia has no Uniswap V4 deployment
    // #when checking dustSwapAdapterV2
    // #then it is null
    const config = getChainConfig(11155420)
    expect(config.contracts.dustSwapAdapterV2).toBeNull()
  })

  it('Thanos Sepolia does NOT have dustSwapAdapterV2', () => {
    // #given Thanos Sepolia has no swap support
    // #when checking dustSwapAdapterV2
    // #then it is null
    const config = getChainConfig(111551119090)
    expect(config.contracts.dustSwapAdapterV2).toBeNull()
  })

  it('Eth Sepolia is canonicalForNaming', () => {
    // #given Eth Sepolia is the canonical naming chain
    // #when checking canonicalForNaming
    // #then it is true
    const config = getChainConfig(11155111)
    expect(config.canonicalForNaming).toBe(true)
  })

  it('L2 chains have isL2 = true', () => {
    // #given Arb, OP, and Base are L2 rollups
    // #when checking isL2
    // #then all are true
    const l2ChainIds = [421614, 11155420, 84532]
    for (const chainId of l2ChainIds) {
      const config = getChainConfig(chainId)
      expect(config.isL2).toBe(true)
    }
  })

  it('Eth Sepolia has isL2 = false', () => {
    const config = getChainConfig(11155111)
    expect(config.isL2).toBe(false)
  })

  it('Thanos Sepolia has isL2 = false', () => {
    const config = getChainConfig(111551119090)
    expect(config.isL2).toBe(false)
  })
})
