"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useChainId } from "wagmi";
import { parseEther } from "viem";
import { useConfidentialPool } from "@/hooks/dustpool/v2/useConfidentialPool";
import { getChainConfig } from "@/config/chains";
import { ShieldIcon, LockIcon } from "@/components/stealth/icons";

type Tab = "deposit" | "withdraw";
type ComplianceStatus = "unknown" | "checking" | "passed" | "failed";

interface ConfidentialPoolCardProps {
  chainId?: number;
}

export function ConfidentialPoolCard({ chainId: chainIdOverride }: ConfidentialPoolCardProps) {
  const { isConnected } = useAccount();
  const wagmiChainId = useChainId();
  const chainId = chainIdOverride ?? wagmiChainId;

  const [tab, setTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");

  let hasConfidentialPool = false;
  try {
    hasConfidentialPool = !!getChainConfig(chainId).contracts.confidentialDustPool;
  } catch {
    hasConfidentialPool = false;
  }

  const {
    deposit,
    requestWithdrawal,
    checkCompliance,
    refreshPoolInfo,
    complianceStatus,
    balanceHandle,
    depositorCount,
    isPoolPaused,
    isPending,
    txHash,
    error,
  } = useConfidentialPool(chainId);

  const compliancePassed = complianceStatus === ("passed" as ComplianceStatus);
  const isActive = !isPoolPaused;

  useEffect(() => {
    if (hasConfidentialPool) refreshPoolInfo();
  }, [hasConfidentialPool, refreshPoolInfo]);

  if (!hasConfidentialPool) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="relative w-full p-6 bg-black border border-[rgba(255,255,255,0.06)] rounded-lg overflow-hidden"
      >
        <CornerAccents />
        <p className="text-[11px] text-[rgba(255,255,255,0.3)] font-mono text-center">
          Switch to Ethereum Sepolia for confidential pool access
        </p>
      </motion.div>
    );
  }

  if (!isConnected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="relative w-full p-6 bg-black border border-[rgba(255,255,255,0.06)] rounded-lg overflow-hidden"
      >
        <CornerAccents />
        <p className="text-[11px] text-[rgba(255,255,255,0.3)] font-mono text-center">
          Connect wallet to access confidential pool
        </p>
      </motion.div>
    );
  }

  const handleDeposit = async () => {
    if (!amount) return;
    await deposit(amount);
    setAmount("");
  };

  const handleWithdraw = async () => {
    if (!amount) return;
    await requestWithdrawal(parseEther(amount));
    setAmount("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="relative w-full p-6 bg-[rgba(0,255,65,0.02)] border border-[rgba(0,255,65,0.12)] rounded-lg overflow-hidden"
    >
      <CornerAccents />

      {/* Header */}
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <ShieldIcon size={14} color="#00FF41" />
          <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
            CONFIDENTIAL_POOL
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-[#00FF41]" : "bg-red-400"}`} />
          <span className="text-[9px] font-mono text-[rgba(255,255,255,0.4)]">
            {isActive ? "Active" : "Paused"}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-[rgba(255,255,255,0.35)] font-mono mb-4 border-l-2 border-[#00FF41] pl-2">
        FHE-Encrypted Privacy Pool &middot; Zama Protocol
      </p>

      {/* Pool Stats */}
      <div className="flex gap-4 mb-4">
        <div>
          <span className="text-[9px] text-[rgba(255,255,255,0.3)] font-mono uppercase">Depositors</span>
          <p className="text-sm text-white font-mono font-bold">{depositorCount.toString()}</p>
        </div>
      </div>

      {/* Balance */}
      <div className="mb-4 p-3 rounded-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
        <span className="text-[9px] text-[rgba(255,255,255,0.3)] font-mono uppercase tracking-wider">
          Your Balance
        </span>
        <div className="flex items-baseline gap-2 mt-1">
          {balanceHandle && balanceHandle !== "0x" + "0".repeat(64) ? (
            <div className="flex items-center gap-2">
              <LockIcon size={12} color="#00FF41" />
              <span className="text-[11px] text-[#00FF41] font-mono">
                {balanceHandle.slice(0, 10)}...{balanceHandle.slice(-6)}
              </span>
              <span className="text-[9px] text-[rgba(255,255,255,0.3)] font-mono">(euint64 handle)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <LockIcon size={12} color="rgba(255,255,255,0.3)" />
              <span className="text-[11px] text-[rgba(255,255,255,0.3)] font-mono">No deposits yet</span>
            </div>
          )}
        </div>
        <p className="text-[9px] text-[rgba(255,255,255,0.2)] font-mono mt-1">
          Balance is FHE-encrypted on-chain -- only you can decrypt via KMS
        </p>
      </div>

      {/* Compliance */}
      <div className="mb-4 p-3 rounded-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] text-[rgba(255,255,255,0.3)] font-mono uppercase tracking-wider">
            Compliance
          </span>
          <ComplianceBadge status={complianceStatus} />
        </div>
        <p className="text-[9px] text-[rgba(255,255,255,0.25)] font-mono mb-2">
          Encrypted sanctions screening via FHE -- your address is never revealed on-chain
        </p>
        {complianceStatus === "unknown" && (
          <button
            onClick={checkCompliance}
            className="w-full py-2 text-[10px] font-mono font-bold tracking-wider uppercase
              bg-[rgba(0,255,65,0.08)] text-[#00FF41] border border-[rgba(0,255,65,0.2)]
              rounded hover:bg-[rgba(0,255,65,0.12)] transition-all"
          >
            Check Compliance
          </button>
        )}
        {complianceStatus === "checking" && (
          <div className="flex items-center gap-2 justify-center py-2">
            <div className="w-3 h-3 border-2 border-[#00FF41] border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] text-[#00FF41] font-mono">Verifying...</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        {(["deposit", "withdraw"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setAmount(""); }}
            className={`flex-1 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-sm transition-all ${
              tab === t
                ? "bg-[rgba(0,255,65,0.08)] text-[#00FF41] border border-[rgba(0,255,65,0.2)]"
                : "bg-transparent text-[rgba(255,255,255,0.3)] border border-[rgba(255,255,255,0.06)] hover:text-[rgba(255,255,255,0.5)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 mb-3 rounded-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
        <span className="text-[9px] text-[rgba(255,255,255,0.3)] font-mono uppercase">Amount (ETH)</span>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          className="w-full bg-transparent text-white text-2xl font-mono font-bold
            outline-none placeholder:text-[rgba(255,255,255,0.15)] mt-1"
        />
      </div>

      {/* Action */}
      <AnimatePresence mode="wait">
        {tab === "deposit" ? (
          <motion.div key="deposit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button
              onClick={handleDeposit}
              disabled={isPending || !compliancePassed || !amount}
              className="w-full py-2.5 text-[10px] font-mono font-bold tracking-wider uppercase
                bg-[rgba(0,255,65,0.08)] text-[#00FF41] border border-[rgba(0,255,65,0.2)]
                rounded hover:bg-[rgba(0,255,65,0.12)] transition-all
                disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isPending ? "Processing..." : "Deposit ETH"}
            </button>
          </motion.div>
        ) : (
          <motion.div key="withdraw" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="text-[9px] text-amber-400 font-mono mb-2">
              Withdrawal amount is encrypted. KMS decrypts and relayer executes.
            </p>
            <button
              onClick={handleWithdraw}
              disabled={isPending || !compliancePassed || !amount}
              className="w-full py-2.5 text-[10px] font-mono font-bold tracking-wider uppercase
                bg-[rgba(0,255,65,0.08)] text-[#00FF41] border border-[rgba(0,255,65,0.2)]
                rounded hover:bg-[rgba(0,255,65,0.12)] transition-all
                disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isPending ? "Processing..." : "Request Withdrawal"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="mt-3 p-2 bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.15)] rounded">
          <p className="text-[10px] text-red-400 font-mono">{error}</p>
        </div>
      )}

      {/* Tx Link */}
      {txHash && (
        <div className="mt-2">
          <a
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[#00FF41] font-mono underline"
          >
            View on Etherscan
          </a>
        </div>
      )}

      {/* FHE Badge */}
      <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.04)]">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-1 h-1 rounded-full bg-[#00FF41]" />
          <span className="text-[9px] text-[rgba(255,255,255,0.3)] font-mono uppercase tracking-wider">
            Powered by Zama fhEVM
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {[
            "Encrypted Balances (euint64)",
            "Encrypted Compliance (eaddress + ebool)",
            "Encrypted Pool Stats (euint128)",
            "Selective Disclosure via ACL",
          ].map((item) => (
            <span key={item} className="text-[8px] text-[rgba(255,255,255,0.2)] font-mono">
              {item}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  switch (status) {
    case "passed":
      return (
        <span className="text-[9px] font-mono text-[#00FF41] flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#00FF41" strokeWidth="1.5" /></svg>
          Passed
        </span>
      );
    case "failed":
      return (
        <span className="text-[9px] font-mono text-red-400 flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="#f87171" strokeWidth="1.5" /></svg>
          Failed
        </span>
      );
    case "checking":
      return <span className="text-[9px] font-mono text-amber-400">Checking...</span>;
    default:
      return <span className="text-[9px] font-mono text-[rgba(255,255,255,0.3)]">Unknown</span>;
  }
}

function CornerAccents() {
  return (
    <>
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[rgba(255,255,255,0.1)] rounded-tl-sm" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[rgba(255,255,255,0.1)] rounded-tr-sm" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[rgba(255,255,255,0.1)] rounded-bl-sm" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[rgba(255,255,255,0.1)] rounded-br-sm" />
    </>
  );
}
