"use client";

import { useState, useEffect, useCallback, useMemo, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { parseEther, formatEther, parseUnits, formatUnits, zeroAddress, publicActions, type Address } from "viem";
import { useAccount, useBalance, usePublicClient, useWalletClient } from "wagmi";
import { QRCodeSVG } from "qrcode.react";
import { useV2Deposit, useV2Compliance, useExternalDeposit } from "@/hooks/dustpool/v2";
import {
  ShieldIcon,
  ShieldCheckIcon,
  AlertCircleIcon,
  XIcon,
  USDCIcon,
  TokenIcon,
  WalletIcon,
  CopyIcon,
  CheckIcon,
  ExternalLinkIcon,
  QRIcon,
  LockIcon,
  ChainIcon,
} from "@/components/stealth/icons";
import type { V2Keys } from "@/lib/dustpool/v2/types";
import { errorToUserMessage } from "@/lib/dustpool/v2/errors";
import { getTokenBySymbol } from "@/config/tokens";
import { ERC20_ABI } from "@/lib/swap/contracts";
import { getDustPoolV2Config } from "@/lib/dustpool/v2/contracts";
import { getChainConfig, isL2Chain } from "@/config/chains";

type DepositMode = "self" | "external";
type SelectedToken = "native" | "USDC";

interface V2DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  keysRef: RefObject<V2Keys | null>;
  chainId?: number;
  hasKeys?: boolean;
  hasPin?: boolean;
  onDeriveKeys?: (pin: string) => Promise<boolean>;
  isDeriving?: boolean;
  keyError?: string | null;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-[10px] text-[rgba(255,255,255,0.5)] hover:text-[#00EF8B] font-mono transition-colors"
    >
      {copied ? <CheckIcon size={12} color="#00EF8B" /> : <CopyIcon size={12} />}
      {label ?? (copied ? "Copied" : "Copy")}
    </button>
  );
}

export function V2DepositModal({ isOpen, onClose, keysRef, chainId, hasKeys: hasKeysProp, hasPin, onDeriveKeys, isDeriving, keyError }: V2DepositModalProps) {
  const { address } = useAccount();
  const { data: walletBalance } = useBalance({ address });
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { deposit, isPending, txHash, error, clearError } = useV2Deposit(keysRef, chainId);
  const { screenAddress, screeningResult, isScreening, clearScreening } = useV2Compliance(chainId);
  const ext = useExternalDeposit(keysRef, chainId);

  const [amount, setAmount] = useState("");
  const [maxWarning, setMaxWarning] = useState("");
  const [depositMode, setDepositMode] = useState<DepositMode>("self");
  const [showDepositLink, setShowDepositLink] = useState(false);
  const [selectedToken, setSelectedToken] = useState<SelectedToken>("native");
  const [isApproving, setIsApproving] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState<bigint>(0n);
  const [pinInput, setPinInput] = useState("");

  // Keys available: use prop if provided, otherwise check ref directly
  const keysAvailable = hasKeysProp ?? !!keysRef.current;

  const usdcConfig = useMemo(() => getTokenBySymbol(chainId ?? 0, 'USDC'), [chainId]);
  const usdcAddr = usdcConfig?.address as Address | undefined;
  const isUSDC = selectedToken === 'USDC' && !!usdcAddr;
  const nativeSymbol = getChainConfig(chainId).nativeCurrency.symbol;
  const tokenSymbol = isUSDC ? 'USDC' : nativeSymbol;

  // Fetch USDC balance when modal opens
  useEffect(() => {
    if (!isOpen || !usdcAddr || !publicClient || !address) {
      setUsdcBalance(0n);
      return;
    }
    publicClient.readContract({
      address: usdcAddr,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    }).then(bal => setUsdcBalance(bal as bigint)).catch(() => setUsdcBalance(0n));
  }, [isOpen, usdcAddr, publicClient, address]);

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setMaxWarning("");
      setDepositMode("self");
      setSelectedToken("native");
      setShowDepositLink(false);
      setIsApproving(false);
      setPinInput("");
      clearScreening();
      ext.reset();
      if (address) screenAddress();
    }
  }, [isOpen, address, clearScreening, screenAddress, ext.reset]);

  const parsedAmount = (() => {
    try {
      const num = parseFloat(amount);
      if (isNaN(num) || num <= 0) return null;
      return isUSDC ? parseUnits(amount, 6) : parseEther(amount);
    } catch {
      return null;
    }
  })();

  const activeBalance = isUSDC ? usdcBalance : walletBalance?.value ?? 0n;
  const walletBalanceFormatted = isUSDC
    ? parseFloat(formatUnits(usdcBalance, 6)).toFixed(2)
    : walletBalance
      ? parseFloat(formatEther(walletBalance.value)).toFixed(4)
      : "0.0000";

  const exceedsBalance = parsedAmount !== null
    ? parsedAmount > activeBalance
    : false;

  const isScreeningBlocked = screeningResult?.status === "blocked";
  const isScreeningPassed = screeningResult?.status === "clear" || screeningResult?.status === "no-screening";
  const canSelfDeposit = parsedAmount !== null && !exceedsBalance && !isPending && !isApproving && !isScreening && isScreeningPassed;

  const canExternalDeposit = parsedAmount !== null && ext.status === "idle" && ext.hasInjectedWallet;
  const canGenerateLink = parsedAmount !== null && ext.status === "idle";

  const isBusy = isPending || isApproving || ext.status === "connecting-wallet" || ext.status === "awaiting-tx" || ext.status === "confirming" || ext.status === "polling-relayer" || ext.status === "generating-note";

  const handleDeposit = async () => {
    if (!parsedAmount) return;

    if (isUSDC && usdcAddr) {
      const contractConfig = getDustPoolV2Config(chainId ?? 0);
      if (!contractConfig || !publicClient || !walletClient || !address) return;

      setIsApproving(true);
      try {
        const allowance = await publicClient.readContract({
          address: usdcAddr,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, contractConfig.address],
        }) as bigint;

        if (allowance < parsedAmount) {
          const approveHash = await walletClient.writeContract({
            address: usdcAddr,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [contractConfig.address, parsedAmount],
          });
          const walletPublic = walletClient.extend(publicActions);
          await walletPublic.waitForTransactionReceipt({ hash: approveHash });
        }
      } catch {
        setIsApproving(false);
        return;
      }
      setIsApproving(false);

      await deposit(parsedAmount, usdcAddr);
    } else {
      await deposit(parsedAmount);
    }
  };

  const handleExternalDeposit = async () => {
    if (!parsedAmount) return;
    const asset = isUSDC && usdcAddr ? usdcAddr : zeroAddress;
    await ext.depositViaWallet(parsedAmount, asset);
  };

  const handleGenerateLink = async () => {
    if (!parsedAmount) return;
    await ext.generateLink(parsedAmount);
    setShowDepositLink(true);
  };

  const handleClose = useCallback(() => {
    if (!isBusy) onClose();
  }, [isBusy, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isBusy) handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isBusy, handleClose]);

  const handleMaxClick = () => {
    if (isUSDC) {
      if (usdcBalance > 0n) {
        setAmount(formatUnits(usdcBalance, 6));
        setMaxWarning("");
      } else {
        setAmount("0");
        setMaxWarning("No USDC balance");
      }
      return;
    }
    if (!walletBalance) return;
    const reserveAmount = isL2Chain(chainId ?? 0) ? "0.0005" : "0.005";
    const reserved = parseEther(reserveAmount);
    const max = walletBalance.value > reserved ? walletBalance.value - reserved : 0n;
    if (max > 0n) {
      setAmount(formatEther(max));
      setMaxWarning("");
    } else {
      setAmount("0");
      setMaxWarning(`Wallet balance too low (gas reserve: ${reserveAmount} ${nativeSymbol})`);
    }
  };

  const isSuccess = (depositMode === "self" && txHash !== null && !isPending && !error) ||
    (depositMode === "external" && ext.status === "success");
  const isError = (depositMode === "self" && error && !isPending) ||
    (depositMode === "external" && ext.status === "error");

  const switchTab = (mode: DepositMode) => {
    if (isBusy) return;
    setDepositMode(mode);
    setSelectedToken("native");
    setAmount("");
    setMaxWarning("");
    setShowDepositLink(false);
    if (mode === "self") {
      clearError();
      ext.reset();
    } else {
      ext.reset();
    }
  };

  const selectToken = (token: SelectedToken) => {
    if (isBusy) return;
    setSelectedToken(token);
    setAmount("");
    setMaxWarning("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="relative w-full max-w-[440px] p-6 rounded-md border border-[rgba(255,255,255,0.1)] bg-[#06080F] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <ShieldIcon size={16} color="#00EF8B" />
                <span className="text-sm font-bold text-white font-mono tracking-wider">
                  [ DEPOSIT_V2 ]
                </span>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)]">
                  <ChainIcon size={14} chainId={chainId} />
                  <span className="text-[9px] text-[rgba(255,255,255,0.5)] font-mono">{getChainConfig(chainId).name}</span>
                </span>
              </div>
              {!isBusy && (
                <button onClick={handleClose} data-testid="modal-close" className="text-[rgba(255,255,255,0.4)] hover:text-white transition-colors">
                  <XIcon size={20} />
                </button>
              )}
            </div>

            {/* Tab Switcher */}
            {keysAvailable && !isSuccess && !isError && (
              <div className="flex mb-4 border-b border-[rgba(255,255,255,0.08)]">
                <button
                  onClick={() => switchTab("self")}
                  disabled={isBusy}
                  className={`flex-1 pb-2 text-xs font-mono tracking-wider transition-all ${
                    depositMode === "self"
                      ? "text-[#00EF8B] border-b-2 border-[#00EF8B]"
                      : "text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.6)]"
                  } disabled:opacity-50`}
                >
                  This Wallet
                </button>
                <button
                  onClick={() => switchTab("external")}
                  disabled={isBusy}
                  className={`flex-1 pb-2 text-xs font-mono tracking-wider transition-all ${
                    depositMode === "external"
                      ? "text-[#00EF8B] border-b-2 border-[#00EF8B]"
                      : "text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.6)]"
                  } disabled:opacity-50`}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <ExternalLinkIcon size={12} />
                    External Wallet
                  </span>
                </button>
              </div>
            )}

            <div className="flex flex-col gap-4">

              {/* ═══════════════ PIN UNLOCK GATE ═══════════════ */}
              {!keysAvailable && !isSuccess && !isError && (
                <div className="flex flex-col gap-4 py-2">
                  <div className="p-3 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)]">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 shrink-0"><LockIcon size={14} color="#f59e0b" /></div>
                      <p className="text-xs text-[rgba(255,255,255,0.5)] leading-relaxed font-mono">
                        Unlock your V2 keys to generate deposit commitments. {hasPin ? "Enter your PIN below." : "Set a 6-digit PIN to derive your keys."}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
                      {hasPin ? "Enter PIN" : "Set 6-digit PIN"}
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={pinInput}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === "Enter" && pinInput.length === 6 && onDeriveKeys) {
                          onDeriveKeys(pinInput).then(ok => { if (ok) setPinInput(""); });
                        }
                      }}
                      placeholder="••••••"
                      className="w-full p-3 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-white font-mono text-sm text-center tracking-[0.5em] focus:outline-none focus:border-[#00EF8B] focus:bg-[rgba(0,239,139,0.02)] transition-all placeholder-[rgba(255,255,255,0.2)]"
                    />
                    {keyError && (
                      <p className="text-[11px] text-red-400 font-mono">{keyError}</p>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      if (onDeriveKeys) onDeriveKeys(pinInput).then(ok => { if (ok) setPinInput(""); });
                    }}
                    disabled={pinInput.length !== 6 || isDeriving || !onDeriveKeys}
                    className="w-full py-3 rounded-sm bg-[rgba(0,239,139,0.1)] border border-[rgba(0,239,139,0.2)] hover:bg-[rgba(0,239,139,0.15)] hover:border-[#00EF8B] hover:shadow-[0_0_15px_rgba(0,239,139,0.15)] transition-all text-sm font-bold text-[#00EF8B] font-mono tracking-wider disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isDeriving ? (
                      <>
                        <div className="w-3 h-3 border border-[#00EF8B] border-t-transparent rounded-full animate-spin" />
                        Unlocking...
                      </>
                    ) : (
                      <>
                        <LockIcon size={14} color="#00EF8B" />
                        Unlock Keys
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* ═══════════════ SELF DEPOSIT TAB ═══════════════ */}
              {keysAvailable && depositMode === "self" && !isPending && !isApproving && !isSuccess && !isError && (
                <>
                  {/* Compliance screening status */}
                  {isScreening && (
                    <div className="p-3 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)]">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border border-[#00EF8B] border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-[rgba(255,255,255,0.5)] font-mono">Screening address...</p>
                      </div>
                    </div>
                  )}
                  {isScreeningBlocked && (
                    <div className="p-3 rounded-sm bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.2)]">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 shrink-0"><AlertCircleIcon size={14} color="#ef4444" /></div>
                        <p className="text-xs text-red-400 font-mono">
                          Address blocked by compliance screening. Deposits are not available.
                        </p>
                      </div>
                    </div>
                  )}
                  {isScreeningPassed && !isScreening && (
                    <div className="p-3 rounded-sm bg-[rgba(0,239,139,0.04)] border border-[rgba(0,239,139,0.15)]">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 shrink-0"><ShieldCheckIcon size={14} color="#00EF8B" /></div>
                        <p className="text-xs text-[rgba(255,255,255,0.4)] leading-relaxed font-mono">
                          Address cleared. V2 pool supports arbitrary deposit amounts. Note stored locally in IndexedDB.
                        </p>
                      </div>
                    </div>
                  )}
                  {screeningResult?.status === "error" && (
                    <div className="p-3 rounded-sm bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)]">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 shrink-0"><ShieldIcon size={14} color="#f59e0b" /></div>
                        <p className="text-xs text-amber-400 font-mono">
                          Compliance check unavailable. Deposit may fail if address is blocked on-chain.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Token Selector */}
                  {usdcConfig && (
                    <div className="flex gap-1 p-0.5 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                      <button
                        onClick={() => selectToken("native")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-sm text-[10px] font-mono font-bold tracking-wider transition-all ${
                          !isUSDC
                            ? "bg-[rgba(0,239,139,0.1)] text-[#00EF8B] border border-[rgba(0,239,139,0.2)]"
                            : "text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.6)] border border-transparent"
                        }`}
                      >
                        <TokenIcon symbol={nativeSymbol} size={14} /> {nativeSymbol}
                      </button>
                      <button
                        onClick={() => selectToken("USDC")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-sm text-[10px] font-mono font-bold tracking-wider transition-all ${
                          isUSDC
                            ? "bg-[rgba(0,239,139,0.1)] text-[#00EF8B] border border-[rgba(0,239,139,0.2)]"
                            : "text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.6)] border border-transparent"
                        }`}
                      >
                        <USDCIcon size={14} /> USDC
                      </button>
                    </div>
                  )}

                  {/* Amount input */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
                        Amount ({tokenSymbol})
                      </label>
                      <button
                        onClick={handleMaxClick}
                        className="flex items-center gap-1 text-[10px] text-[#00EF8B] font-mono hover:underline"
                      >
                        {isUSDC ? <USDCIcon size={12} /> : <TokenIcon symbol={nativeSymbol} size={12} />}
                        MAX: {walletBalanceFormatted} {tokenSymbol}
                      </button>
                    </div>
                    <input
                      data-testid="deposit-amount"
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setAmount(e.target.value.replace(/[^0-9.]/g, ""));
                      }}
                      placeholder="0.0"
                      className="w-full p-3 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-white font-mono text-sm focus:outline-none focus:border-[#00EF8B] focus:bg-[rgba(0,239,139,0.02)] transition-all placeholder-[rgba(255,255,255,0.2)]"
                    />
                    {exceedsBalance && (
                      <p className="text-[11px] text-red-400 font-mono">Insufficient {tokenSymbol} balance</p>
                    )}
                    {maxWarning && (
                      <p className="text-[11px] text-amber-400 font-mono">{maxWarning}</p>
                    )}
                  </div>

                  <button
                    data-testid="deposit-submit"
                    onClick={handleDeposit}
                    disabled={!canSelfDeposit}
                    className="w-full py-3 rounded-sm bg-[rgba(0,239,139,0.1)] border border-[rgba(0,239,139,0.2)] hover:bg-[rgba(0,239,139,0.15)] hover:border-[#00EF8B] hover:shadow-[0_0_15px_rgba(0,239,139,0.15)] transition-all text-sm font-bold text-[#00EF8B] font-mono tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {parsedAmount ? `Deposit ${amount} ${tokenSymbol}` : "Enter Amount"}
                  </button>
                </>
              )}

              {/* Self deposit — approving USDC */}
              {depositMode === "self" && isApproving && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-8 h-8 border-2 border-[#00EF8B] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-semibold text-white font-mono">Approving USDC...</p>
                  <p className="text-xs text-[rgba(255,255,255,0.4)] text-center font-mono">Confirm the approval in your wallet</p>
                </div>
              )}

              {/* Self deposit — processing */}
              {depositMode === "self" && isPending && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-8 h-8 border-2 border-[#00EF8B] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-semibold text-white font-mono">Depositing {tokenSymbol} to V2 pool...</p>
                  <p className="text-xs text-[rgba(255,255,255,0.4)] text-center font-mono">Confirm the transaction in your wallet</p>
                </div>
              )}

              {/* ═══════════════ EXTERNAL DEPOSIT TAB ═══════════════ */}
              {keysAvailable && depositMode === "external" && ext.status !== "success" && ext.status !== "error" && !showDepositLink && (
                <>
                  {/* Explainer */}
                  <div className="p-3 rounded-sm bg-[rgba(99,102,241,0.06)] border border-[rgba(99,102,241,0.15)]">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 shrink-0"><WalletIcon size={14} color="#818cf8" /></div>
                      <p className="text-xs text-[rgba(255,255,255,0.5)] leading-relaxed font-mono">
                        Deposit from MetaMask, Rabby, or any external wallet. Your Dust session stays active — the external wallet only sees the pool contract.
                      </p>
                    </div>
                  </div>

                  {/* Token Selector */}
                  {usdcConfig && (
                    <div className="flex gap-1 p-0.5 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                      <button
                        onClick={() => selectToken("native")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-sm text-[10px] font-mono font-bold tracking-wider transition-all ${
                          !isUSDC
                            ? "bg-[rgba(0,239,139,0.1)] text-[#00EF8B] border border-[rgba(0,239,139,0.2)]"
                            : "text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.6)] border border-transparent"
                        }`}
                      >
                        <TokenIcon symbol={nativeSymbol} size={14} /> {nativeSymbol}
                      </button>
                      <button
                        onClick={() => selectToken("USDC")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-sm text-[10px] font-mono font-bold tracking-wider transition-all ${
                          isUSDC
                            ? "bg-[rgba(0,239,139,0.1)] text-[#00EF8B] border border-[rgba(0,239,139,0.2)]"
                            : "text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.6)] border border-transparent"
                        }`}
                      >
                        <USDCIcon size={14} /> USDC
                      </button>
                    </div>
                  )}

                  {/* Amount input */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
                      Deposit Amount ({tokenSymbol})
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setAmount(e.target.value.replace(/[^0-9.]/g, ""));
                      }}
                      placeholder="0.0"
                      className="w-full p-3 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-white font-mono text-sm focus:outline-none focus:border-[#00EF8B] focus:bg-[rgba(0,239,139,0.02)] transition-all placeholder-[rgba(255,255,255,0.2)]"
                    />
                  </div>

                  {/* Connect Wallet & Deposit button */}
                  {ext.hasInjectedWallet && (
                    <button
                      onClick={handleExternalDeposit}
                      disabled={!canExternalDeposit}
                      className="w-full py-3 rounded-sm bg-[rgba(0,239,139,0.1)] border border-[rgba(0,239,139,0.2)] hover:bg-[rgba(0,239,139,0.15)] hover:border-[#00EF8B] hover:shadow-[0_0_15px_rgba(0,239,139,0.15)] transition-all text-sm font-bold text-[#00EF8B] font-mono tracking-wider disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <WalletIcon size={16} color="#00EF8B" />
                      {parsedAmount ? `Connect & Deposit ${amount} ${tokenSymbol}` : "Enter Amount"}
                    </button>
                  )}

                  {!ext.hasInjectedWallet && (
                    <div className="p-3 rounded-sm bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)]">
                      <p className="text-xs text-amber-400 font-mono">
                        No browser wallet detected. Use the deposit link below to send from any wallet.
                      </p>
                    </div>
                  )}

                  {/* Generate Deposit Link — secondary action */}
                  <button
                    onClick={handleGenerateLink}
                    disabled={!canGenerateLink}
                    className="w-full py-2.5 rounded-sm border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)] transition-all text-xs text-[rgba(255,255,255,0.5)] hover:text-[rgba(255,255,255,0.7)] font-mono flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <QRIcon size={14} />
                    Generate Deposit Link / QR Code
                  </button>
                </>
              )}

              {/* External — connecting */}
              {depositMode === "external" && ext.status === "connecting-wallet" && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-8 h-8 border-2 border-[#00EF8B] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-semibold text-white font-mono">Connecting external wallet...</p>
                  <p className="text-xs text-[rgba(255,255,255,0.4)] text-center font-mono">Your Dust session remains active</p>
                </div>
              )}

              {/* External — awaiting tx */}
              {depositMode === "external" && ext.status === "awaiting-tx" && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-8 h-8 border-2 border-[#00EF8B] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-semibold text-white font-mono">Confirm in external wallet</p>
                  <p className="text-xs text-[rgba(255,255,255,0.4)] text-center font-mono">Sign the deposit transaction in MetaMask / Rabby</p>
                </div>
              )}

              {/* External — confirming tx */}
              {depositMode === "external" && (ext.status === "confirming" || ext.status === "polling-relayer") && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-8 h-8 border-2 border-[#00EF8B] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-semibold text-white font-mono">
                    {ext.status === "confirming" ? "Confirming on-chain..." : "Waiting for relayer..."}
                  </p>
                  {ext.txHash && (
                    <p className="text-[11px] font-mono text-[rgba(255,255,255,0.3)] break-all px-4">{ext.txHash}</p>
                  )}
                </div>
              )}

              {/* External — generating note */}
              {depositMode === "external" && ext.status === "generating-note" && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-8 h-8 border-2 border-[#00EF8B] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-semibold text-white font-mono">Generating commitment...</p>
                </div>
              )}

              {/* External — deposit link / QR view */}
              {depositMode === "external" && showDepositLink && ext.depositLink && ext.status === "idle" && (
                <div className="flex flex-col gap-4">
                  {/* QR Code */}
                  <div className="flex flex-col items-center gap-3 py-2">
                    <div className="p-3 bg-white rounded-md">
                      <QRCodeSVG value={ext.depositLink} size={180} level="M" />
                    </div>
                    <p className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono">
                      Scan with any wallet to deposit
                    </p>
                  </div>

                  {/* Pool address */}
                  {ext.poolAddress && (
                    <div className="p-3 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)]">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider font-mono">Pool Contract</p>
                        <CopyButton text={ext.poolAddress} />
                      </div>
                      <p className="text-[11px] font-mono text-[rgba(255,255,255,0.6)] break-all">{ext.poolAddress}</p>
                    </div>
                  )}

                  {/* Calldata */}
                  {ext.depositCalldata && (
                    <div className="p-3 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)]">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider font-mono">Calldata</p>
                        <CopyButton text={ext.depositCalldata} />
                      </div>
                      <p className="text-[10px] font-mono text-[rgba(255,255,255,0.4)] break-all">{ext.depositCalldata}</p>
                    </div>
                  )}

                  {/* Amount + deposit link */}
                  <div className="p-3 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)]">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider font-mono">Amount</p>
                    </div>
                    <p className="text-sm font-mono text-white font-bold">{amount} {tokenSymbol}</p>
                  </div>

                  {/* Confirm deposit button */}
                  <button
                    onClick={ext.startPolling}
                    className="w-full py-3 rounded-sm bg-[rgba(0,239,139,0.1)] border border-[rgba(0,239,139,0.2)] hover:bg-[rgba(0,239,139,0.15)] hover:border-[#00EF8B] hover:shadow-[0_0_15px_rgba(0,239,139,0.15)] transition-all text-sm font-bold text-[#00EF8B] font-mono tracking-wider"
                  >
                    I&apos;ve Sent the Deposit
                  </button>

                  <button
                    onClick={() => { setShowDepositLink(false); ext.reset(); }}
                    className="w-full py-2 text-xs text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.6)] font-mono transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* ═══════════════ SHARED SUCCESS STATE ═══════════════ */}
              {isSuccess && (
                <div className="flex flex-col gap-4">
                  <div className="text-center py-2">
                    <div className="inline-flex mb-3">
                      <ShieldCheckIcon size={40} color="#00EF8B" />
                    </div>
                    <p className="text-base font-bold text-white mb-1 font-mono">Deposit Successful</p>
                    <p className="text-[13px] text-[rgba(255,255,255,0.5)] font-mono">{amount} {tokenSymbol} deposited to V2 privacy pool</p>
                  </div>

                  {(txHash || ext.txHash) && (
                    <div className="p-3 rounded-sm bg-[rgba(0,239,139,0.04)] border border-[rgba(0,239,139,0.15)]">
                      <p className="text-[11px] text-[rgba(255,255,255,0.4)] mb-1 font-mono">Transaction</p>
                      <p className="text-xs font-mono text-[#00EF8B] break-all">{txHash ?? ext.txHash}</p>
                    </div>
                  )}

                  <div className="p-3 rounded-sm bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)]">
                    <p className="text-xs text-amber-400 font-semibold mb-1 font-mono">Note Saved Locally</p>
                    <p className="text-[11px] text-[rgba(255,255,255,0.4)] leading-relaxed font-mono">
                      Your UTXO note is stored in this browser&apos;s IndexedDB. Clearing browser data will lose access to this deposit.
                    </p>
                  </div>

                  <div className="p-3 rounded-sm bg-[rgba(99,102,241,0.06)] border border-[rgba(99,102,241,0.15)]">
                    <p className="text-xs text-indigo-400 font-semibold mb-1 font-mono">1-Hour Cooldown Active</p>
                    <p className="text-[11px] text-[rgba(255,255,255,0.4)] leading-relaxed font-mono">
                      For compliance, private transfers are available after a 1-hour cooldown. During this period, you can only withdraw back to your deposit address.
                    </p>
                  </div>

                  <button
                    onClick={handleClose}
                    className="w-full py-3 rounded-sm bg-[rgba(0,239,139,0.1)] border border-[rgba(0,239,139,0.2)] hover:bg-[rgba(0,239,139,0.15)] hover:border-[#00EF8B] transition-all text-sm font-bold text-[#00EF8B] font-mono tracking-wider"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* ═══════════════ SHARED ERROR STATE ═══════════════ */}
              {isError && (
                <div className="flex flex-col gap-4">
                  <div className="text-center py-2">
                    <div className="inline-flex mb-3">
                      <AlertCircleIcon size={40} color="#ef4444" />
                    </div>
                    <p className="text-base font-bold text-white mb-1 font-mono">Deposit Failed</p>
                    <p className="text-[13px] text-[rgba(255,255,255,0.5)] font-mono">
                      {errorToUserMessage((depositMode === "self" ? error : ext.error) ?? "Unknown error")}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleClose}
                      className="flex-1 py-3 rounded-sm bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.07)] text-sm font-semibold text-white font-mono transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (depositMode === "self") {
                          clearError();
                        }
                        ext.reset();
                        setAmount("");
                        setShowDepositLink(false);
                      }}
                      className="flex-1 py-3 rounded-sm bg-[rgba(0,239,139,0.1)] border border-[rgba(0,239,139,0.2)] hover:bg-[rgba(0,239,139,0.15)] hover:border-[#00EF8B] text-sm font-bold text-[#00EF8B] font-mono tracking-wider transition-all"
                    >
                      Try Again
                    </button>
                  </div>
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
