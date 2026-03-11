'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePublicClient, useChainId } from 'wagmi'
import { type Address, zeroAddress } from 'viem'
import {
  STATE_VIEW_ABI,
  getVanillaPoolKey,
  computePoolId,
  isGenericSwapAdapter,
} from '@/lib/swap/contracts'
import { getChainConfig } from '@/config/chains'
import { getUSDCAddress } from '@/lib/swap/constants'
import { DUST_POOL_V2_ABI, getDustPoolV2Address } from '@/lib/dustpool/v2/contracts'

const Q96 = BigInt(2) ** BigInt(96)
const Q192 = Q96 * Q96
const POLL_INTERVAL_MS = 60_000 // Reduced RPC calls - pool stats are display-only

export interface PoolStatsData {
  sqrtPriceX96: bigint
  tick: number
  liquidity: bigint
  /** ETH price in USDC (human-readable, e.g. 2500.0) */
  currentPrice: number | null
  /** Estimated ETH in pool (human-readable) */
  ethReserve: number
  /** Estimated USDC in pool (human-readable) */
  usdcReserve: number
  /** Total value locked in USD (swap pool only) */
  totalValueLocked: number
  /** Shielded ETH in DustPoolV2 (human-readable) */
  shieldedEth: number
  /** Shielded USDC in DustPoolV2 (human-readable) */
  shieldedUsdc: number
  /** Total notes in DustPoolV2 (deposit queue tail) */
  noteCount: number
  /** Combined TVL: privacy pool + swap pool */
  combinedTvl: number
  isLoading: boolean
  error: string | null
  /** Re-fetch pool data immediately */
  refetch: () => void
}

/**
 * Derive ETH/USDC price from sqrtPriceX96 using bigint math.
 *
 * sqrtPriceX96 = sqrt(price_raw) * 2^96
 * price_raw = token1_smallest / token0_smallest = USDC_units / ETH_wei
 * price_human = price_raw * 10^(token0_decimals - token1_decimals)
 *             = price_raw * 10^(18 - 6) = price_raw * 10^12
 *
 * Using bigint to avoid Number overflow (sqrtPriceX96 can be ~3.96e27
 * which is far beyond Number.MAX_SAFE_INTEGER ~9e15).
 *
 * For correctly initialized pools (tick ≈ -198,000): applies full 10^12 decimal
 * adjustment. For pools initialized with human-readable sqrtPrice (tick ≈ 78,000):
 * the decimal offset is already baked in — detected via sanity bound.
 */
const DECIMAL_ADJUSTMENT = BigInt(10) ** BigInt(12)

function sqrtPriceToHumanPrice(sqrtPriceX96: bigint): number {
  const sqrtPriceSq = sqrtPriceX96 * sqrtPriceX96

  // Standard conversion with 10^12 decimal adjustment + 10^2 for precision
  const priceX100 = (sqrtPriceSq * DECIMAL_ADJUSTMENT * 100n) / Q192
  const price = Number(priceX100) / 100

  // Guard: if price exceeds $1M/ETH the pool was likely initialized with
  // human-readable price (sqrt(2500) * 2^96 instead of sqrt(2.5e-9) * 2^96),
  // meaning the decimal adjustment was already baked into sqrtPriceX96.
  if (price > 1_000_000) {
    const rawX100 = (sqrtPriceSq * 100n) / Q192
    return Number(rawX100) / 100
  }

  return price
}

/**
 * Estimate reserves from liquidity and sqrtPriceX96.
 *
 * For concentrated liquidity around the current tick:
 *   amount0 (ETH) ≈ L / sqrtPrice  →  L * 2^96 / sqrtPriceX96  (in wei)
 *   amount1 (USDC) ≈ L * sqrtPrice →  L * sqrtPriceX96 / 2^96  (in USDC units)
 *
 * We convert using bigint math then scale to human-readable units.
 */
function estimateReserves(
  liquidity: bigint,
  sqrtPriceX96: bigint
): { ethReserve: number; usdcReserve: number } {
  if (liquidity === BigInt(0) || sqrtPriceX96 === BigInt(0)) {
    return { ethReserve: 0, usdcReserve: 0 }
  }

  // ETH reserve: L * 2^96 / sqrtPriceX96, in wei → divide by 10^18 for ETH
  // To get 6 decimal places: multiply by 10^6 first, convert, then divide
  const ethWeiX1e6 = (liquidity * Q96 * BigInt(1e6)) / sqrtPriceX96
  const ethReserve = Number(ethWeiX1e6) / 1e6 / 1e18

  // USDC reserve: L * sqrtPriceX96 / 2^96, in USDC units → divide by 10^6
  // To get 2 decimal places: multiply by 10^2 first
  const usdcUnitsX100 = (liquidity * sqrtPriceX96 * BigInt(100)) / Q96
  const usdcReserve = Number(usdcUnitsX100) / 100 / 1e6

  return { ethReserve, usdcReserve }
}

async function fetchPrivacyPoolStats(
  client: ReturnType<typeof usePublicClient>,
  poolAddress: Address,
  chainId: number,
): Promise<{ ethWei: bigint; usdcUnits: bigint; noteCount: number }> {
  if (!client) return { ethWei: 0n, usdcUnits: 0n, noteCount: 0 }

  let usdcAddr: Address | undefined
  try { usdcAddr = getUSDCAddress(chainId) } catch { /* USDC not configured */ }
  const calls = [
    client.readContract({
      address: poolAddress,
      abi: DUST_POOL_V2_ABI,
      functionName: 'totalDeposited',
      args: [zeroAddress],
    }),
    client.readContract({
      address: poolAddress,
      abi: DUST_POOL_V2_ABI,
      functionName: 'depositQueueTail',
    }),
  ]

  if (usdcAddr) {
    calls.push(
      client.readContract({
        address: poolAddress,
        abi: DUST_POOL_V2_ABI,
        functionName: 'totalDeposited',
        args: [usdcAddr],
      }),
    )
  }

  const results = await Promise.all(calls)
  return {
    ethWei: results[0] as bigint,
    usdcUnits: usdcAddr ? (results[2] as bigint) : 0n,
    noteCount: Number(results[1] as bigint),
  }
}

// V2 pair ABI for getReserves (PunchSwap, UniswapV2-style)
const V2_PAIR_ABI = [
  {
    inputs: [],
    name: 'getReserves',
    outputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token0',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const V2_FACTORY_ABI = [
  {
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
    ],
    name: 'getPair',
    outputs: [{ name: 'pair', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

async function fetchV2PairReserves(
  client: ReturnType<typeof usePublicClient>,
  chainId: number,
): Promise<{ ethReserve: number; usdcReserve: number; price: number | null } | null> {
  if (!client) return null

  const config = getChainConfig(chainId)
  const factoryAddress = config.contracts.dustSwapFactory as Address | undefined
  const wethAddress = config.contracts.dustSwapWflow as Address | undefined
  if (!factoryAddress || !wethAddress) return null

  let usdcAddr: Address
  try { usdcAddr = getUSDCAddress(chainId) } catch { return null }

  try {
    const pairAddress = await client.readContract({
      address: factoryAddress,
      abi: V2_FACTORY_ABI,
      functionName: 'getPair',
      args: [wethAddress, usdcAddr],
    }) as Address

    if (pairAddress === zeroAddress) return null

    const [reserves, token0] = await Promise.all([
      client.readContract({
        address: pairAddress,
        abi: V2_PAIR_ABI,
        functionName: 'getReserves',
      }),
      client.readContract({
        address: pairAddress,
        abi: V2_PAIR_ABI,
        functionName: 'token0',
      }),
    ])

    const [reserve0, reserve1] = reserves as [bigint, bigint, number]
    const token0Addr = (token0 as Address).toLowerCase()
    const wethLower = wethAddress.toLowerCase()

    // Determine which reserve is WETH and which is USDC
    const ethWei = token0Addr === wethLower ? reserve0 : reserve1
    const usdcUnits = token0Addr === wethLower ? reserve1 : reserve0

    const ethReserve = Number(ethWei) / 1e18
    const usdcReserve = Number(usdcUnits) / 1e6
    const price = ethReserve > 0 ? usdcReserve / ethReserve : null

    return { ethReserve, usdcReserve, price }
  } catch {
    return null
  }
}

async function fetchSwapPoolStats(
  client: ReturnType<typeof usePublicClient>,
  stateViewAddress: Address,
  chainId: number,
): Promise<{ sqrtPriceX96: bigint; tick: number; liquidity: bigint } | null> {
  if (!client) return null

  const poolKey = getVanillaPoolKey(chainId)
  if (!poolKey) return null
  const poolId = computePoolId(poolKey)

  try {
    const [slot0Result, liquidityResult] = await Promise.all([
      client.readContract({
        address: stateViewAddress,
        abi: STATE_VIEW_ABI,
        functionName: 'getSlot0',
        args: [poolId],
      }),
      client.readContract({
        address: stateViewAddress,
        abi: STATE_VIEW_ABI,
        functionName: 'getLiquidity',
        args: [poolId],
      }),
    ])

    const [price, poolTick] = slot0Result as [bigint, number, number, number]
    return {
      sqrtPriceX96: price,
      tick: poolTick,
      liquidity: liquidityResult as bigint,
    }
  } catch (err) {
    // Pool may not be initialized — return zeros
    const message = err instanceof Error ? err.message : ''
    if (message.includes('revert') || message.includes('execution reverted')) {
      return { sqrtPriceX96: 0n, tick: 0, liquidity: 0n }
    }
    throw err
  }
}

export function usePoolStats(chainIdParam?: number): PoolStatsData {
  const walletChainId = useChainId()
  const chainId = chainIdParam ?? walletChainId
  const publicClient = usePublicClient({ chainId })

  const [sqrtPriceX96, setSqrtPriceX96] = useState<bigint>(BigInt(0))
  const [tick, setTick] = useState<number>(0)
  const [liquidity, setLiquidity] = useState<bigint>(BigInt(0))
  const [shieldedEthWei, setShieldedEthWei] = useState<bigint>(0n)
  const [shieldedUsdcUnits, setShieldedUsdcUnits] = useState<bigint>(0n)
  const [noteCount, setNoteCount] = useState<number>(0)
  const [v2EthReserve, setV2EthReserve] = useState<number>(0)
  const [v2UsdcReserve, setV2UsdcReserve] = useState<number>(0)
  const [v2Price, setV2Price] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const mountedRef = useRef(true)

  const fetchPoolData = useCallback(async () => {
    if (!publicClient || !chainId) {
      setError('Client not available')
      setIsLoading(false)
      return
    }

    const config = getChainConfig(chainId)

    // Generic adapter chains (e.g. Flow EVM) have no V4 PoolManager/StateView.
    // Skip V4 queries entirely — only fetch privacy pool stats.
    const isGeneric = isGenericSwapAdapter(chainId)

    // Fetch DustPoolV2 stats (privacy pool) — independent of swap pool
    const dustPoolAddress = getDustPoolV2Address(chainId)
    const privacyPoolPromise = dustPoolAddress
      ? fetchPrivacyPoolStats(publicClient, dustPoolAddress, chainId)
      : Promise.resolve(null)

    // Fetch swap pool stats — V4 for standard chains, V2 pair for generic adapter chains
    const stateViewAddress = isGeneric
      ? null
      : (config.contracts.uniswapV4StateView as Address | null)
    const swapPoolPromise = stateViewAddress
      ? fetchSwapPoolStats(publicClient, stateViewAddress, chainId)
      : Promise.resolve(null)
    const v2PairPromise = isGeneric
      ? fetchV2PairReserves(publicClient, chainId)
      : Promise.resolve(null)

    try {
      const [privacyResult, swapResult, v2Result] = await Promise.all([
        privacyPoolPromise,
        swapPoolPromise,
        v2PairPromise,
      ])

      if (!mountedRef.current) return

      if (swapResult) {
        setSqrtPriceX96(swapResult.sqrtPriceX96)
        setTick(swapResult.tick)
        setLiquidity(swapResult.liquidity)
      }

      if (v2Result) {
        setV2EthReserve(v2Result.ethReserve)
        setV2UsdcReserve(v2Result.usdcReserve)
        setV2Price(v2Result.price)
      }

      if (privacyResult) {
        setShieldedEthWei(privacyResult.ethWei)
        setShieldedUsdcUnits(privacyResult.usdcUnits)
        setNoteCount(privacyResult.noteCount)
      }

      setError(null)
    } catch (err) {
      if (!mountedRef.current) return
      const message = err instanceof Error ? err.message : 'Failed to read pool'
      setError(message)
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [publicClient, chainId])

  // Initial fetch + polling
  useEffect(() => {
    mountedRef.current = true
    setIsLoading(true)
    fetchPoolData()

    const interval = setInterval(fetchPoolData, POLL_INTERVAL_MS)

    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [fetchPoolData])

  // Derived values — use V2 pair data on generic chains, V4 on standard chains
  const isGeneric = isGenericSwapAdapter(chainId)

  const currentPrice = isGeneric
    ? v2Price
    : sqrtPriceX96 > BigInt(0) ? sqrtPriceToHumanPrice(sqrtPriceX96) : null

  const v4Reserves = estimateReserves(liquidity, sqrtPriceX96)
  const ethReserve = isGeneric ? v2EthReserve : v4Reserves.ethReserve
  const usdcReserve = isGeneric ? v2UsdcReserve : v4Reserves.usdcReserve

  const totalValueLocked =
    currentPrice !== null
      ? ethReserve * currentPrice + usdcReserve
      : 0

  // Privacy pool reserves (human-readable)
  const shieldedEth = Number(shieldedEthWei) / 1e18
  const shieldedUsdc = Number(shieldedUsdcUnits) / 1e6

  // Combined TVL: privacy pool + swap pool
  const shieldedTvl = currentPrice !== null
    ? shieldedEth * currentPrice + shieldedUsdc
    : shieldedEth * 2000 + shieldedUsdc // fallback price estimate
  const combinedTvl = totalValueLocked + shieldedTvl

  return {
    sqrtPriceX96,
    tick,
    liquidity,
    currentPrice,
    ethReserve,
    usdcReserve,
    totalValueLocked,
    shieldedEth,
    shieldedUsdc,
    noteCount,
    combinedTvl,
    isLoading,
    error,
    refetch: fetchPoolData,
  }
}
