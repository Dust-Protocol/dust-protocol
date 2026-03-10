"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useAccount, useChainId } from "wagmi";
import { formatEther, formatUnits, zeroAddress } from "viem";
import { useV2Balance, useV2Keys } from "@/hooks/dustpool/v2";
import { computeAssetId } from "@/lib/dustpool/v2/commitment";
import { getChainConfig } from "@/config/chains";
import { ShieldIcon, LockIcon, TokenIcon, USDCIcon } from "@/components/stealth/icons";
import { V2DepositModal } from "./V2DepositModal";
import { V2WithdrawModal } from "./V2WithdrawModal";
import { V2TransferModal } from "./V2TransferModal";
import { V2SendModal } from "./V2SendModal";

interface V2PoolCardProps {
  chainId?: number;
}

type ModalType = "deposit" | "withdraw" | "send" | "transfer" | null;

export function V2PoolCard({ chainId: chainIdOverride }: V2PoolCardProps) {
  const { isConnected } = useAccount();
  const wagmiChainId = useChainId();
  const chainId = chainIdOverride ?? wagmiChainId;
  const { keysRef, hasKeys, hasPin, isDeriving, error: keyError, deriveKeys } = useV2Keys();
  const { balances, totalEthBalance, notes, isLoading, refreshBalances } = useV2Balance(keysRef, chainId);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [pinInput, setPinInput] = useState("");
  const [showPinInput, setShowPinInput] = useState(false);

  // Resolve USDC assetId for this chain to display secondary balance
  const [usdcAssetId, setUsdcAssetId] = useState<bigint | null>(null);
  const usdcAddress = useMemo(() => {
    try {
      return getChainConfig(chainId).contracts.dustSwapVanillaPoolKey?.currency1 ?? null;
    } catch {
      return null;
    }
  }, [chainId]);

  useEffect(() => {
    if (!usdcAddress) { setUsdcAssetId(null); return; }
    let cancelled = false;
    computeAssetId(chainId, usdcAddress).then(id => { if (!cancelled) setUsdcAssetId(id); });
    return () => { cancelled = true; };
  }, [chainId, usdcAddress]);

  const nativeSymbol = getChainConfig(chainId).nativeCurrency.symbol;
  const usdcBalance = usdcAssetId !== null ? (balances.get(usdcAssetId) ?? 0n) : 0n;
  const hasAnyBalance = balances.size > 0 && Array.from(balances.values()).some(v => v > 0n);

  const unspentCount = notes.filter(n => !n.spent).length;
  const formattedBalance = formatEther(totalEthBalance);
  const displayBalance = parseFloat(formattedBalance).toFixed(4);

  const handleModalClose = () => {
    setActiveModal(null);
    refreshBalances();
  };

  const handlePinSubmit = async () => {
    const ok = await deriveKeys(pinInput);
    if (ok) {
      setPinInput("");
      setShowPinInput(false);
      refreshBalances();
    }
  };

  const handlePinKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && pinInput.length === 6) {
      handlePinSubmit();
    }
  };

  if (!isConnected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="w-full p-6 rounded-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm relative overflow-hidden"
      >
        <div className="flex items-center gap-2 mb-3">
          <ShieldIcon size={14} color="#00EF8B" />
          <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">PRIVACY_POOL_V2</span>
          <span className="px-1.5 py-0.5 rounded-sm bg-[rgba(0,239,139,0.15)] text-[9px] text-[#00EF8B] font-mono font-bold">V2</span>
        </div>
        <p className="text-[11px] text-[rgba(255,255,255,0.3)] font-mono">Connect wallet to access V2 privacy pool</p>
        <CornerAccents />
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="w-full p-6 rounded-sm border border-[rgba(0,239,139,0.12)] bg-[rgba(0,239,139,0.02)] backdrop-blur-sm relative overflow-hidden"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <ShieldIcon size={14} color="#00EF8B" />
            <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">PRIVACY_POOL_V2</span>
            <span className="px-1.5 py-0.5 rounded-sm bg-[rgba(0,239,139,0.15)] text-[9px] text-[#00EF8B] font-mono font-bold">V2</span>
          </div>
          {isLoading && (
            <div className="w-3 h-3 border-2 border-[#00EF8B] border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* V2 feature highlight */}
        <div className="mb-4 text-[10px] text-[rgba(255,255,255,0.4)] font-mono border-l-2 border-[#00EF8B] pl-2">
          Arbitrary amounts &middot; UTXO model &middot; FFLONK proofs
        </div>

        {/* Balance */}
        <div className="flex flex-col gap-1.5 mb-5">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-white font-mono tracking-tight">
              {isLoading ? "-.----" : displayBalance}
            </span>
            <div className="flex items-center gap-1.5">
              <TokenIcon symbol={nativeSymbol} size={16} />
              <span className="text-sm text-[rgba(255,255,255,0.4)] font-mono">{nativeSymbol}</span>
            </div>
            {unspentCount > 0 && (
              <span className="text-[10px] text-[#00EF8B] font-mono">
                {unspentCount} note{unspentCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {usdcBalance > 0n && (
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-white font-mono tracking-tight">
                {parseFloat(formatUnits(usdcBalance, 6)).toFixed(2)}
              </span>
              <div className="flex items-center gap-1">
                <USDCIcon size={14} />
                <span className="text-xs text-[rgba(255,255,255,0.4)] font-mono">USDC</span>
              </div>
            </div>
          )}
        </div>

        {/* PIN verification */}
        {!hasKeys && !showPinInput && (
          <button
            onClick={() => setShowPinInput(true)}
            className="mb-4 w-full p-2.5 rounded-sm bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)] hover:border-[rgba(245,158,11,0.3)] hover:bg-[rgba(245,158,11,0.1)] transition-all cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <LockIcon size={12} color="#f59e0b" />
              <span className="text-[11px] text-amber-400 font-mono">
                {hasPin ? "Enter PIN to unlock V2 pool" : "Set up PIN to use V2 pool"}
              </span>
            </div>
          </button>
        )}

        {!hasKeys && showPinInput && (
          <div className="mb-4 p-3 rounded-sm bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)]">
            <div className="flex items-center gap-2 mb-2.5">
              <LockIcon size={12} color="#f59e0b" />
              <span className="text-[11px] text-amber-400 font-mono font-bold">Enter 6-digit PIN</span>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={handlePinKeyDown}
                placeholder="------"
                autoFocus
                className="flex-1 px-3 py-2 rounded-sm bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] text-white font-mono text-sm text-center tracking-[0.3em] focus:outline-none focus:border-amber-400/50 transition-all placeholder-[rgba(255,255,255,0.15)]"
              />
              <button
                onClick={handlePinSubmit}
                disabled={pinInput.length !== 6 || isDeriving}
                className="px-4 py-2 rounded-sm bg-[rgba(245,158,11,0.12)] border border-[rgba(245,158,11,0.3)] hover:bg-[rgba(245,158,11,0.2)] text-xs font-bold text-amber-400 font-mono disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {isDeriving ? (
                  <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  "UNLOCK"
                )}
              </button>
            </div>
            {keyError && (
              <p className="mt-2 text-[10px] text-red-400 font-mono">{keyError}</p>
            )}
          </div>
        )}

        {/* Unlocked indicator */}
        {hasKeys && (
          <div className="mb-4 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00EF8B]" />
            <span className="text-[10px] text-[#00EF8B] font-mono">V2 keys active</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => setActiveModal("deposit")}
            disabled={!hasKeys}
            className="py-2.5 px-2 rounded-sm border border-[rgba(0,239,139,0.2)] hover:border-[#00EF8B] hover:bg-[rgba(0,239,139,0.08)] transition-all text-xs font-bold text-[#00EF8B] font-mono disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[rgba(0,239,139,0.2)] disabled:hover:bg-transparent"
          >
            [ DEPOSIT ]
          </button>
          <button
            onClick={() => setActiveModal("withdraw")}
            disabled={!hasKeys || !hasAnyBalance}
            className="py-2.5 px-2 rounded-sm border border-[rgba(255,255,255,0.1)] hover:border-[#00EF8B] hover:bg-[rgba(0,239,139,0.05)] transition-all text-xs font-bold text-white hover:text-[#00EF8B] font-mono disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[rgba(255,255,255,0.1)] disabled:hover:bg-transparent disabled:hover:text-white"
          >
            [ WITHDRAW ]
          </button>
          <button
            onClick={() => setActiveModal("send")}
            disabled={!hasKeys || !hasAnyBalance}
            className="py-2.5 px-2 rounded-sm border border-[rgba(124,127,255,0.2)] hover:border-[#7c7fff] hover:bg-[rgba(124,127,255,0.08)] transition-all text-xs font-bold text-[#7c7fff] hover:text-white font-mono disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[rgba(124,127,255,0.2)] disabled:hover:bg-transparent disabled:hover:text-[#7c7fff]"
          >
            [ SEND ]
          </button>
          <button
            onClick={() => setActiveModal("transfer")}
            disabled={!hasKeys || !hasAnyBalance}
            className="py-2.5 px-2 rounded-sm border border-[rgba(255,255,255,0.1)] hover:border-[#00EF8B] hover:bg-[rgba(0,239,139,0.05)] transition-all text-xs font-bold text-white hover:text-[#00EF8B] font-mono disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[rgba(255,255,255,0.1)] disabled:hover:bg-transparent disabled:hover:text-white"
          >
            [ TRANSFER ]
          </button>
        </div>

        <CornerAccents />
      </motion.div>

      {/* Modals */}
      <V2DepositModal
        isOpen={activeModal === "deposit"}
        onClose={handleModalClose}
        keysRef={keysRef}
        chainId={chainId}
        hasKeys={hasKeys}
        hasPin={hasPin}
        onDeriveKeys={deriveKeys}
        isDeriving={isDeriving}
        keyError={keyError}
      />
      <V2WithdrawModal
        isOpen={activeModal === "withdraw"}
        onClose={handleModalClose}
        keysRef={keysRef}
        chainId={chainId}
        balances={balances}
      />
      <V2SendModal
        isOpen={activeModal === "send"}
        onClose={handleModalClose}
        keysRef={keysRef}
        chainId={chainId}
        balances={balances}
      />
      <V2TransferModal
        isOpen={activeModal === "transfer"}
        onClose={handleModalClose}
        keysRef={keysRef}
        chainId={chainId}
        shieldedBalance={totalEthBalance}
      />
    </>
  );
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
