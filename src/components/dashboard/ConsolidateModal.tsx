"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getChainConfig } from "@/config/chains";
import { useAuth } from "@/contexts/AuthContext";
import type { ConsolidateProgress } from "@/hooks/stealth/useDustPool";
import type { StoredDeposit } from "@/lib/dustpool";
import { ethers } from "ethers";
import { XIcon } from "@/components/stealth/icons";

interface ConsolidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  deposits: StoredDeposit[];
  poolBalance: string;
  progress: ConsolidateProgress;
  onConsolidate: (recipient: string) => void;
  onReset: () => void;
  isConsolidating: boolean;
}

export function ConsolidateModal({
  isOpen,
  onClose,
  deposits,
  poolBalance,
  progress,
  onConsolidate,
  onReset,
  isConsolidating,
}: ConsolidateModalProps) {
  const { activeChainId } = useAuth();
  const symbol = getChainConfig(activeChainId).nativeCurrency.symbol;
  const [recipient, setRecipient] = useState("");

  const unwithdrawable = deposits.filter(d => !d.withdrawn);
  const isValidRecipient = ethers.utils.isAddress(recipient);
  const canConsolidate = isValidRecipient && unwithdrawable.length > 0 && !isConsolidating;

  const handleClose = () => {
    if (!isConsolidating) {
      onReset();
      onClose();
    }
  };

  const progressPercent = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="relative w-full max-w-[440px] p-6 rounded-md border border-[rgba(255,255,255,0.1)] bg-[#06080F] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white font-mono tracking-wider">
                  [ WITHDRAW ]
                </span>
              </div>
              {!isConsolidating && (
                <button
                  onClick={handleClose}
                  className="text-[rgba(255,255,255,0.4)] hover:text-white transition-colors"
                >
                  <XIcon size={20} />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4">
              {/* Pool balance */}
              <div className="p-4 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)]">
                <p className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono mb-1">
                  Pool Balance
                </p>
                <p className="text-2xl font-extrabold text-white font-mono">
                  {parseFloat(poolBalance).toFixed(6)}{" "}
                  <span className="text-base font-semibold text-[rgba(255,255,255,0.5)]">{symbol}</span>
                </p>
                <p className="text-xs text-[rgba(255,255,255,0.4)] font-mono mt-1">
                  {unwithdrawable.length} deposit{unwithdrawable.length !== 1 ? "s" : ""} in pool
                </p>
              </div>

              {/* Deposit list */}
              {unwithdrawable.length > 0 && (
                <div className="flex flex-col gap-1.5 max-h-[150px] overflow-y-auto">
                  <p className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
                    Selected Deposits
                  </p>
                  {unwithdrawable.map((d, i) => (
                    <div
                      key={d.commitment}
                      className="flex justify-between items-center p-2 rounded-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]"
                    >
                      <span className="text-xs text-[rgba(255,255,255,0.6)] font-mono">
                        Deposit #{i + 1}
                      </span>
                      <span className="text-xs font-semibold text-[#00FF41] font-mono">
                        {parseFloat(ethers.utils.formatEther(d.amount)).toFixed(6)} {symbol}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recipient input — only shown when idle */}
              {progress.phase === "idle" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
                      Destination Address
                    </label>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={recipient}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipient(e.target.value)}
                      className="w-full p-3 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-white font-mono text-sm focus:outline-none focus:border-[#00FF41] focus:bg-[rgba(0,255,65,0.02)] transition-all placeholder-[rgba(255,255,255,0.2)]"
                    />
                    <p className="text-[11px] text-[rgba(255,255,255,0.3)] font-mono">
                      Use a fresh address with no on-chain history for maximum privacy
                    </p>
                  </div>

                  <button
                    onClick={() => canConsolidate && onConsolidate(recipient)}
                    disabled={!canConsolidate}
                    className="w-full py-3 rounded-sm bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41] hover:shadow-[0_0_15px_rgba(0,255,65,0.15)] transition-all text-sm font-bold text-[#00FF41] font-mono tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    [ WITHDRAW_ALL_ZK ]
                  </button>
                </>
              )}

              {/* Progress bar — shown while proving/submitting/loading */}
              {(progress.phase === "loading" || progress.phase === "proving" || progress.phase === "submitting") && (
                <div className="flex flex-col gap-2">
                  <div className="h-1.5 w-full bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-[#00FF41] rounded-full"
                      style={{ width: `${progressPercent}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-xs text-[rgba(255,255,255,0.5)] font-mono text-center">
                    {progress.message}
                  </p>
                </div>
              )}

              {/* Done state */}
              {progress.phase === "done" && (
                <div className="p-3 rounded-sm bg-[rgba(0,255,65,0.04)] border border-[rgba(0,255,65,0.15)]">
                  <p className="text-sm font-semibold text-[#00FF41] font-mono text-center">
                    {progress.message}
                  </p>
                </div>
              )}

              {/* Error state */}
              {progress.phase === "error" && (
                <div className="p-3 rounded-sm bg-[rgba(239,68,68,0.04)] border border-[rgba(239,68,68,0.15)]">
                  <p className="text-sm font-semibold text-red-400 font-mono text-center">
                    {progress.message}
                  </p>
                </div>
              )}
            </div>

            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[rgba(255,255,255,0.1)]" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[rgba(255,255,255,0.1)]" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[rgba(255,255,255,0.1)]" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[rgba(255,255,255,0.1)]" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
