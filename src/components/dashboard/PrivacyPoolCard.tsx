"use client";

import { motion } from "framer-motion";
import { ShieldIcon } from "lucide-react";

interface PrivacyPoolCardProps {
  claimToPool: boolean;
  onToggle: () => void;
  poolBalance: string;
  depositCount: number;
  poolEligibleCount: number;
  isDepositing: boolean;
  depositProgress: { done: number; total: number; message: string };
  onWithdraw: () => void;
  onDepositAll: () => void;
  symbol: string;
}

export function PrivacyPoolCard({
  claimToPool, onToggle, poolBalance, depositCount,
  poolEligibleCount, isDepositing, depositProgress,
  onWithdraw, onDepositAll, symbol,
}: PrivacyPoolCardProps) {
  const hasPoolBalance = parseFloat(poolBalance) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="w-full p-6 rounded-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm relative overflow-hidden"
    >
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <ShieldIcon className="w-3.5 h-3.5 text-[#00FF41]" />
          <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">PRIVACY_POOL</span>
          <span className="px-1.5 py-0.5 rounded-sm bg-[rgba(255,255,255,0.08)] text-[9px] text-[rgba(255,255,255,0.4)] font-mono">Legacy</span>
        </div>
        <button
          onClick={onToggle}
          className={`w-10 h-5 rounded-full relative transition-colors ${claimToPool ? 'bg-[rgba(0,255,65,0.3)]' : 'bg-[rgba(255,255,255,0.1)]'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${claimToPool ? 'left-5' : 'left-0.5'}`} />
        </button>
      </div>

      {claimToPool && (
        <div className="mb-4 text-[10px] text-[rgba(255,255,255,0.4)] font-mono border-l-2 border-[#00FF41] pl-2">
          Auto-routing enabled — payments held for batch deposit
        </div>
      )}

      {hasPoolBalance && (
        <div className="flex items-baseline gap-3 mb-6">
          <span className="text-2xl font-bold text-white font-mono tracking-tight">
            {parseFloat(poolBalance).toFixed(4)} {symbol}
          </span>
          <span className="text-[10px] text-[#00FF41] font-mono">
            {depositCount} deposit{depositCount !== 1 ? 's' : ''} ready
          </span>
        </div>
      )}

      {isDepositing && (
        <div className="mb-4">
          <p className="text-[11px] text-[#00FF41] font-mono mb-2">{depositProgress.message || 'Depositing...'}</p>
          {depositProgress.total > 0 && (
            <div className="h-1 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#00FF41] rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, (depositProgress.done / depositProgress.total) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className={`grid gap-3 ${hasPoolBalance ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {hasPoolBalance && (
          <button
            onClick={onWithdraw}
            className="py-2 px-3 rounded-sm border border-[rgba(0,255,65,0.2)] hover:border-[#00FF41] hover:bg-[rgba(0,255,65,0.08)] transition-all text-xs font-bold text-[#00FF41] font-mono"
          >
            [ WITHDRAW ]
          </button>
        )}
        {claimToPool && poolEligibleCount > 0 && !isDepositing && (
          <button
            onClick={onDepositAll}
            className="py-2 px-3 rounded-sm border border-[rgba(255,255,255,0.1)] hover:border-[#00FF41] hover:bg-[rgba(0,255,65,0.05)] transition-all text-xs font-bold text-white hover:text-[#00FF41] font-mono"
          >
            [ DEPOSIT {poolEligibleCount} ]
          </button>
        )}
        {claimToPool && poolEligibleCount === 0 && !hasPoolBalance && !isDepositing && (
          <p className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono text-center py-2">
            No eligible payments yet
          </p>
        )}
        {!claimToPool && !hasPoolBalance && (
          <p className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono text-center py-2">
            Enable toggle to route payments to privacy pool
          </p>
        )}
      </div>

      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[rgba(255,255,255,0.1)] rounded-tl-sm" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[rgba(255,255,255,0.1)] rounded-tr-sm" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[rgba(255,255,255,0.1)] rounded-bl-sm" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[rgba(255,255,255,0.1)] rounded-br-sm" />
    </motion.div>
  );
}
