"use client";
import { SwapV2Card } from "@/components/swap/SwapV2Card";
import { PoolStats } from "@/components/swap/PoolStats";
import { PoolComposition } from "@/components/swap/PoolComposition";
import { usePoolStats } from "@/hooks/swap/usePoolStats";
import { useChainlinkPrice } from "@/hooks/swap/useChainlinkPrice";
import { isSwapSupported } from "@/lib/swap/constants";
import { isGenericSwapAdapter } from "@/lib/swap/contracts";
import { useAuth } from "@/contexts/AuthContext";

export default function SwapPageClient() {
  const { activeChainId } = useAuth();
  const swapSupported = isSwapSupported(activeChainId);
  const genericAdapter = isGenericSwapAdapter(activeChainId);

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
    isGenericAdapter: genericAdapter,
    chainId: activeChainId,
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
              chainId={activeChainId}
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
            chainId={activeChainId}
          />
        </div>
      )}

      {/* Hackathon Info Panel */}
      <HackathonInfoPanel />
    </div>
  );
}

function HackathonInfoPanel() {
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-xs">
      <details className="group">
        <summary className="cursor-pointer list-none flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(0,255,100,0.08)] border border-[rgba(0,255,100,0.15)] backdrop-blur-md text-[rgba(255,255,255,0.6)] hover:text-white hover:border-[rgba(0,255,100,0.3)] transition-all text-xs font-mono">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400 shrink-0">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <span>PL Genesis Hackathon Demo</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto transition-transform group-open:rotate-180">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>
        <div className="mt-2 p-3 rounded-lg bg-[rgba(10,10,15,0.95)] border border-[rgba(0,255,100,0.12)] backdrop-blur-xl text-[11px] font-mono leading-relaxed space-y-2.5">
          <div className="text-[rgba(0,255,100,0.7)] font-semibold tracking-wider text-[10px] uppercase">
            How It Works
          </div>
          <div className="text-[rgba(255,255,255,0.5)] space-y-1.5">
            <p>
              <span className="text-[rgba(0,255,100,0.6)]">1.</span>{" "}
              Deposit FLOW into the shielded pool (ZK-UTXO)
            </p>
            <p>
              <span className="text-[rgba(0,255,100,0.6)]">2.</span>{" "}
              Generate FFLONK proof in-browser (~30s)
            </p>
            <p>
              <span className="text-[rgba(0,255,100,0.6)]">3.</span>{" "}
              Relayer withdraws + swaps on PunchSwap atomically
            </p>
            <p>
              <span className="text-[rgba(0,255,100,0.6)]">4.</span>{" "}
              Output USDC deposited back as shielded UTXO
            </p>
          </div>

          <div className="border-t border-[rgba(255,255,255,0.06)] pt-2 space-y-1.5">
            <div className="text-[rgba(0,255,100,0.7)] font-semibold tracking-wider text-[10px] uppercase">
              Notes
            </div>
            <div className="text-[rgba(255,255,255,0.45)] space-y-1">
              <p>
                <span className="text-yellow-400/60">Slippage</span> &mdash; Default 0.5%. Increase to 1-2% for large swaps or when using denomination privacy with multiple chunks.
              </p>
              <p>
                <span className="text-yellow-400/60">Denom Privacy</span> &mdash; Splits your swap into common-sized chunks (e.g. 100+100+50). Each chunk swaps separately with random delays. May take 2-5 min.
              </p>
              <p>
                <span className="text-yellow-400/60">Relayer Fee</span> &mdash; 2% covers gas. The relayer submits your tx so your wallet address is never linked to the swap.
              </p>
              <p>
                <span className="text-yellow-400/60">Liquidity</span> &mdash; Swaps route through PunchSwap V2 (FLOW/USDC pool). Your DustPool balance does not need USDC &mdash; the adapter fetches it from PunchSwap atomically.
              </p>
            </div>
          </div>

          <div className="border-t border-[rgba(255,255,255,0.06)] pt-2 text-[rgba(255,255,255,0.3)] text-[10px]">
            Flow EVM Testnet &middot; Dust Protocol &middot; PL Genesis 2026
          </div>
        </div>
      </details>
    </div>
  );
}
