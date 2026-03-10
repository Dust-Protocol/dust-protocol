"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import { formatEther, formatUnits, zeroAddress } from "viem";
import { useV2Balance } from "@/hooks/dustpool/v2";
import { useSharedV2Keys } from "@/contexts/V2KeysContext";
import { computeAssetId } from "@/lib/dustpool/v2/commitment";
import { getChainConfig } from "@/config/chains";
import { ShieldIcon, LockIcon, TokenIcon, USDCIcon } from "@/components/stealth/icons";
import { computePrivacyScore } from "@/lib/dustpool/v2/privacy-score";
import { V2DepositModal } from "./V2DepositModal";
import { V2WithdrawModal } from "./V2WithdrawModal";
import { V2TransferModal } from "./V2TransferModal";
import { V2SendModal } from "./V2SendModal";
import { verifyRecoveryCode, hasRecoveryHash, generateRecoveryCode, storeRecoveryHash, clearRecoveryHash } from "@/lib/stealth/recovery";
import { clearStoredPin, encryptPin } from "@/lib/stealth/pin";
import { STEALTH_KEY_DERIVATION_MESSAGE } from "@/lib/stealth/keys";
import { signMessage as signWithWallet } from "@/lib/providers";

interface V2PoolCardProps {
  chainId?: number;
}

type ModalType = "deposit" | "withdraw" | "send" | "transfer" | null;

type RecoveryStep = "idle" | "enter-code" | "new-pin" | "confirm-pin" | "saving";

export function V2PoolCard({ chainId: chainIdOverride }: V2PoolCardProps) {
  const { isConnected, address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const wagmiChainId = useChainId();
  const chainId = chainIdOverride ?? wagmiChainId;
  const { keysRef, hasKeys, hasPin, isDeriving, error: keyError, deriveKeys } = useSharedV2Keys();
  const { balances, totalEthBalance, notes, isLoading, refreshBalances } = useV2Balance(keysRef, chainId);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [pinInput, setPinInput] = useState("");
  const [showPinInput, setShowPinInput] = useState(false);

  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>("idle");
  const [recoveryInput, setRecoveryInput] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

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

  const privacyScore = useMemo(() => computePrivacyScore(notes), [notes]);
  const unspentCount = notes.filter(n => !n.spent).length;
  const pendingCount = notes.filter(n => !n.spent && n.leafIndex === -1).length;
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

  const canShowForgotPin = address && hasPin && hasRecoveryHash(address);

  const handleStartRecovery = () => {
    setShowPinInput(false);
    setPinInput("");
    setRecoveryStep("enter-code");
    setRecoveryInput("");
    setRecoveryError(null);
  };

  const handleVerifyRecoveryCode = () => {
    if (!address) return;
    if (!verifyRecoveryCode(address, recoveryInput)) {
      setRecoveryError("Recovery code does not match");
      return;
    }
    setRecoveryError(null);
    setRecoveryStep("new-pin");
    setNewPin("");
    setConfirmNewPin("");
  };

  const handleNewPinConfirm = async () => {
    if (newPin.length !== 6) {
      setRecoveryError("PIN must be 6 digits");
      return;
    }
    if (newPin !== confirmNewPin) {
      setRecoveryError("PINs do not match");
      setConfirmNewPin("");
      return;
    }
    if (!address || !walletClient) {
      setRecoveryError("Wallet not connected");
      return;
    }

    setRecoveryStep("saving");
    setRecoveryError(null);

    try {
      const sig = await signWithWallet(STEALTH_KEY_DERIVATION_MESSAGE, walletClient);
      const encrypted = await encryptPin(newPin, sig);
      clearStoredPin(address);
      const { storeEncryptedPin } = await import("@/lib/stealth/pin");
      storeEncryptedPin(address, encrypted);

      // Regenerate and store recovery hash for the new PIN
      const code = generateRecoveryCode(sig, newPin);
      clearRecoveryHash(address);
      storeRecoveryHash(address, code);

      // Push account metadata backup to relayer (non-blocking)
      try {
        const { deriveSpendingSeed } = await import('@/lib/stealth/pin');
        const spendingSeedHex = await deriveSpendingSeed(sig, newPin);
        const BN254_ORDER = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
        const spendingKey = BigInt('0x' + spendingSeedHex) % BN254_ORDER;

        if (encrypted) {
          const { pushAccountBackup } = await import('@/lib/dustpool/v2/backup-client');
          pushAccountBackup(
            { encryptedPin: encrypted, recoveryHash: code, keyVersion: 1 },
            spendingKey,
          ).catch(() => {});
        }
      } catch {
        // Backup failure doesn't affect PIN recovery
      }

      setRecoveryStep("idle");
      setRecoveryInput("");
      setNewPin("");
      setConfirmNewPin("");
      setShowPinInput(true);
    } catch (e) {
      setRecoveryError(e instanceof Error ? e.message : "Failed to reset PIN");
      setRecoveryStep("new-pin");
    }
  };

  const handleCancelRecovery = () => {
    setRecoveryStep("idle");
    setRecoveryInput("");
    setNewPin("");
    setConfirmNewPin("");
    setRecoveryError(null);
    setShowPinInput(true);
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
          <ShieldIcon size={14} color="#00FF41" />
          <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">PRIVACY_POOL</span>
        </div>
        <p className="text-[11px] text-[rgba(255,255,255,0.3)] font-mono">Connect wallet to access privacy pool</p>
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
        className="w-full p-6 rounded-sm border border-[rgba(0,255,65,0.12)] bg-[rgba(0,255,65,0.02)] backdrop-blur-sm relative overflow-hidden"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <ShieldIcon size={14} color="#00FF41" />
            <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">PRIVACY_POOL</span>
          </div>
          <div className="flex items-center gap-2">
            {hasKeys && notes.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: privacyScore.color }} />
                <span className="text-[9px] font-mono" style={{ color: privacyScore.color }}>
                  {privacyScore.label}
                </span>
              </div>
            )}
            {isLoading && (
              <div className="w-3 h-3 border-2 border-[#00FF41] border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </div>

        {/* V2 feature highlight */}
        <div className="mb-4 text-[10px] text-[rgba(255,255,255,0.4)] font-mono border-l-2 border-[#00FF41] pl-2">
          Private amounts &middot; Zero-knowledge proofs
        </div>

        {/* Balance */}
        <div className="flex flex-col gap-1.5 mb-5">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-white font-mono tracking-tight">
              {isLoading ? <BalanceSkeleton width="w-28" height="h-7" /> : displayBalance}
            </span>
            <div className="flex items-center gap-1.5">
              <TokenIcon symbol={nativeSymbol} size={16} />
              <span className="text-sm text-[rgba(255,255,255,0.4)] font-mono">{nativeSymbol}</span>
            </div>
            {unspentCount > 0 && (
              <span className="text-[10px] text-[#00FF41] font-mono">
                {unspentCount} deposit{unspentCount !== 1 ? "s" : ""}
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

        {pendingCount > 0 && (
          <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-sm bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.12)]">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] text-amber-400 font-mono">
              {pendingCount} deposit{pendingCount !== 1 ? "s" : ""} confirming...
            </span>
          </div>
        )}

        {/* PIN verification */}
        {!hasKeys && !showPinInput && (
          <button
            onClick={() => setShowPinInput(true)}
            className="mb-4 w-full p-2.5 rounded-sm bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)] hover:border-[rgba(245,158,11,0.3)] hover:bg-[rgba(245,158,11,0.1)] transition-all cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <LockIcon size={12} color="#f59e0b" />
              <span className="text-[11px] text-amber-400 font-mono">
                {hasPin ? "Enter PIN to access your private wallet" : "Set up PIN to access your private wallet"}
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
            {canShowForgotPin && (
              <button
                onClick={handleStartRecovery}
                className="mt-1.5 text-[10px] text-[rgba(255,255,255,0.3)] hover:text-[#00FF41] font-mono transition-colors"
              >
                Forgot PIN?
              </button>
            )}
          </div>
        )}

        {recoveryStep !== "idle" && !hasKeys && (
          <div className="mb-4 p-3 rounded-sm bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)]">
            {recoveryStep === "enter-code" && (
              <>
                <div className="flex items-center gap-2 mb-2.5">
                  <LockIcon size={12} color="#f59e0b" />
                  <span className="text-[11px] text-amber-400 font-mono font-bold">Enter recovery code</span>
                </div>
                <textarea
                  value={recoveryInput}
                  onChange={(e) => setRecoveryInput(e.target.value)}
                  placeholder="Enter your 12-word recovery code..."
                  rows={2}
                  autoFocus
                  className="w-full px-3 py-2 rounded-sm bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] text-white font-mono text-xs focus:outline-none focus:border-amber-400/50 transition-all placeholder-[rgba(255,255,255,0.15)] resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleCancelRecovery}
                    className="flex-1 py-1.5 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.05)] text-[10px] font-bold text-[rgba(255,255,255,0.5)] font-mono transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVerifyRecoveryCode}
                    disabled={recoveryInput.trim().split(/\s+/).length < 12}
                    className="flex-[2] py-1.5 rounded-sm bg-[rgba(245,158,11,0.12)] border border-[rgba(245,158,11,0.3)] hover:bg-[rgba(245,158,11,0.2)] text-[10px] font-bold text-amber-400 font-mono disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    VERIFY
                  </button>
                </div>
              </>
            )}

            {(recoveryStep === "new-pin" || recoveryStep === "confirm-pin") && (
              <>
                <div className="flex items-center gap-2 mb-2.5">
                  <LockIcon size={12} color="#00FF41" />
                  <span className="text-[11px] text-[#00FF41] font-mono font-bold">
                    {recoveryStep === "new-pin" ? "Set new PIN" : "Confirm new PIN"}
                  </span>
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={recoveryStep === "new-pin" ? newPin : confirmNewPin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    if (recoveryStep === "new-pin") {
                      setNewPin(val);
                      if (val.length === 6) {
                        setRecoveryStep("confirm-pin");
                        setConfirmNewPin("");
                        setRecoveryError(null);
                      }
                    } else {
                      setConfirmNewPin(val);
                    }
                  }}
                  placeholder="------"
                  autoFocus
                  className="w-full px-3 py-2 rounded-sm bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] text-white font-mono text-sm text-center tracking-[0.3em] focus:outline-none focus:border-[#00FF41]/50 transition-all placeholder-[rgba(255,255,255,0.15)]"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleCancelRecovery}
                    className="flex-1 py-1.5 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.05)] text-[10px] font-bold text-[rgba(255,255,255,0.5)] font-mono transition-all"
                  >
                    Cancel
                  </button>
                  {recoveryStep === "confirm-pin" && (
                    <button
                      onClick={handleNewPinConfirm}
                      disabled={confirmNewPin.length !== 6}
                      className="flex-[2] py-1.5 rounded-sm bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] hover:bg-[rgba(0,255,65,0.15)] text-[10px] font-bold text-[#00FF41] font-mono disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      RESET PIN
                    </button>
                  )}
                </div>
              </>
            )}

            {recoveryStep === "saving" && (
              <div className="flex items-center gap-2 justify-center py-3">
                <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-[11px] text-amber-400 font-mono">Resetting PIN...</span>
              </div>
            )}

            {recoveryError && (
              <p className="mt-2 text-[10px] text-red-400 font-mono">{recoveryError}</p>
            )}
          </div>
        )}

        {/* Unlocked indicator */}
        {hasKeys && (
          <div className="mb-4 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00FF41]" />
            <span className="text-[10px] text-[#00FF41] font-mono">Keys active</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setActiveModal("withdraw")}
            disabled={!hasKeys || !hasAnyBalance}
            className="py-2.5 px-2 rounded-sm border border-[rgba(255,255,255,0.1)] hover:border-[#00FF41] hover:bg-[rgba(0,255,65,0.05)] transition-all text-xs font-bold text-white hover:text-[#00FF41] font-mono disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[rgba(255,255,255,0.1)] disabled:hover:bg-transparent disabled:hover:text-white"
          >
            [ UNSHIELD ]
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
            className="py-2.5 px-2 rounded-sm border border-[rgba(255,255,255,0.1)] hover:border-[#00FF41] hover:bg-[rgba(0,255,65,0.05)] transition-all text-xs font-bold text-white hover:text-[#00FF41] font-mono disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[rgba(255,255,255,0.1)] disabled:hover:bg-transparent disabled:hover:text-white"
          >
            [ PRIVATE SEND ]
          </button>
        </div>

        <CornerAccents />
      </motion.div>

      {/* Modals */}
      <V2DepositModal
        isOpen={activeModal === "deposit"}
        onClose={handleModalClose}
        onSuccess={refreshBalances}
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
        onSuccess={refreshBalances}
        keysRef={keysRef}
        chainId={chainId}
        balances={balances}
      />
      <V2SendModal
        isOpen={activeModal === "send"}
        onClose={handleModalClose}
        onSuccess={refreshBalances}
        keysRef={keysRef}
        chainId={chainId}
        balances={balances}
      />
      <V2TransferModal
        isOpen={activeModal === "transfer"}
        onClose={handleModalClose}
        onSuccess={refreshBalances}
        keysRef={keysRef}
        chainId={chainId}
        shieldedBalance={totalEthBalance}
      />
    </>
  );
}

function BalanceSkeleton({ width = "w-24", height = "h-7" }: { width?: string; height?: string }) {
  return (
    <div className={`${width} ${height} rounded-sm bg-[rgba(255,255,255,0.06)] animate-pulse`} />
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
