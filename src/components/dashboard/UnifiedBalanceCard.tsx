"use client";

import { motion } from "framer-motion";
import { RefreshCwIcon, EyeOffIcon, CheckIcon } from "lucide-react";
import { getChainConfig } from "@/config/chains";
import { useAuth } from "@/contexts/AuthContext";
import { TokenIcon } from "@/components/stealth/icons";

interface UnifiedBalanceCardProps {
  total: number;
  stealthTotal: number;
  claimTotal: number;
  unclaimedCount: number;
  isScanning: boolean;
  isLoading: boolean;
  onRefresh: () => void;
}

export function UnifiedBalanceCard({
  total,
  stealthTotal,
  claimTotal,
  unclaimedCount,
  isScanning,
  isLoading,
  onRefresh,
}: UnifiedBalanceCardProps) {
  const { activeChainId } = useAuth();
  const chainConfig = getChainConfig(activeChainId);
  const symbol = chainConfig.nativeCurrency.symbol;
  const loading = isScanning || isLoading;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full p-6 rounded-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm relative overflow-hidden group"
    >
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-[#00EF8B] shadow-[0_0_4px_#00EF8B]"
          />
          <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
            BALANCE_OVERVIEW
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="text-[rgba(255,255,255,0.4)] hover:text-[#00EF8B] transition-colors"
        >
          <RefreshCwIcon className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white font-mono tracking-tight mb-1 flex items-center gap-2">
          {total.toFixed(4)} <span className="flex items-center gap-1"><TokenIcon symbol={symbol} size={20} />{symbol}</span>
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 rounded-sm border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.01)]">
          <div className="flex items-center gap-1.5 mb-1">
            <EyeOffIcon className="w-3 h-3 text-[rgba(255,255,255,0.4)]" />
            <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
              Stealth
            </span>
          </div>
          <span className="text-sm font-bold text-white font-mono flex items-center gap-1">
            {stealthTotal.toFixed(4)} <TokenIcon symbol={symbol} size={14} /> {symbol}
          </span>
        </div>
        <div className="p-3 rounded-sm border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.01)]">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckIcon className="w-3 h-3 text-[rgba(255,255,255,0.4)]" />
            <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
              Claimed
            </span>
          </div>
          <span className="text-sm font-bold text-white font-mono flex items-center gap-1">
            {claimTotal.toFixed(4)} <TokenIcon symbol={symbol} size={14} /> {symbol}
          </span>
        </div>
      </div>

      {unclaimedCount > 0 && (
        <div className="flex justify-center">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(255,176,0,0.1)] border border-[rgba(255,176,0,0.2)]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FFB000] animate-pulse" />
            <span className="text-[9px] text-[#FFB000] font-mono tracking-wide">
              {unclaimedCount} unclaimed payment{unclaimedCount !== 1 ? "s" : ""}
            </span>
          </div>
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
