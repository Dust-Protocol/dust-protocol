"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { formatUnits, parseUnits, zeroAddress } from "viem";
import { ChevronDownIcon } from "lucide-react";
import { SUPPORTED_TOKENS, type SwapToken, isSwapSupported, RELAYER_FEE_BPS, getUSDCAddress, ETH_ADDRESS } from "@/lib/swap/constants";
import { COMPLIANCE_COOLDOWN_THRESHOLD_USD } from "@/lib/dustpool/v2/constants";
import { DEFAULT_CHAIN_ID } from "@/config/chains";
import { useSwitchChain } from "wagmi";
import { useAuth } from "@/contexts/AuthContext";
import { UnsupportedChainNotice } from "@/components/ui/UnsupportedChainNotice";
import { useV2Keys, useV2Balance } from "@/hooks/dustpool/v2";
import { useV2Swap, type SwapStatus } from "@/hooks/swap/v2/useV2Swap";
import { useV2DenomSwap, type DenomSwapStatus } from "@/hooks/swap/v2/useV2DenomSwap";
import { useSwapQuote } from "@/hooks/swap";
import { computeAssetId } from "@/lib/dustpool/v2/commitment";
import { prefetchProofAssets } from "@/lib/dustpool/v2/proof";
import { decomposeForSplit, formatChunks, suggestRoundedAmounts } from "@/lib/dustpool/v2/denominations";
import { getExplorerBase } from "@/lib/design/tokens";
import { AlertCircleIcon, LockIcon, TokenIcon, ShieldIcon } from "@/components/stealth/icons";
import { V2DepositModal } from "@/components/dustpool/V2DepositModal";

const SLIPPAGE_OPTIONS = [
  { label: "0.1%", bps: 10 },
  { label: "0.5%", bps: 50 },
  { label: "1%", bps: 100 },
] as const;

const DEFAULT_SLIPPAGE_BPS = 50;

export const STATUS_STEPS: SwapStatus[] = [
  "selecting-note",
  "proving-compliance",
  "generating-proof",
  "submitting",
  "confirming",
  "saving-note",
];

export const STATUS_LABELS: Record<SwapStatus, string> = {
  idle: "",
  "selecting-note": "Selecting optimal note...",
  "proving-compliance": "Proving compliance...",
  "generating-proof": "Generating ZK proof...",
  submitting: "Submitting to relayer...",
  confirming: "Confirming on-chain...",
  "saving-note": "Saving output note...",
  done: "Swap complete!",
  error: "Swap failed",
};

export const DENOM_STATUS_STEPS: DenomSwapStatus[] = [
  "decomposing",
  "proving-compliance",
  "splitting",
  "confirming-split",
  "polling-leaves",
  "proving-denom-compliance",
  "generating-swap-proofs",
  "submitting-swaps",
  "confirming-swaps",
  "saving-notes",
];

export const DENOM_STATUS_LABELS: Record<DenomSwapStatus, string> = {
  idle: "",
  decomposing: "Decomposing into denominations...",
  "proving-compliance": "Proving compliance...",
  splitting: "Generating split proof...",
  "confirming-split": "Confirming split on-chain...",
  "polling-leaves": "Waiting for leaf confirmation...",
  "proving-denom-compliance": "Proving denomination compliance...",
  "generating-swap-proofs": "Generating swap proofs...",
  "submitting-swaps": "Submitting batch swap...",
  "confirming-swaps": "Confirming swaps on-chain...",
  "saving-notes": "Saving output notes...",
  done: "Denomination swap complete!",
  error: "Denomination swap failed",
};

export function formatExchangeRate(rate: number): string {
  if (rate <= 0) return '\u2014';
  if (rate >= 1) return rate.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (rate >= 0.000001) return rate.toFixed(6);
  return '~0';
}

export function SwapV2Card({ onPoolChange, oraclePrice }: { onPoolChange?: () => void; oraclePrice?: number | null }) {
  const { isConnected, activeChainId } = useAuth();
  const swapSupported = isSwapSupported(activeChainId);
  const { switchChain } = useSwitchChain();

  const { keysRef, hasKeys, hasPin, isDeriving, error: keyError, deriveKeys } = useV2Keys();

  const { balances, pendingDeposits, isLoading: balanceLoading, refreshBalances } = useV2Balance(keysRef, activeChainId);

  const [fromToken, setFromToken] = useState<SwapToken>(SUPPORTED_TOKENS.ETH);
  const [toToken, setToToken] = useState<SwapToken>(SUPPORTED_TOKENS.USDC);
  const [amountStr, setAmountStr] = useState("");
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [customSlippage, setCustomSlippage] = useState("");
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);

  // PIN input — shown inline when user tries to swap without keys
  const [pinInput, setPinInput] = useState("");
  const [showPinInput, setShowPinInput] = useState(false);
  const [pendingSwapAfterPin, setPendingSwapAfterPin] = useState(false);

  const [showFromTokenDropdown, setShowFromTokenDropdown] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

  const { swap, isPending, status, txHash, error: swapError, outputNote, clearError } = useV2Swap(keysRef, activeChainId);
  const {
    denomSwap,
    isPending: isDenomPending,
    status: denomStatus,
    progress: denomProgress,
    txHashes: denomTxHashes,
    error: denomError,
    clearError: clearDenomError,
  } = useV2DenomSwap(keysRef, activeChainId);

  // Denomination swap toggle (default ON for privacy)
  const [useDenomSwap, setUseDenomSwap] = useState(true);

  // Price quote (reuse V1 quoter — same Uniswap V4 pool)
  const {
    amountOut: quotedAmountOut,
    isLoading: isQuoteLoading,
    error: quoteError,
  } = useSwapQuote({
    fromToken: fromToken.address,
    toToken: toToken.address,
    amountIn: amountStr,
    chainId: activeChainId,
  });

  const [ethAssetId, setEthAssetId] = useState<bigint | null>(null);
  const [usdcAssetId, setUsdcAssetId] = useState<bigint | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function computeIds() {
      try {
        const ethId = await computeAssetId(activeChainId, zeroAddress);
        if (cancelled) return;
        setEthAssetId(ethId);
      } catch (err) { console.error('Failed to compute ETH asset ID:', err); }
      try {
        const usdcAddr = getUSDCAddress(activeChainId);
        const usdcId = await computeAssetId(activeChainId, usdcAddr);
        if (cancelled) return;
        setUsdcAssetId(usdcId);
      } catch { /* USDC may not be deployed on this chain */ }
    }
    computeIds().catch(console.error);
    return () => { cancelled = true; };
  }, [activeChainId]);

  const fromBalance = useMemo(() => {
    const assetId = fromToken.address === ETH_ADDRESS ? ethAssetId : usdcAssetId;
    if (!assetId) return 0n;
    return balances.get(assetId) ?? 0n;
  }, [balances, fromToken.address, ethAssetId, usdcAssetId]);

  const toBalance = useMemo(() => {
    const assetId = toToken.address === ETH_ADDRESS ? ethAssetId : usdcAssetId;
    if (!assetId) return 0n;
    return balances.get(assetId) ?? 0n;
  }, [balances, toToken.address, ethAssetId, usdcAssetId]);

  const formattedFromBalance = formatUnits(fromBalance, fromToken.decimals);
  const displayFromBalance = parseFloat(formattedFromBalance).toFixed(fromToken.decimals > 6 ? 4 : 2);

  const parsedAmount = parseFloat(amountStr);
  const amountValid = !isNaN(parsedAmount) && parsedAmount > 0;
  const amountInWei = amountValid
    ? parseUnits(amountStr, fromToken.decimals)
    : 0n;

  const toAmountFormatted = useMemo(() => {
    if (quotedAmountOut <= 0n) return "";
    const formatted = formatUnits(quotedAmountOut, toToken.decimals);
    return parseFloat(formatted).toFixed(toToken.decimals > 6 ? 6 : 2);
  }, [quotedAmountOut, toToken.decimals]);

  const exchangeRate = useMemo(() => {
    if (!amountValid || quotedAmountOut <= 0n) return 0;
    const rawOut = parseFloat(formatUnits(quotedAmountOut, toToken.decimals));
    return rawOut / parsedAmount;
  }, [amountValid, parsedAmount, quotedAmountOut, toToken.decimals]);

  // Price impact: compare effective rate to oracle spot price
  const priceImpactPct = useMemo(() => {
    if (!oraclePrice || oraclePrice <= 0 || exchangeRate <= 0) return null;
    // For ETH→USDC: exchangeRate is USDC per ETH, oraclePrice is USDC per ETH
    // For USDC→ETH: exchangeRate is ETH per USDC, fair rate is 1/oraclePrice
    const isFromNative = fromToken.address === ETH_ADDRESS;
    const fairRate = isFromNative ? oraclePrice : 1 / oraclePrice;
    if (fairRate <= 0) return null;
    return ((fairRate - exchangeRate) / fairRate) * 100;
  }, [oraclePrice, exchangeRate, fromToken.symbol]);

  const minAmountOut = useMemo(() => {
    if (quotedAmountOut <= 0n) return 0n;
    const afterFee = quotedAmountOut - (quotedAmountOut * BigInt(RELAYER_FEE_BPS) / 10000n);
    return afterFee - (afterFee * BigInt(slippageBps) / 10000n);
  }, [quotedAmountOut, slippageBps]);

  const minReceivedFormatted = useMemo(() => {
    if (minAmountOut <= 0n) return "0";
    const formatted = formatUnits(minAmountOut, toToken.decimals);
    return parseFloat(formatted).toFixed(toToken.decimals > 6 ? 6 : 2);
  }, [minAmountOut, toToken.decimals]);

  const denomChunks = useMemo(() => {
    if (!amountValid || amountInWei <= 0n) return [];
    try {
      return decomposeForSplit(amountInWei, fromToken.symbol, 7);
    } catch (err) {
      console.error('Denomination decomposition failed:', err);
      return [];
    }
  }, [amountInWei, amountValid, fromToken.symbol]);

  const denomChunksFormatted = useMemo(
    () => (denomChunks.length > 0 ? formatChunks(denomChunks, fromToken.symbol) : []),
    [denomChunks, fromToken.symbol]
  );

  const denomSuggestions = useMemo(() => {
    if (!amountValid || amountInWei <= 0n || denomChunks.length <= 1) return [];
    try {
      return suggestRoundedAmounts(amountInWei, fromToken.symbol, 2);
    } catch {
      return [];
    }
  }, [amountInWei, amountValid, denomChunks.length, fromToken.symbol]);

  const shouldUseDenomSwap = useDenomSwap && denomChunks.length > 1;

  const activeStatus = shouldUseDenomSwap ? denomStatus : status;
  const activeIsPending = shouldUseDenomSwap ? isDenomPending : isPending;
  const activeError = shouldUseDenomSwap ? denomError : swapError;
  const activeTxHash = shouldUseDenomSwap
    ? (denomTxHashes.length > 0 ? denomTxHashes[0] : null)
    : txHash;

  // Insufficient balance check — skip when swap is complete (balance just changed)
  const insufficientBalance = hasKeys && activeStatus !== "done" && amountInWei > 0n && amountInWei > fromBalance;

  // canSwap requires keys; canAttemptSwap allows triggering PIN prompt
  const canSwap =
    isConnected &&
    hasKeys &&
    amountValid &&
    !insufficientBalance &&
    quotedAmountOut > 0n &&
    activeStatus === "idle" &&
    !activeIsPending &&
    !isQuoteLoading &&
    swapSupported;

  const canAttemptSwap =
    isConnected &&
    amountValid &&
    quotedAmountOut > 0n &&
    activeStatus === "idle" &&
    !activeIsPending &&
    !isQuoteLoading &&
    swapSupported;

  const handleFlipTokens = useCallback(() => {
    setFromToken(toToken);
    setToToken(fromToken);
    setAmountStr("");
  }, [fromToken, toToken]);

  const handleSwap = useCallback(async () => {
    if (!canSwap) return;
    if (shouldUseDenomSwap) {
      await denomSwap(
        amountInWei,
        fromToken.address,
        toToken.address,
        minAmountOut,
        slippageBps,
        RELAYER_FEE_BPS
      );
    } else {
      await swap(
        amountInWei,
        fromToken.address,
        toToken.address,
        minAmountOut,
        RELAYER_FEE_BPS
      );
    }
  }, [canSwap, shouldUseDenomSwap, denomSwap, swap, amountInWei, fromToken.address, toToken.address, minAmountOut, slippageBps]);

  const handleReset = useCallback(() => {
    clearError();
    clearDenomError();
    setAmountStr("");
    refreshBalances();
  }, [clearError, clearDenomError, refreshBalances]);

  const handlePinSubmit = async () => {
    try {
      const ok = await deriveKeys(pinInput);
      if (ok) {
        setPinInput("");
        setShowPinInput(false);
        await refreshBalances();
      }
    } catch (err) {
      console.error('PIN derivation failed:', err);
    }
  };

  // When user clicks swap without keys, show PIN prompt
  const handleSwapOrUnlock = useCallback(() => {
    if (!hasKeys) {
      setShowPinInput(true);
      setPendingSwapAfterPin(true);
      return;
    }
    handleSwap();
  }, [hasKeys, handleSwap]);

  const handleSlippageChange = (bps: number) => {
    setSlippageBps(bps);
    setCustomSlippage("");
  };

  const handleCustomSlippage = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setCustomSlippage(cleaned);
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num > 0) {
      const clamped = Math.min(num, 50);
      setSlippageBps(Math.round(clamped * 100));
    }
  };

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (cleaned.split(".").length > 2) return;
    setAmountStr(cleaned);
  };

  const handleMaxClick = () => {
    if (fromBalance <= 0n) return;
    const formatted = formatUnits(fromBalance, fromToken.decimals);
    // Trim to reasonable precision to avoid displaying 18+ decimal digits
    const maxDecimals = fromToken.decimals > 6 ? 8 : 4;
    const trimmed = parseFloat(formatted).toFixed(maxDecimals).replace(/\.?0+$/, '');
    setAmountStr(trimmed || '0');
  };

  useEffect(() => {
    if (isConnected && !swapSupported && switchChain) {
      const timer = setTimeout(() => {
        switchChain({ chainId: DEFAULT_CHAIN_ID });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, swapSupported, switchChain]);

  useEffect(() => {
    if (activeStatus === "done") {
      refreshBalances();
    }
  }, [activeStatus, refreshBalances]);

  useEffect(() => {
    if (!hasKeys) return;
    prefetchProofAssets();
    const interval = setInterval(refreshBalances, 30_000);
    return () => clearInterval(interval);
  }, [hasKeys, refreshBalances]);

  useEffect(() => {
    if (pendingSwapAfterPin && hasKeys) {
      setPendingSwapAfterPin(false);
      handleSwap();
    }
  }, [pendingSwapAfterPin, hasKeys, handleSwap]);

  const explorerBase = getExplorerBase(activeChainId);
  const isProcessing = activeIsPending || (activeStatus !== "idle" && activeStatus !== "done" && activeStatus !== "error");

  const getButtonContent = () => {
    if (!isConnected) return "Connect Wallet";
    if (!swapSupported) return "Swaps Not Available";
    if (isQuoteLoading && amountValid) return "Getting Quote...";
    if (activeIsPending) {
      if (shouldUseDenomSwap) {
        const label = DENOM_STATUS_LABELS[denomStatus] || "Processing...";
        return denomProgress.total > 0
          ? `${label} (${denomProgress.current}/${denomProgress.total})`
          : label;
      }
      return STATUS_LABELS[status] || "Processing...";
    }
    if (activeStatus === "done") return "Swap Complete!";
    if (activeStatus === "error") return "Try Again";
    if (!amountStr || !amountValid) return "Enter Amount";
    if (quoteError?.includes('liquidity') || quoteError === 'Pool not available') return "No Liquidity";
    if (quotedAmountOut <= 0n && amountValid && !isQuoteLoading) return quoteError ? "Quote Unavailable" : "No Liquidity";
    if (!hasKeys) return "Enter PIN Above";
    if (balanceLoading) return "Loading Balances...";
    if (insufficientBalance) return "Insufficient Balance";
    return shouldUseDenomSwap && denomChunks.length > 1 ? `Swap (${denomChunks.length} chunks)` : "Swap";
  };

  const buttonDisabled = activeStatus === "error" || activeStatus === "done"
    ? false
    : hasKeys ? !canSwap : !canAttemptSwap;

  const currentStepIndex = shouldUseDenomSwap
    ? DENOM_STATUS_STEPS.indexOf(denomStatus as DenomSwapStatus)
    : STATUS_STEPS.indexOf(status);
  const activeSteps = shouldUseDenomSwap ? DENOM_STATUS_STEPS : STATUS_STEPS;
  const activeLabels = shouldUseDenomSwap ? DENOM_STATUS_LABELS : STATUS_LABELS;

  return (
    <div className="w-full max-w-[620px]">
      <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-sm backdrop-blur-sm relative overflow-hidden">
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[rgba(255,255,255,0.1)]" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[rgba(255,255,255,0.1)]" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[rgba(255,255,255,0.1)]" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[rgba(255,255,255,0.1)]" />

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold font-mono text-white tracking-widest uppercase">
                PRIVACY_SWAP
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDepositModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(0,255,65,0.06)] hover:border-[rgba(0,255,65,0.25)] transition-all text-[11px] font-mono text-[rgba(255,255,255,0.6)] hover:text-[#00FF41]"
              >
                <span className="text-[13px] leading-none">+</span>
                <span className="tracking-wider">Deposit</span>
              </button>
            <button
              onClick={() => setShowSlippageSettings(!showSlippageSettings)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(0,255,65,0.06)] hover:border-[rgba(0,255,65,0.25)] transition-all text-[10px] font-mono text-[rgba(255,255,255,0.5)] hover:text-[#00FF41]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
              </svg>
              <span>{(slippageBps / 100).toFixed(1)}%</span>
            </button>
            </div>
          </div>

          {/* Slippage Settings */}
          {showSlippageSettings && (
            <div className="mb-4 p-3 rounded-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
              <span className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-widest font-mono block mb-2">
                SLIPPAGE_TOLERANCE
              </span>
              <div className="flex gap-2">
                {SLIPPAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.bps}
                    onClick={() => handleSlippageChange(opt.bps)}
                    className={`flex-1 py-1.5 rounded-sm text-[11px] font-bold font-mono transition-all ${
                      slippageBps === opt.bps && !customSlippage
                        ? "bg-[rgba(0,255,65,0.12)] border border-[rgba(0,255,65,0.3)] text-[#00FF41]"
                        : "bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.5)] hover:border-[rgba(255,255,255,0.15)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customSlippage}
                    onChange={(e) => handleCustomSlippage(e.target.value)}
                    placeholder="Custom"
                    className={`w-full py-1.5 px-2 rounded-sm text-[11px] font-bold font-mono text-center bg-[rgba(255,255,255,0.03)] border outline-none transition-all ${
                      customSlippage
                        ? "border-[rgba(0,255,65,0.3)] text-[#00FF41]"
                        : "border-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.5)]"
                    } placeholder-[rgba(255,255,255,0.2)] focus:border-[rgba(0,255,65,0.4)]`}
                  />
                  {customSlippage && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[rgba(255,255,255,0.3)] font-mono">%</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Unsupported Chain Banner */}
          {!swapSupported && isConnected && (
            <UnsupportedChainNotice feature="V2 Swap" />
          )}

          {/* Keys status + inline PIN unlock */}
          {isConnected && swapSupported && !hasKeys && (
            <div className="mb-4 p-3 rounded-sm bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)]">
              <div className="flex items-center gap-2 mb-2.5">
                <LockIcon size={12} color="#f59e0b" />
                <span className="text-[11px] text-amber-400 font-mono font-bold">
                  {hasPin ? "Enter PIN to unlock" : "Set 6-digit PIN"}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && pinInput.length === 6) handlePinSubmit();
                  }}
                  placeholder="------"
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
          {isConnected && swapSupported && hasKeys && (
            <div className="mb-4 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00FF41]" />
              <span className="text-[10px] font-mono text-[#00FF41]">V2 keys active</span>
            </div>
          )}

          {/* Pending deposits banner */}
          {hasKeys && pendingDeposits > 0 && !isProcessing && (
            <div className="mb-4 p-3 rounded-sm bg-[rgba(99,102,241,0.06)] border border-[rgba(99,102,241,0.15)]">
              <div className="flex items-start gap-2">
                <ShieldIcon size={12} color="#818cf8" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-indigo-400 font-mono font-bold">
                    {pendingDeposits} pending deposit{pendingDeposits > 1 ? "s" : ""}
                  </span>
                  <span className="text-[10px] text-[rgba(255,255,255,0.35)] font-mono leading-relaxed">
                    Deposits require relayer confirmation before they appear in your balance. This usually takes 30-60 seconds.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── FROM (Input) ─────────────────────────────────────── */}
          <div className="mb-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-widest font-mono">FROM</span>
              <span className="text-[10px] text-[rgba(255,255,255,0.35)] font-mono">
                {hasKeys ? (
                  <>Balance: <span className="text-[rgba(255,255,255,0.6)]">{displayFromBalance}</span> {fromToken.symbol}</>
                ) : (
                  <span className="text-[rgba(255,255,255,0.25)]">&mdash;</span>
                )}
              </span>
            </div>

            <div className="rounded-sm p-3.5 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] focus-within:border-[rgba(0,255,65,0.3)] transition-all">
              <div className="flex items-center gap-3">
                {/* Token selector */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowFromTokenDropdown(!showFromTokenDropdown)}
                    disabled={isProcessing}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-sm border transition-all ${
                      showFromTokenDropdown
                        ? "bg-[rgba(0,255,65,0.08)] border-[rgba(0,255,65,0.3)]"
                        : "bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.08)] hover:border-[rgba(0,255,65,0.25)] hover:bg-[rgba(0,255,65,0.05)]"
                    } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <TokenIcon symbol={fromToken.symbol} size={24} />
                    <span className="text-[13px] font-bold font-mono text-white">{fromToken.symbol}</span>
                    <ChevronDownIcon className={`w-3 h-3 text-[rgba(255,255,255,0.35)] transition-transform duration-150 ${showFromTokenDropdown ? "rotate-180 !text-[#00FF41]" : ""}`} />
                  </button>

                  {showFromTokenDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-36 bg-[#06080F] border border-[rgba(255,255,255,0.1)] rounded-sm shadow-xl overflow-hidden z-40">
                      {Object.values(SUPPORTED_TOKENS)
                        .map((t) => (
                          <button
                            key={t.symbol}
                            type="button"
                            onClick={() => {
                              if (t.address === toToken.address) setToToken(fromToken);
                              setFromToken(t);
                              setAmountStr("");
                              setShowFromTokenDropdown(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[rgba(0,255,65,0.05)] border-b border-[rgba(255,255,255,0.04)] last:border-0 ${
                              fromToken.symbol === t.symbol ? "bg-[rgba(0,255,65,0.04)]" : ""
                            }`}
                          >
                            <TokenIcon symbol={t.symbol} size={24} />
                            <span className="text-[12px] font-bold font-mono text-white">{t.symbol}</span>
                            {fromToken.symbol === t.symbol && (
                              <span className="ml-auto text-[#00FF41] text-xs">&#10003;</span>
                            )}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Amount input */}
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountStr}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0.0"
                  disabled={isProcessing}
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-[22px] font-mono font-bold text-white text-right p-0 placeholder-[rgba(255,255,255,0.15)] focus:outline-none focus:ring-0 disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>

              {/* Percentage buttons */}
              {hasKeys && fromBalance > 0n && !isProcessing && (
                <div className="flex gap-2 mt-3">
                  {[25, 50, 75].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        const bal = fromBalance * BigInt(pct) / 100n;
                        const formatted = formatUnits(bal, fromToken.decimals);
                        const maxDecimals = fromToken.decimals > 6 ? 8 : 4;
                        const trimmed = parseFloat(formatted).toFixed(maxDecimals).replace(/\.?0+$/, '');
                        setAmountStr(trimmed || '0');
                      }}
                      className="flex-1 px-2 py-[5px] rounded-sm text-[10px] font-bold font-mono bg-[rgba(0,255,65,0.06)] text-[#00FF41] border border-[rgba(0,255,65,0.12)] cursor-pointer transition-all text-center hover:bg-[rgba(0,255,65,0.12)] hover:border-[rgba(0,255,65,0.25)]"
                    >
                      {pct}%
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleMaxClick}
                    className="flex-1 px-2 py-[5px] rounded-sm text-[10px] font-bold font-mono bg-[rgba(0,255,65,0.06)] text-[#00FF41] border border-[rgba(0,255,65,0.12)] cursor-pointer transition-all text-center hover:bg-[rgba(0,255,65,0.12)] hover:border-[rgba(0,255,65,0.25)]"
                  >
                    MAX
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── SWAP DIRECTION ARROW ──────────────────────────────── */}
          <div className="flex justify-center items-center pt-4 pb-2.5 relative z-10">
            <button
              type="button"
              onClick={handleFlipTokens}
              disabled={isProcessing}
              className="p-2 rounded-sm bg-[#06080F] border border-[rgba(0,255,65,0.2)] hover:border-[#00FF41] hover:bg-[rgba(0,255,65,0.06)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00FF41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            </button>
          </div>

          {/* ── TO (Output) ──────────────────────────────────────── */}
          <div className="mb-0">
            <span className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-widest font-mono block mb-2">TO (STEALTH)</span>
            <div className="flex items-center justify-between p-3.5 rounded-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
              <div className="flex items-center gap-2">
                <TokenIcon symbol={toToken.symbol} size={28} />
                <span className="text-[14px] font-bold font-mono text-white">{toToken.symbol}</span>
              </div>

              <div className="flex flex-col items-end">
                {isQuoteLoading && amountValid ? (
                  <div className="w-4 h-4 border-2 border-[#00FF41] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span className={`text-2xl font-bold font-mono leading-none ${
                      toAmountFormatted
                        ? "text-[#00FF41]"
                        : amountValid && quoteError
                        ? "text-[rgba(239,68,68,0.5)]"
                        : "text-[rgba(255,255,255,0.12)]"
                    }`}>
                      {toAmountFormatted || "\u2014"}
                    </span>
                    <span className={`text-[9px] font-mono mt-1 ${
                      amountValid && quoteError
                        ? "text-[rgba(239,68,68,0.6)]"
                        : "text-[rgba(255,255,255,0.25)]"
                    }`}>
                      {toAmountFormatted
                        ? "Estimated output"
                        : amountValid && quoteError
                        ? "No liquidity"
                        : "Enter amount above"}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Denomination Privacy ─────────────────────────────── */}
          {amountValid && denomChunks.length > 0 && !isProcessing && (
            <div className="mt-4 p-3 rounded-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <ShieldIcon size={12} color={useDenomSwap ? "#00FF41" : "rgba(255,255,255,0.35)"} />
                  <span className="text-[10px] text-[rgba(255,255,255,0.5)] uppercase tracking-widest font-mono">
                    DENOM_PRIVACY
                  </span>
                </div>
                <button
                  onClick={() => setUseDenomSwap(!useDenomSwap)}
                  className={`relative w-8 h-4 rounded-full transition-all ${
                    useDenomSwap
                      ? "bg-[rgba(0,255,65,0.25)] border border-[rgba(0,255,65,0.4)]"
                      : "bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)]"
                  }`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
                    useDenomSwap
                      ? "left-[calc(100%-14px)] bg-[#00FF41]"
                      : "left-0.5 bg-[rgba(255,255,255,0.4)]"
                  }`} />
                </button>
              </div>

              {useDenomSwap && denomChunks.length > 1 && (
                <>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {denomChunksFormatted.map((chunk, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-sm bg-[rgba(0,255,65,0.06)] border border-[rgba(0,255,65,0.12)] text-[10px] font-mono text-[#00FF41]"
                      >
                        {chunk} {fromToken.symbol}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono leading-relaxed">
                    Splits into {denomChunks.length} common-sized chunks to hide your exact amount. Each chunk is swapped in a separate transaction with random delays.
                  </span>

                  {denomSuggestions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[rgba(255,255,255,0.04)]">
                      <span className="text-[9px] text-[rgba(255,255,255,0.3)] uppercase tracking-widest font-mono block mb-1.5">
                        FEWER CHUNKS
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {denomSuggestions.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => setAmountStr(s.formatted)}
                            className="px-2 py-0.5 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(0,255,65,0.25)] hover:bg-[rgba(0,255,65,0.04)] text-[10px] font-mono text-[rgba(255,255,255,0.5)] hover:text-[#00FF41] transition-all"
                          >
                            {s.formatted} {fromToken.symbol} ({s.chunks} chunk{s.chunks > 1 ? "s" : ""})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {useDenomSwap && denomChunks.length === 1 && (
                <span className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono leading-relaxed">
                  Amount already matches a standard denomination. Your swap blends in with others of the same size.
                </span>
              )}

              {!useDenomSwap && (
                <span className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono leading-relaxed">
                  Off — your exact swap amount is visible on-chain. Enable to split into common denominations that blend in with other users.
                </span>
              )}
            </div>
          )}

          {/* ── Price Info ──────────────────────────────────────── */}
          {amountValid && toAmountFormatted && !isProcessing && (
            <div className="mt-4 p-3 rounded-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[rgba(255,255,255,0.35)] font-mono">RATE</span>
                  <span className="font-mono text-[rgba(255,255,255,0.7)]">
                    1 {fromToken.symbol} &asymp;{" "}
                    {formatExchangeRate(exchangeRate)}{" "}
                    {toToken.symbol}
                  </span>
                </div>

                {priceImpactPct !== null && priceImpactPct > 1 && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[rgba(255,255,255,0.35)] font-mono">PRICE_IMPACT</span>
                    <span className={`font-mono font-bold ${priceImpactPct > 50 ? "text-red-400" : priceImpactPct > 10 ? "text-amber-400" : "text-[rgba(255,255,255,0.7)]"}`}>
                      {priceImpactPct > 99 ? ">99" : priceImpactPct.toFixed(1)}%
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[rgba(255,255,255,0.35)] font-mono">SLIPPAGE</span>
                  <span className="font-mono text-[rgba(255,255,255,0.7)]">
                    {(slippageBps / 100).toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[rgba(255,255,255,0.35)] font-mono">MIN_RECEIVED</span>
                  <span className="font-mono text-[rgba(255,255,255,0.7)]">
                    {minReceivedFormatted} {toToken.symbol}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[rgba(255,255,255,0.35)] font-mono">RELAYER_FEE</span>
                  <span className="font-mono text-[rgba(255,255,255,0.7)]">
                    {RELAYER_FEE_BPS / 100}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Processing Steps ──────────────────────────────── */}
          {isProcessing && (
            <div className="mt-4 p-3 rounded-sm bg-[rgba(0,255,65,0.03)] border border-[rgba(0,255,65,0.1)]">
              {shouldUseDenomSwap && denomProgress.total > 0 && (
                <div className="mb-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-widest font-mono">
                      PROGRESS
                    </span>
                    <span className="text-[10px] text-[#00FF41] font-mono font-bold">
                      {denomProgress.current}/{denomProgress.total}
                    </span>
                  </div>
                  <div className="h-1 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00FF41] rounded-full transition-all duration-300"
                      style={{ width: `${(denomProgress.current / denomProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2.5">
                {activeSteps.map((step, i) => {
                  const isActive = step === activeStatus;
                  const isComplete = currentStepIndex > i;

                  return (
                    <div key={step} className="flex items-center gap-2.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                        isComplete
                          ? "bg-[rgba(34,197,94,0.15)] border-[rgba(34,197,94,0.3)]"
                          : isActive
                          ? "bg-[rgba(0,255,65,0.15)] border-[rgba(0,255,65,0.3)]"
                          : "bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.06)]"
                      }`}>
                        {isComplete ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : isActive ? (
                          <div className="w-2.5 h-2.5 border-2 border-[#00FF41] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-[rgba(255,255,255,0.2)]" />
                        )}
                      </div>
                      <span className={`text-[11px] font-mono ${
                        isComplete
                          ? "text-[#22C55E]"
                          : isActive
                          ? "text-white font-bold"
                          : "text-[rgba(255,255,255,0.25)]"
                      }`}>
                        {(activeLabels as Record<string, string>)[step]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Success State ───────────────────────────────────── */}
          {activeStatus === "done" && (
            <div className="mt-4 p-4 rounded-sm bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.15)]">
              <div className="flex items-center gap-2 mb-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-[13px] font-bold text-[#22C55E] font-mono">SWAP_COMPLETE</span>
              </div>

              {(outputNote || denomTxHashes.length > 0) && (
                <div className="text-[11px] text-[rgba(255,255,255,0.5)] font-mono mb-2">
                  Received {(() => {
                    if (outputNote) {
                      const rawHex = outputNote.amount.replace('0x', '');
                      const amountBigint = rawHex ? BigInt(`0x${rawHex}`) : 0n;
                      if (amountBigint > 0n) {
                        return parseFloat(formatUnits(amountBigint, toToken.decimals)).toFixed(toToken.decimals > 6 ? 6 : 2);
                      }
                    }
                    return toAmountFormatted;
                  })()} {toToken.symbol} as shielded UTXO{denomTxHashes.length > 1 ? "s" : ""}
                </div>
              )}

              {(() => {
                const humanAmt = parseFloat(formatUnits(amountInWei, fromToken.decimals));
                const usd = fromToken.address === ETH_ADDRESS ? humanAmt * (oraclePrice ?? 0) : humanAmt;
                return usd >= COMPLIANCE_COOLDOWN_THRESHOLD_USD;
              })() && (
                <div className="text-[10px] text-[rgba(255,176,0,0.8)] font-mono mb-3">
                  Available after 1hr compliance cooldown
                </div>
              )}

              {activeTxHash && (
                <a
                  href={`${explorerBase}/tx/${activeTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] font-mono text-[#00FF41] hover:underline"
                >
                  View transaction: {activeTxHash.slice(0, 10)}...{activeTxHash.slice(-8)}
                  {denomTxHashes.length > 1 && ` (+${denomTxHashes.length - 1} more)`}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
                  </svg>
                </a>
              )}
            </div>
          )}

          {/* ── Error State ─────────────────────────────────────── */}
          {activeStatus === "error" && activeError && (
            <div className="mt-4 p-3 rounded-sm bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.15)]">
              <div className="flex items-start gap-2">
                <AlertCircleIcon size={14} color="rgb(239,68,68)" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-[rgb(239,68,68)] font-mono">SWAP: FAILED</span>
                  <span className="text-[11px] text-[rgba(255,255,255,0.4)] font-mono">{activeError}</span>
                </div>
              </div>
            </div>
          )}

          {/* Inline warnings — compact, no layout expansion */}
          {!isProcessing && ((priceImpactPct !== null && priceImpactPct > 50) || insufficientBalance) && (
            <div className="mt-2 flex flex-col gap-1">
              {priceImpactPct !== null && priceImpactPct > 50 && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm bg-[rgba(239,68,68,0.06)]">
                  <AlertCircleIcon size={10} color="rgb(239,68,68)" />
                  <span className="text-[9px] text-red-400 font-mono">
                    Price impact {priceImpactPct > 99 ? ">99" : priceImpactPct.toFixed(0)}% — low liquidity
                  </span>
                </div>
              )}
              {insufficientBalance && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm bg-[rgba(239,68,68,0.04)]">
                  <AlertCircleIcon size={10} color="rgb(239,68,68)" />
                  <span className="text-[9px] text-[rgba(239,68,68,0.8)] font-mono">
                    Insufficient {fromToken.symbol}.{" "}
                    <button
                      className="text-[#00FF41] underline font-bold hover:opacity-80 transition-opacity"
                      onClick={() => setShowDepositModal(true)}
                    >
                      Deposit
                    </button>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* PIN prompt moved to top of card — no longer inline here */}

          {/* Swap / Reset Button */}
          <button
            onClick={
              activeStatus === "done" || activeStatus === "error"
                ? handleReset
                : buttonDisabled
                ? undefined
                : handleSwapOrUnlock
            }
            disabled={activeStatus !== "error" && activeStatus !== "done" && buttonDisabled}
            className={`w-full mt-5 py-3 px-4 rounded-sm font-bold font-mono text-sm tracking-wider transition-all ${
              activeStatus === "done"
                ? "bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.2)] text-[#22C55E] hover:bg-[rgba(34,197,94,0.15)] cursor-pointer"
                : activeStatus !== "error" && buttonDisabled
                ? "bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.25)] cursor-not-allowed opacity-50"
                : "bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] text-[#00FF41] hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41] hover:shadow-[0_0_15px_rgba(0,255,65,0.15)] cursor-pointer"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              {isProcessing && (
                <div className="w-4 h-4 border-2 border-[#00FF41] border-t-transparent rounded-full animate-spin" />
              )}
              <span>{getButtonContent()}</span>
            </div>
          </button>
        </div>
      </div>

      <V2DepositModal
        isOpen={showDepositModal}
        onClose={() => {
          setShowDepositModal(false);
          refreshBalances();
          onPoolChange?.();
          setTimeout(() => { refreshBalances(); onPoolChange?.(); }, 1500);
        }}
        keysRef={keysRef}
        chainId={activeChainId}
        hasKeys={hasKeys}
        hasPin={hasPin}
        onDeriveKeys={deriveKeys}
        isDeriving={isDeriving}
        keyError={keyError}
      />
    </div>
  );
}
