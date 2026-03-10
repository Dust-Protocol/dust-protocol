"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useStealthScanner, useUnifiedBalance, useDustPool } from "@/hooks/stealth";
import { getExplorerBase } from "@/lib/design/tokens";
import { getChainConfig } from "@/config/chains";
import { ConsolidateModal } from "@/components/dashboard/ConsolidateModal";
import {
  WalletIcon, ShieldIcon, KeyIcon, RefreshIcon,
  ExternalLinkIcon,
} from "@/components/stealth/icons";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const {
    stealthKeys,
    isConnected,
    claimAddresses,
    refreshClaimBalances,
    claimAddressesInitialized,
    activeChainId,
  } = useAuth();

  const chainConfig = getChainConfig(activeChainId);
  const explorerBase = getExplorerBase(activeChainId);
  const nativeSymbol = chainConfig.nativeCurrency.symbol;

  // ─── Stealth Scanner ──────────────────────────────────────────────────────
  const { payments, scan, isScanning } = useStealthScanner(stealthKeys, { chainId: activeChainId });

  // ─── Unified Balance ──────────────────────────────────────────────────────
  const unified = useUnifiedBalance({
    payments,
    claimAddresses,
    refreshClaimBalances,
    claimAddressesInitialized,
  });

  // ─── Privacy Pool (DustPool) ──────────────────────────────────────────────
  const dustPool = useDustPool(activeChainId);

  const [showConsolidateModal, setShowConsolidateModal] = useState(false);

  const hasPoolBalance = parseFloat(dustPool.poolBalance) > 0;

  // ─── Not connected state ──────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="opacity-40">
            <WalletIcon size={48} color="rgba(255,255,255,0.4)" />
          </div>
          <h1 className="text-2xl font-bold text-white">Connect Your Wallet</h1>
          <p className="text-sm text-[rgba(255,255,255,0.5)]">Connect your wallet to manage deposits and stealth payments</p>
        </div>
      </div>
    );
  }

  // ─── Main layout ──────────────────────────────────────────────────────────

  return (
    <div className="px-3.5 md:px-6 py-4 md:py-7 max-w-[720px] mx-auto flex flex-col gap-5">
      {/* Page header */}
      <div>
        <h1 className="text-[28px] font-bold text-white tracking-tight mb-1">Wallet</h1>
        <p className="text-[13px] text-[rgba(255,255,255,0.5)]">Manage your stealth payments and privacy pool</p>
      </div>

      {/* Privacy Pool balance card */}
      {hasPoolBalance && (
        <div className="p-4 rounded-sm border border-[rgba(129,140,248,0.3)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="opacity-70 text-[#00FF41]">
                <ShieldIcon size={18} />
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">Privacy Pool</p>
                <p className="text-[11px] text-[rgba(255,255,255,0.4)]">
                  {dustPool.deposits.filter((d) => !d.withdrawn).length} deposits ready to withdraw
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <p className="text-lg font-extrabold text-white font-mono">
                {parseFloat(dustPool.poolBalance).toFixed(4)} {nativeSymbol}
              </p>
              <button
                className="px-3 py-1.5 rounded-sm bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41] transition-all text-xs font-bold text-[#00FF41] font-mono cursor-pointer"
                onClick={() => setShowConsolidateModal(true)}
              >
                Withdraw
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Stealth Payments Section ────────────────────────────────────── */}
      <div className="w-full p-5 rounded-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm flex flex-col gap-4">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldIcon size={16} color="#22c55e" />
            <p className="text-[15px] font-bold text-white">Stealth Payments</p>
            <span className="px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)] text-[11px] text-[rgba(255,255,255,0.4)] font-medium">
              {unified.unclaimedCount} unclaimed
            </span>
          </div>
          <button
            className="p-1.5 rounded-full cursor-pointer hover:bg-[rgba(255,255,255,0.06)] transition-all"
            onClick={() => scan()}
          >
            {isScanning
              ? <span className="inline-block w-3.5 h-3.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              : <RefreshIcon size={15} color="rgba(255,255,255,0.4)" />}
          </button>
        </div>

        {/* Payment list */}
        {payments.length === 0 ? (
          <div className="text-center py-10 flex flex-col items-center gap-3">
            <div className="opacity-30">
              <ShieldIcon size={36} color="rgba(255,255,255,0.4)" />
            </div>
            <p className="text-[13px] text-[rgba(255,255,255,0.4)]">No stealth payments yet</p>
            <p className="text-[11px] text-[rgba(255,255,255,0.3)]">Payments received via stealth addresses will appear here</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {unified.unclaimedPayments.map((payment) => {
              const bal = parseFloat(payment.balance || "0");
              const addr = payment.announcement.stealthAddress;
              const txHash = payment.announcement.txHash;

              return (
                <div
                  key={addr}
                  className={`p-3.5 rounded-sm border transition-all
                    ${bal > 0
                      ? "border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.03)]"
                      : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0
                        ${bal > 0 ? "bg-[rgba(34,197,94,0.12)]" : "bg-[rgba(255,255,255,0.06)]"}`}>
                        <ShieldIcon size={16} color={bal > 0 ? "#22c55e" : "rgba(255,255,255,0.4)"} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-white font-mono">
                            {addr.slice(0, 8)}...{addr.slice(-6)}
                          </span>
                          {bal > 0 && (
                            <span className="px-1.5 py-px rounded-full bg-[rgba(34,197,94,0.1)] text-[10px] font-semibold text-green-400">
                              Claimable
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-white font-mono mt-0.5">
                          {bal.toFixed(4)} {nativeSymbol}
                        </p>
                      </div>
                    </div>
                    {txHash && (
                      <a
                        href={`${explorerBase}/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-full inline-flex cursor-pointer hover:bg-[rgba(255,255,255,0.06)] transition-all shrink-0"
                      >
                        <ExternalLinkIcon size={14} color="rgba(255,255,255,0.4)" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info notice */}
        {payments.length > 0 && (
          <div className="p-2.5 px-3 rounded-sm bg-[rgba(34,197,94,0.04)] border border-[rgba(34,197,94,0.12)]">
            <div className="flex items-start gap-2">
              <div className="mt-px shrink-0"><KeyIcon size={13} color="#22c55e" /></div>
              <p className="text-[11px] text-[rgba(255,255,255,0.4)] leading-relaxed">
                Stealth addresses hold tokens from private payments. Private keys are stored
                securely in your browser. Claim via the Dashboard to send funds to your wallet.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Consolidate (Withdraw) Modal ────────────────────────────────── */}
      <ConsolidateModal
        isOpen={showConsolidateModal}
        onClose={() => setShowConsolidateModal(false)}
        deposits={dustPool.deposits}
        poolBalance={dustPool.poolBalance}
        progress={dustPool.progress}
        onConsolidate={dustPool.consolidate}
        onReset={dustPool.resetProgress}
        isConsolidating={dustPool.isConsolidating}
      />
    </div>
  );
}
