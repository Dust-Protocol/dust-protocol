"use client";

import { useAuth } from "@/contexts/AuthContext";
import { V2SwapCard } from "@/components/swap/V2SwapCard";
import { ProtocolMetrics } from "@/components/metrics/ProtocolMetrics";
import { getChainConfig } from "@/config/chains";

export default function PoolsPageClient() {
  const { activeChainId } = useAuth();
  const nativeSymbol = getChainConfig(activeChainId).nativeCurrency.symbol;

  return (
    <div className="min-h-screen p-4 md:p-8 relative">
      <div className="max-w-[900px] mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-[28px] font-bold text-white tracking-tight mb-1 font-mono">[Shield]</h1>
          <p className="text-sm text-[rgba(255,255,255,0.5)] font-mono">Manage your shielded balances</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="p-3 rounded-sm bg-[rgba(0,255,65,0.04)] border border-[rgba(0,255,65,0.12)]">
            <p className="text-[12px] text-[rgba(255,255,255,0.4)] leading-relaxed font-mono">
              Deposit any amount of {nativeSymbol} into a single global pool. Transfer privately between users with hidden amounts,
              or withdraw to a fresh address with no link to the depositor. All operations use ZK proofs (FFLONK).
            </p>
          </div>
          <div className="flex justify-center mt-1">
            <V2SwapCard chainId={activeChainId} />
          </div>
        </div>

        <ProtocolMetrics />
      </div>
    </div>
  );
}
