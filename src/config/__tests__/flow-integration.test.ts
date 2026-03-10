import { describe, it, expect } from 'vitest'
import { getAddress } from 'viem'
import { getChainConfig, isChainSupported } from '../chains'
import { getTokensForChain, getTokenBySymbol } from '../tokens'
import { getDenominations, ETH_DENOMINATIONS } from '@/lib/dustpool/v2/denominations'
import { getChainProvider } from '@/lib/providers'
import { getServerProvider, getMaxGasPrice } from '@/lib/server-provider'

const FLOW_CHAIN_ID = 545

// ─── Chain config ─────────────────────────────────────────────────────────────

describe('Flow EVM Testnet: chain config', () => {
  const config = getChainConfig(FLOW_CHAIN_ID)

  it('is a supported chain', () => {
    // #given Flow EVM Testnet chain ID 545
    // #when checking support
    // #then it is recognized
    expect(isChainSupported(FLOW_CHAIN_ID)).toBe(true)
  })

  it('has correct chain ID', () => {
    // #given the Flow config
    // #when reading id
    // #then it matches 545
    expect(config.id).toBe(545)
  })

  it('has correct name', () => {
    expect(config.name).toBe('Flow EVM Testnet')
  })

  it('has correct RPC URL', () => {
    // #given Flow EVM Testnet
    // #when reading rpcUrl
    // #then it points to the Flow testnet EVM node
    expect(config.rpcUrl).toBe('https://testnet.evm.nodes.onflow.org')
  })

  it('has rpcUrls array with at least one entry', () => {
    expect(config.rpcUrls.length).toBeGreaterThanOrEqual(1)
    expect(config.rpcUrls[0]).toBe('https://testnet.evm.nodes.onflow.org')
  })

  it('has FLOW as native currency', () => {
    // #given Flow EVM Testnet
    // #when reading nativeCurrency
    // #then symbol is FLOW with 18 decimals
    expect(config.nativeCurrency.symbol).toBe('FLOW')
    expect(config.nativeCurrency.name).toBe('FLOW')
    expect(config.nativeCurrency.decimals).toBe(18)
  })

  it('has correct iconFamily', () => {
    // #given Flow is a distinct chain ecosystem
    // #when reading iconFamily
    // #then it uses the flow icon set
    expect(config.iconFamily).toBe('flow')
  })

  it('does not support EIP-7702', () => {
    // #given Flow EVM does not have EIP-7702 support
    // #when reading supportsEIP7702
    // #then it is false
    expect(config.supportsEIP7702).toBe(false)
  })

  it('is not canonical for naming', () => {
    // #given only Eth Sepolia is canonical for naming
    // #when reading canonicalForNaming
    // #then Flow is false
    expect(config.canonicalForNaming).toBe(false)
  })

  it('has no swap support', () => {
    // #given Flow has no Uniswap V4 or DustSwap deployment
    // #when reading swap-related fields
    // #then all are null
    expect(config.contracts.dustSwapAdapterV2).toBeNull()
    expect(config.contracts.dustSwapVanillaPoolKey).toBeNull()
    expect(config.contracts.uniswapV4PoolManager).toBeNull()
    expect(config.contracts.uniswapV4StateView).toBeNull()
    expect(config.contracts.uniswapV4Quoter).toBeNull()
  })

  it('has no V1 pool', () => {
    // #given V1 DustPool was never deployed on Flow
    // #when reading dustPool
    // #then it is null
    expect(config.contracts.dustPool).toBeNull()
    expect(config.contracts.dustPoolVerifier).toBeNull()
  })

  it('is a testnet', () => {
    expect(config.testnet).toBe(true)
  })

  it('is not an L2', () => {
    // #given Flow EVM Testnet is an L1
    // #when reading isL2
    // #then it is false
    expect(config.isL2).toBe(false)
  })

  it('has a viemChain with matching chain ID', () => {
    expect(config.viemChain).toBeDefined()
    expect(config.viemChain.id).toBe(FLOW_CHAIN_ID)
  })

  it('has a block explorer URL', () => {
    expect(config.blockExplorerUrl).toBe('https://evm-testnet.flowscan.io')
  })
})

// ─── Contract addresses ───────────────────────────────────────────────────────

describe('Flow EVM Testnet: contract addresses', () => {
  const config = getChainConfig(FLOW_CHAIN_ID)

  it('has non-empty announcer address', () => {
    expect(config.contracts.announcer).toBeTruthy()
  })

  it('has non-empty registry address', () => {
    expect(config.contracts.registry).toBeTruthy()
  })

  it('has non-empty walletFactory address', () => {
    expect(config.contracts.walletFactory).toBeTruthy()
  })

  it('has non-empty accountFactory address', () => {
    expect(config.contracts.accountFactory).toBeTruthy()
  })

  it('has non-empty entryPoint address', () => {
    expect(config.contracts.entryPoint).toBeTruthy()
  })

  it('has non-empty paymaster address', () => {
    expect(config.contracts.paymaster).toBeTruthy()
  })

  it('has DustPoolV2 address', () => {
    expect(config.contracts.dustPoolV2).toBeTruthy()
  })

  it('has DustPoolV2 verifier address', () => {
    expect(config.contracts.dustPoolV2Verifier).toBeTruthy()
  })

  it('has DustPoolV2 split verifier address', () => {
    expect(config.contracts.dustPoolV2SplitVerifier).toBeTruthy()
  })

  it('has compliance verifier address', () => {
    expect(config.contracts.dustPoolV2ComplianceVerifier).toBeTruthy()
  })

  it('has nameVerifier address', () => {
    expect(config.contracts.nameVerifier).toBeTruthy()
  })

  it('has nameRegistryMerkle address', () => {
    expect(config.contracts.nameRegistryMerkle).toBeTruthy()
  })
})

describe('Flow EVM Testnet: address checksum validation', () => {
  const config = getChainConfig(FLOW_CHAIN_ID)

  const addressFields: Array<[string, string | null]> = [
    ['announcer', config.contracts.announcer],
    ['registry', config.contracts.registry],
    ['walletFactory', config.contracts.walletFactory],
    ['accountFactory', config.contracts.accountFactory],
    ['entryPoint', config.contracts.entryPoint],
    ['paymaster', config.contracts.paymaster],
    ['dustPoolV2', config.contracts.dustPoolV2],
    ['dustPoolV2Verifier', config.contracts.dustPoolV2Verifier],
    ['dustPoolV2SplitVerifier', config.contracts.dustPoolV2SplitVerifier],
    ['dustPoolV2ComplianceVerifier', config.contracts.dustPoolV2ComplianceVerifier],
    ['nameVerifier', config.contracts.nameVerifier],
    ['nameRegistryMerkle', config.contracts.nameRegistryMerkle],
  ]

  it.each(
    addressFields
      .filter(([, addr]) => addr !== null && addr !== '')
      .map(([name, addr]) => [name, addr])
  )('%s is a valid checksummed address', (_name, addr) => {
    // #given a non-null contract address
    // #when checksumming with viem getAddress
    // #then it matches the stored value (already checksummed)
    expect(getAddress(addr as string)).toBe(addr)
  })
})

// ─── Token config ─────────────────────────────────────────────────────────────

describe('Flow EVM Testnet: token config', () => {
  it('has tokens registered for chain 545', () => {
    // #given Flow EVM Testnet
    // #when fetching token list
    // #then it is non-empty
    const tokens = getTokensForChain(FLOW_CHAIN_ID)
    expect(tokens.length).toBeGreaterThan(0)
  })

  it('has WFLOW token with correct config', () => {
    // #given Flow's native wrapped token is WFLOW
    // #when looking up by symbol
    // #then address and decimals are correct
    const wflow = getTokenBySymbol(FLOW_CHAIN_ID, 'WFLOW')
    expect(wflow).toBeDefined()
    expect(wflow!.symbol).toBe('WFLOW')
    expect(wflow!.decimals).toBe(18)
    expect(wflow!.name).toBe('Wrapped FLOW')
    expect(wflow!.address).toBe('0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e')
  })

  it('has USDC token', () => {
    // #given Flow EVM Testnet has a mock USDC
    // #when looking up by symbol
    // #then it exists with correct decimals
    const usdc = getTokenBySymbol(FLOW_CHAIN_ID, 'USDC')
    expect(usdc).toBeDefined()
    expect(usdc!.decimals).toBe(6)
    expect(usdc!.address).toBe('0xd431955D55a99EF69BEb96BA34718d0f9fBc91b1')
  })
})

// ─── Denomination config ──────────────────────────────────────────────────────

describe('Flow EVM Testnet: denomination support', () => {
  it('FLOW uses the same denomination table as ETH', () => {
    // #given FLOW is an 18-decimal native token
    // #when fetching denominations for FLOW
    // #then it returns the ETH denomination table
    const flowDenoms = getDenominations('FLOW')
    expect(flowDenoms).toBe(ETH_DENOMINATIONS)
  })

  it('FLOW denominations are in descending order', () => {
    // #given the FLOW denomination table
    // #when checking order
    // #then each value is >= the next
    const denoms = getDenominations('FLOW')
    for (let i = 1; i < denoms.length; i++) {
      expect(denoms[i - 1]).toBeGreaterThan(denoms[i])
    }
  })

  it('FLOW denomination lookup is case-insensitive', () => {
    // #given getDenominations normalizes to uppercase
    // #when passing lowercase
    // #then it still resolves
    expect(getDenominations('flow')).toBe(ETH_DENOMINATIONS)
  })
})

// ─── Provider tests ───────────────────────────────────────────────────────────

describe('Flow EVM Testnet: providers', () => {
  it('getServerProvider(545) returns a provider', () => {
    // #given Flow is a supported chain
    // #when requesting a server provider
    // #then it returns a valid provider instance
    const provider = getServerProvider(FLOW_CHAIN_ID)
    expect(provider).toBeDefined()
  })

  it('getCachedProvider(545) returns a provider', () => {
    // #given Flow is a supported chain
    // #when requesting a cached client provider
    // #then it returns a valid provider instance
    const provider = getChainProvider(FLOW_CHAIN_ID)
    expect(provider).toBeDefined()
  })

  it('getMaxGasPrice(545) returns 500 gwei', () => {
    // #given Flow EVM has 100 gwei base gas — cap is 500 gwei
    // #when requesting max gas price
    // #then it returns 500 gwei
    const maxGas = getMaxGasPrice(FLOW_CHAIN_ID)
    expect(maxGas.toString()).toBe('500000000000')
  })
})
