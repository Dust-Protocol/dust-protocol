"use client";

import { SwapV2Card } from "@/components/swap/SwapV2Card";
import { PoolStats } from "@/components/swap/PoolStats";
import { PoolComposition } from "@/components/swap/PoolComposition";
import { usePoolStats } from "@/hooks/swap/usePoolStats";
import { useChainlinkPrice } from "@/hooks/swap/useChainlinkPrice";
import { isSwapSupported } from "@/lib/swap/constants";
import { useAuth } from "@/contexts/AuthContext";

export default function SwapPageClient() {
  const { activeChainId } = useAuth();
  const swapSupported = isSwapSupported(activeChainId);

  const {
    currentPrice: poolPrice,
    ethReserve,
    usdcReserve,
    shieldedEth,
    shieldedUsdc,
    noteCount,
    combinedTvl,
    liquidity,
    isLoading,
    tick,
    refetch,
  } = usePoolStats();

  const { price: chainlinkPrice } = useChainlinkPrice();

  // Prefer Chainlink oracle price; fall back to pool spot price
  const oraclePrice = chainlinkPrice ?? poolPrice;

  const poolStatsProps = {
    currentPrice: oraclePrice,
    shieldedEth,
    shieldedUsdc,
    noteCount,
    combinedTvl,
    isLoading,
    poolTick: tick !== undefined ? tick : undefined,
    priceSource: chainlinkPrice != null ? 'chainlink' as const : poolPrice != null ? 'pool' as const : undefined,
    liquidity,
  };

  return (
    <div className="w-full flex flex-col items-center gap-2 px-6 pb-12 pt-8">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-bold tracking-widest text-white font-mono mb-2">
          STEALTH_SWAP
        </h1>
        <p className="text-sm text-[rgba(255,255,255,0.4)] font-mono tracking-wide">
          Private, slippage-free token swaps via ZK proofs
        </p>
      </div>

      {/* Main Row: Stats | Card | Composition — desktop */}
      <div className="flex items-stretch justify-center gap-5 w-full max-w-[1100px]">
        {swapSupported && (
          <div className="hidden md:flex">
            <PoolStats {...poolStatsProps} />
          </div>
        )}
        <SwapV2Card onPoolChange={refetch} oraclePrice={oraclePrice} />
        {swapSupported && (
          <div className="hidden md:flex">
            <PoolComposition
              ethReserve={ethReserve}
              usdcReserve={usdcReserve}
              shieldedEth={shieldedEth}
              shieldedUsdc={shieldedUsdc}
              currentPrice={oraclePrice}
            />
          </div>
        )}
      </div>

      {/* Mobile: Stats and Composition below card */}
      {swapSupported && (
        <div className="flex flex-col items-center gap-3 md:hidden w-full">
          <PoolStats {...poolStatsProps} />
          <PoolComposition
            ethReserve={ethReserve}
            usdcReserve={usdcReserve}
            shieldedEth={shieldedEth}
            shieldedUsdc={shieldedUsdc}
            currentPrice={oraclePrice}
          />
        </div>
      )}
    </div>
  );
}
