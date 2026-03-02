"use client";

import { useAuth } from "@/contexts/AuthContext";
import { getChainConfig, isChainSupported } from "@/config/chains";

export function ChainMismatchBanner() {
  const { isChainMismatch, walletChainId, activeChainId, switchWalletToActiveChain } = useAuth();

  if (!isChainMismatch || !walletChainId) return null;

  const walletChainName = isChainSupported(walletChainId)
    ? getChainConfig(walletChainId).name
    : `Chain ${walletChainId}`;
  const appChainName = getChainConfig(activeChainId).name;

  return (
    <div className="sticky top-16 z-40 bg-[rgba(255,176,0,0.06)] border-b border-[rgba(255,176,0,0.2)] px-4 py-2.5">
      <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-3">
        <span className="text-[11px] font-mono text-[#FFB000]/80">
          Wallet on <strong className="text-[#FFB000]">{walletChainName}</strong>, app using <strong className="text-[#FFB000]">{appChainName}</strong>
        </span>
        <button
          onClick={switchWalletToActiveChain}
          className="shrink-0 px-3 py-1 rounded-sm text-[10px] font-bold font-mono text-[#FFB000] bg-[rgba(255,176,0,0.1)] border border-[rgba(255,176,0,0.3)] hover:bg-[rgba(255,176,0,0.18)] hover:border-[#FFB000] transition-all tracking-wider"
        >
          SWITCH WALLET
        </button>
      </div>
    </div>
  );
}
