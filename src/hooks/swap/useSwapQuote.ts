'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePublicClient } from 'wagmi'
import { type Address, parseUnits } from 'viem'

import {
  QUOTER_ABI,
  getVanillaPoolKey,
  getSwapDirection,
  isGenericSwapAdapter,
} from '@/lib/swap/contracts'
import { SUPPORTED_TOKENS, ETH_ADDRESS } from '@/lib/swap/constants'
import { getChainConfig } from '@/config/chains'

// V2 router ABI for getAmountsOut (PunchSwap, UniswapV2-style)
const V2_ROUTER_GET_AMOUNTS_OUT_ABI = [
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    name: 'getAmountsOut',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

function getTokenDecimals(tokenAddress: Address): number {
  const addr = tokenAddress.toLowerCase()
  if (addr === ETH_ADDRESS.toLowerCase()) return 18
  for (const token of Object.values(SUPPORTED_TOKENS)) {
    if (token.address.toLowerCase() === addr) return token.decimals
  }
  return 6
}

interface UseSwapQuoteParams {
  fromToken: Address
  toToken: Address
  amountIn: string
  chainId?: number
}

interface SwapQuoteResult {
  amountOut: bigint
  gasEstimate: bigint
  isLoading: boolean
  error: string | null
}

const DEBOUNCE_MS = 500
const MAX_UINT128 = 2n ** 128n - 1n

export function useSwapQuote({
  fromToken,
  toToken,
  amountIn,
  chainId,
}: UseSwapQuoteParams): SwapQuoteResult {
  const publicClient = usePublicClient({ chainId })

  const [amountOut, setAmountOut] = useState<bigint>(0n)
  const [gasEstimate, setGasEstimate] = useState<bigint>(0n)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef(0)

  const fetchQuote = useCallback(
    async (amount: string, callId: number) => {
      if (!publicClient || !chainId) {
        setError('Client not available')
        setIsLoading(false)
        return
      }

      const parsedAmount = parseFloat(amount)
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setAmountOut(0n)
        setGasEstimate(0n)
        setIsLoading(false)
        return
      }

      const fromDecimals = getTokenDecimals(fromToken)
      const exactAmount = parseUnits(amount, fromDecimals)

      if (exactAmount <= 0n) {
        setAmountOut(0n)
        setGasEstimate(0n)
        setIsLoading(false)
        return
      }

      if (exactAmount > MAX_UINT128) {
        setError('Amount exceeds maximum')
        setIsLoading(false)
        return
      }

      const config = getChainConfig(chainId)

      try {
        // Generic adapter chains (Flow, etc.) use V2 router getAmountsOut
        if (isGenericSwapAdapter(chainId)) {
          const routerAddress = config.contracts.dustSwapRouter as Address | undefined
          const wethAddress = config.contracts.dustSwapWflow as Address | undefined
          if (!routerAddress || !wethAddress) {
            setError('Swap router not configured')
            setIsLoading(false)
            return
          }

          const isNativeIn = fromToken.toLowerCase() === ETH_ADDRESS.toLowerCase()
          const isNativeOut = toToken.toLowerCase() === ETH_ADDRESS.toLowerCase()
          const path: Address[] = isNativeIn
            ? [wethAddress, toToken]
            : isNativeOut
              ? [fromToken, wethAddress]
              : [fromToken, toToken]

          const result = await publicClient.readContract({
            address: routerAddress,
            abi: V2_ROUTER_GET_AMOUNTS_OUT_ABI,
            functionName: 'getAmountsOut',
            args: [exactAmount, path],
          })

          if (callId !== abortRef.current) return

          const amounts = result as readonly bigint[]
          const quotedAmountOut = amounts[amounts.length - 1]

          if (quotedAmountOut <= 0n) {
            setAmountOut(0n)
            setGasEstimate(0n)
            setError('No liquidity')
            return
          }

          setAmountOut(quotedAmountOut)
          setGasEstimate(500_000n)
          setError(null)
          return
        }

        // V4 Quoter path (Ethereum Sepolia, Base, etc.)
        const quoterAddress = config.contracts.uniswapV4Quoter as Address | null
        if (!quoterAddress) {
          setError('Quoter not deployed on this chain')
          setIsLoading(false)
          return
        }

        const poolKey = getVanillaPoolKey(chainId)
        if (!poolKey) {
          setError('Vanilla pool not configured on this chain')
          return
        }
        const { zeroForOne } = getSwapDirection(fromToken, toToken, poolKey)

        const result = await publicClient.simulateContract({
          address: quoterAddress,
          abi: QUOTER_ABI,
          functionName: 'quoteExactInputSingle',
          args: [
            {
              poolKey: {
                currency0: poolKey.currency0,
                currency1: poolKey.currency1,
                fee: poolKey.fee,
                tickSpacing: poolKey.tickSpacing,
                hooks: poolKey.hooks,
              },
              zeroForOne,
              exactAmount,
              hookData: '0x' as `0x${string}`,
            },
          ],
        })

        if (callId !== abortRef.current) return

        const [quotedAmountOut, quotedGasEstimate] = result.result as [bigint, bigint]

        const toDecimals = getTokenDecimals(toToken)
        const decimalDiff = toDecimals - fromDecimals
        const inputScaled = decimalDiff >= 0
          ? exactAmount * (10n ** BigInt(decimalDiff))
          : exactAmount / (10n ** BigInt(-decimalDiff))
        const dustThreshold = inputScaled / 10000n
        if (quotedAmountOut > 0n && quotedAmountOut < dustThreshold) {
          setAmountOut(0n)
          setGasEstimate(0n)
          setError('No liquidity for this direction')
          return
        }

        setAmountOut(quotedAmountOut)
        setGasEstimate(quotedGasEstimate)
        setError(null)
      } catch (err) {
        if (callId !== abortRef.current) return
        const message = err instanceof Error ? err.message : 'Quote failed'
        setAmountOut(0n)
        setGasEstimate(0n)
        if (
          message.includes('revert') ||
          message.includes('execution reverted')
        ) {
          setError('Pool not available')
        } else {
          setError(message)
        }
      } finally {
        if (callId === abortRef.current) {
          setIsLoading(false)
        }
      }
    },
    [publicClient, chainId, fromToken, toToken]
  )

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (!amountIn || parseFloat(amountIn) <= 0) {
      setAmountOut(0n)
      setGasEstimate(0n)
      setIsLoading(false)
      setError(null)
      return
    }

    setAmountOut(0n)
    setIsLoading(true)
    setError(null)

    const callId = ++abortRef.current

    timerRef.current = setTimeout(() => {
      fetchQuote(amountIn, callId)
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      setIsLoading(false)
    }
  }, [amountIn, fetchQuote])

  return { amountOut, gasEstimate, isLoading, error }
}
