import { type Address, keccak256, encodeAbiParameters } from 'viem'
import { getChainConfig, DEFAULT_CHAIN_ID } from '@/config/chains'

const SQRT_PRICE_LIMITS = {
  MIN: BigInt('4295128740'),
  MAX: BigInt('1461446703485210103287273052203988822378723970341'),
} as const

// ─── DustSwapAdapterV2 ABI ──────────────────────────────────────────────────

export const DUST_SWAP_ADAPTER_V2_ABI = [
  {
    inputs: [
      { name: 'proof', type: 'bytes' },
      { name: 'merkleRoot', type: 'bytes32' },
      { name: 'nullifier0', type: 'bytes32' },
      { name: 'nullifier1', type: 'bytes32' },
      { name: 'outCommitment0', type: 'bytes32' },
      { name: 'outCommitment1', type: 'bytes32' },
      { name: 'publicAmount', type: 'uint256' },
      { name: 'publicAsset', type: 'uint256' },
      { name: 'tokenIn', type: 'address' },
      {
        name: 'poolKey',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
      { name: 'zeroForOne', type: 'bool' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'ownerPubKey', type: 'uint256' },
      { name: 'blinding', type: 'uint256' },
      { name: 'tokenOut', type: 'address' },
      { name: 'relayer', type: 'address' },
      { name: 'relayerFeeBps', type: 'uint256' },
    ],
    name: 'executeSwap',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'nullifier', type: 'bytes32' },
      { indexed: true, name: 'outputCommitment', type: 'bytes32' },
      { indexed: false, name: 'tokenIn', type: 'address' },
      { indexed: false, name: 'tokenOut', type: 'address' },
      { indexed: false, name: 'outputAmount', type: 'uint256' },
      { indexed: false, name: 'relayerFeeBps', type: 'uint256' },
    ],
    name: 'PrivateSwapExecuted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'relayer', type: 'address' },
      { indexed: false, name: 'allowed', type: 'bool' },
    ],
    name: 'RelayerUpdated',
    type: 'event',
  },
  {
    inputs: [
      { name: 'relayer', type: 'address' },
      { name: 'allowed', type: 'bool' },
    ],
    name: 'setRelayer',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'authorizedRelayers',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  { inputs: [], name: 'NotRelayer', type: 'error' },
  { inputs: [], name: 'SlippageExceeded', type: 'error' },
  { inputs: [], name: 'RelayerFeeTooHigh', type: 'error' },
  { inputs: [], name: 'ZeroMinAmount', type: 'error' },
  { inputs: [], name: 'SwapFailed', type: 'error' },
  { inputs: [], name: 'TransferFailed', type: 'error' },
  { inputs: [], name: 'PoolPaused', type: 'error' },
] as const

// ─── DustSwapAdapterGeneric ABI (no V4 pool key — uses arbitrary router) ────

export const DUST_SWAP_ADAPTER_GENERIC_ABI = [
  {
    inputs: [
      { name: 'proof', type: 'bytes' },
      { name: 'merkleRoot', type: 'bytes32' },
      { name: 'nullifier0', type: 'bytes32' },
      { name: 'nullifier1', type: 'bytes32' },
      { name: 'outCommitment0', type: 'bytes32' },
      { name: 'outCommitment1', type: 'bytes32' },
      { name: 'publicAmount', type: 'uint256' },
      { name: 'publicAsset', type: 'uint256' },
      { name: 'tokenIn', type: 'address' },
      { name: 'router', type: 'address' },
      { name: 'swapCalldata', type: 'bytes' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'outputCommitment', type: 'bytes32' },
      { name: 'tokenOut', type: 'address' },
      { name: 'relayer', type: 'address' },
      { name: 'relayerFeeBps', type: 'uint256' },
    ],
    name: 'executeSwap',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'nullifier', type: 'bytes32' },
      { indexed: true, name: 'outputCommitment', type: 'bytes32' },
      { indexed: false, name: 'tokenIn', type: 'address' },
      { indexed: false, name: 'tokenOut', type: 'address' },
      { indexed: false, name: 'outputAmount', type: 'uint256' },
      { indexed: false, name: 'relayerFeeBps', type: 'uint256' },
    ],
    name: 'PrivateSwapExecuted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'relayer', type: 'address' },
      { indexed: false, name: 'allowed', type: 'bool' },
    ],
    name: 'RelayerUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'router', type: 'address' },
      { indexed: false, name: 'allowed', type: 'bool' },
    ],
    name: 'RouterUpdated',
    type: 'event',
  },
  {
    inputs: [
      { name: 'relayer', type: 'address' },
      { name: 'allowed', type: 'bool' },
    ],
    name: 'setRelayer',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'router', type: 'address' },
      { name: 'allowed', type: 'bool' },
    ],
    name: 'setRouter',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'authorizedRelayers',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'allowedRouters',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  { inputs: [], name: 'NotRelayer', type: 'error' },
  { inputs: [], name: 'NotAllowedRouter', type: 'error' },
  { inputs: [], name: 'RouterIsPool', type: 'error' },
  { inputs: [], name: 'RouterIsSelf', type: 'error' },
  { inputs: [], name: 'SlippageExceeded', type: 'error' },
  { inputs: [], name: 'RelayerFeeTooHigh', type: 'error' },
  { inputs: [], name: 'ZeroMinAmount', type: 'error' },
  { inputs: [], name: 'SwapFailed', type: 'error' },
  { inputs: [], name: 'TransferFailed', type: 'error' },
  { inputs: [], name: 'PoolPaused', type: 'error' },
] as const

export function getDustSwapAdapterV2Config(chainId?: number) {
  const config = getChainConfig(chainId ?? DEFAULT_CHAIN_ID)
  const adapterAddress = config.contracts.dustSwapAdapterV2
  if (!adapterAddress) {
    return null
  }
  return {
    address: adapterAddress as Address,
    abi: DUST_SWAP_ADAPTER_V2_ABI,
  }
}

/** Returns true if this chain uses the generic swap adapter (no V4 pool key) */
export function isGenericSwapAdapter(chainId?: number): boolean {
  const config = getChainConfig(chainId ?? DEFAULT_CHAIN_ID)
  return !!(
    config.contracts.dustSwapAdapterV2 &&
    !config.contracts.dustSwapVanillaPoolKey
  )
}

export function getDustSwapAdapterGenericConfig(chainId?: number) {
  const config = getChainConfig(chainId ?? DEFAULT_CHAIN_ID)
  const adapterAddress = config.contracts.dustSwapAdapterV2
  if (!adapterAddress || !isGenericSwapAdapter(chainId)) {
    return null
  }
  return {
    address: adapterAddress as Address,
    abi: DUST_SWAP_ADAPTER_GENERIC_ABI,
  }
}

// ─── ERC20 ABI ──────────────────────────────────────────────────────────────

export const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// ─── Uniswap V4 Quoter ABI ───────────────────────────────────────────────────

export const QUOTER_ABI = [
  {
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          {
            name: 'poolKey',
            type: 'tuple',
            components: [
              { name: 'currency0', type: 'address' },
              { name: 'currency1', type: 'address' },
              { name: 'fee', type: 'uint24' },
              { name: 'tickSpacing', type: 'int24' },
              { name: 'hooks', type: 'address' },
            ],
          },
          { name: 'zeroForOne', type: 'bool' },
          { name: 'exactAmount', type: 'uint128' },
          { name: 'hookData', type: 'bytes' },
        ],
      },
    ],
    name: 'quoteExactInputSingle',
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

// ─── Uniswap V4 StateView ABI ───────────────────────────────────────────────

export const STATE_VIEW_ABI = [
  {
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    name: 'getSlot0',
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'lpFee', type: 'uint24' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    name: 'getLiquidity',
    outputs: [{ name: 'liquidity', type: 'uint128' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// ─── Pool Key ────────────────────────────────────────────────────────────────

export interface PoolKey {
  currency0: Address
  currency1: Address
  fee: number
  tickSpacing: number
  hooks: Address
}

export function getVanillaPoolKey(chainId?: number): PoolKey | null {
  const config = getChainConfig(chainId ?? DEFAULT_CHAIN_ID)
  const key = config.contracts.dustSwapVanillaPoolKey
  if (!key) {
    return null
  }
  return {
    currency0: key.currency0 as Address,
    currency1: key.currency1 as Address,
    fee: key.fee,
    tickSpacing: key.tickSpacing,
    hooks: key.hooks as Address,
  }
}

export function computePoolId(poolKey: PoolKey): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'address' },
        { type: 'uint24' },
        { type: 'int24' },
        { type: 'address' },
      ],
      [
        poolKey.currency0,
        poolKey.currency1,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks,
      ]
    )
  )
}

export function getERC20Config(tokenAddress: Address) {
  return {
    address: tokenAddress,
    abi: ERC20_ABI,
  }
}

export function isNativeToken(tokenAddress: Address): boolean {
  return tokenAddress.toLowerCase() === '0x0000000000000000000000000000000000000000'
}

export function getSwapDirection(
  fromToken: Address,
  _toToken: Address,
  poolKey: PoolKey
): { zeroForOne: boolean; sqrtPriceLimitX96: bigint } {
  const zeroForOne = fromToken.toLowerCase() === poolKey.currency0.toLowerCase()
  return {
    zeroForOne,
    sqrtPriceLimitX96: zeroForOne
      ? SQRT_PRICE_LIMITS.MIN
      : SQRT_PRICE_LIMITS.MAX,
  }
}
