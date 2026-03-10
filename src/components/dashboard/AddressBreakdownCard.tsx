"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { getChainConfig } from "@/config/chains";
import { getExplorerBase } from "@/lib/design/tokens";
import { WalletIcon, ChevronDownIcon, ChevronUpIcon, TokenIcon } from "@/components/stealth/icons";
import type { StealthPayment } from "@/lib/design/types";

interface AddressBreakdownCardProps {
  claimAddresses: Array<{ address: string; label?: string; balance?: string }>;
  unclaimedPayments: StealthPayment[];
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 12)}...${addr.slice(-8)}`;
}

const WALLET_TYPE_LABELS: Record<string, string> = {
  account: "4337",
  create2: "CREATE2",
  eoa: "EOA",
  eip7702: "7702",
};

export function AddressBreakdownCard({ claimAddresses, unclaimedPayments }: AddressBreakdownCardProps) {
  const { activeChainId } = useAuth();
  const explorerBase = getExplorerBase(activeChainId);
  const symbol = getChainConfig(activeChainId).nativeCurrency.symbol;
  const [expanded, setExpanded] = useState(false);

  const hasClaimAddresses = claimAddresses.length > 0;
  const hasUnclaimed = unclaimedPayments.length > 0;

  if (!hasClaimAddresses && !hasUnclaimed) return null;

  const summaryParts: string[] = [];
  if (hasClaimAddresses) summaryParts.push(`${claimAddresses.length} wallet${claimAddresses.length !== 1 ? "s" : ""}`);
  if (hasUnclaimed) summaryParts.push(`${unclaimedPayments.length} stealth`);

  const totalActive = claimAddresses.length + unclaimedPayments.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="w-full p-6 rounded-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm relative overflow-hidden"
    >
      {/* Header — always visible, toggles expand */}
      <button
        className="w-full flex justify-between items-center mb-0"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[rgba(255,255,255,0.05)] flex items-center justify-center">
            <WalletIcon size={14} color="rgba(255,255,255,0.4)" />
          </div>
          <div className="text-left">
            <p className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
              CLAIM_ADDRESSES
            </p>
            {!expanded && (
              <p className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono mt-0.5">
                {summaryParts.join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-1.5 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)]">
            <span className="text-[9px] text-[rgba(255,255,255,0.6)] font-mono">
              {totalActive} active
            </span>
          </div>
          {expanded
            ? <ChevronUpIcon size={16} color="rgba(255,255,255,0.4)" />
            : <ChevronDownIcon size={16} color="rgba(255,255,255,0.4)" />
          }
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 flex flex-col gap-0">
          {/* Claim wallets section */}
          {hasClaimAddresses && (
            <>
              <p className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider font-mono font-semibold mb-1.5">
                Claim Wallets
              </p>
              <div className="flex flex-col">
                {claimAddresses.map((addr, idx) => (
                  <div
                    key={addr.address}
                    className={`flex justify-between items-center py-2 ${
                      idx < claimAddresses.length - 1 || hasUnclaimed
                        ? "border-b border-[rgba(255,255,255,0.05)]"
                        : ""
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-white font-mono">
                        {addr.label || `Wallet ${idx + 1}`}
                      </span>
                      <a
                        href={`${explorerBase}/address/${addr.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-[rgba(255,255,255,0.4)] hover:text-[#00FF41] transition-colors no-underline"
                      >
                        {truncateAddress(addr.address)}
                      </a>
                    </div>
                    <span className="text-xs font-medium text-[#00FF41] font-mono flex items-center gap-1">
                      {parseFloat(addr.balance || "0").toFixed(4)} <TokenIcon symbol={symbol} size={12} /> {symbol}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Unclaimed stealth section */}
          {hasUnclaimed && (
            <>
              <p className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider font-mono font-semibold mt-3 mb-1.5">
                Unclaimed Stealth
              </p>
              <div className="flex flex-col gap-1">
                {unclaimedPayments.map((p, idx) => (
                  <div
                    key={p.announcement.stealthAddress}
                    className={`flex justify-between items-center py-2 hover:bg-[rgba(255,255,255,0.02)] rounded-sm transition-colors px-1 -mx-1 ${
                      idx < unclaimedPayments.length - 1
                        ? "border-b border-[rgba(255,255,255,0.05)]"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#FFB000]" />
                      <div className="flex flex-col gap-0.5">
                        <a
                          href={`${explorerBase}/address/${p.announcement.stealthAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-[rgba(255,255,255,0.7)] hover:text-white font-mono transition-colors no-underline"
                        >
                          {truncateAddress(p.announcement.stealthAddress)}
                        </a>
                      </div>
                      {p.walletType && (
                        <span className="px-1 py-0.5 rounded-sm bg-[rgba(255,255,255,0.05)] text-[9px] font-semibold text-[rgba(255,255,255,0.4)] font-mono tracking-wide">
                          {WALLET_TYPE_LABELS[p.walletType] || p.walletType}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-[#00FF41] font-mono flex items-center gap-1">
                      {parseFloat(p.balance || "0").toFixed(4)} <TokenIcon symbol={symbol} size={12} /> {symbol}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[rgba(255,255,255,0.1)] rounded-tl-sm" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[rgba(255,255,255,0.1)] rounded-tr-sm" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[rgba(255,255,255,0.1)] rounded-bl-sm" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[rgba(255,255,255,0.1)] rounded-br-sm" />
    </motion.div>
  );
}
