"use client";

import { useState, useEffect, useCallback, useMemo, useRef, type RefObject, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { parseEther, parseUnits, formatEther, formatUnits, isAddress, zeroAddress, type Address } from "viem";
import { useAccount } from "wagmi";
import { useV2Withdraw, useV2Notes, useV2Split } from "@/hooks/dustpool/v2";
import { useV2Compliance } from "@/hooks/dustpool/v2/useV2Compliance";
import { useChainlinkPrice } from "@/hooks/swap/useChainlinkPrice";
import { COMPLIANCE_COOLDOWN_THRESHOLD_USD } from "@/lib/dustpool/v2/constants";
import { computeAssetId } from "@/lib/dustpool/v2/commitment";
import { getChainConfig, DEFAULT_CHAIN_ID } from "@/config/chains";
import {
  ShieldCheckIcon,
  AlertCircleIcon,
  XIcon,
  InfoIcon,
  USDCIcon,
  TokenIcon,
  ChainIcon,
} from "@/components/stealth/icons";
import type { V2Keys } from "@/lib/dustpool/v2/types";
import { errorToUserMessage } from "@/lib/dustpool/v2/errors";
import { decomposeForToken, formatChunks, suggestRoundedAmounts } from "@/lib/dustpool/v2/denominations";

interface KnownToken {
  symbol: string;
  decimals: number;
  address: Address;
  icon: (size: number) => ReactNode;
  assetId: bigint;
}

interface V2WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  keysRef: RefObject<V2Keys | null>;
  chainId?: number;
  balances: Map<bigint, bigint>;
}

export function V2WithdrawModal({
  isOpen,
  onClose,
  keysRef,
  chainId,
  balances,
}: V2WithdrawModalProps) {
  const { address } = useAccount();
  const { withdraw, isPending, status, txHash, error, clearError } = useV2Withdraw(keysRef, chainId);
  const { split, isPending: isSplitPending, status: splitStatus, error: splitError, clearError: clearSplitError } = useV2Split(keysRef, chainId);
  const { unspentNotes, refreshNotes } = useV2Notes(keysRef, chainId);
  const { checkCooldown, cooldown } = useV2Compliance(chainId);
  const { price: chainlinkPrice } = useChainlinkPrice();

  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selectedAssetIdx, setSelectedAssetIdx] = useState(0);

  const nativeSymbol = useMemo(() => {
    try { return getChainConfig(chainId).nativeCurrency.symbol; } catch { return "Native"; }
  }, [chainId]);

  // Resolve known token assetIds for this chain
  const usdcTokenAddress = useMemo((): Address | null => {
    try {
      const addr = getChainConfig(chainId).contracts.dustSwapVanillaPoolKey?.currency1;
      return addr ? (addr as Address) : null;
    } catch {
      return null;
    }
  }, [chainId]);

  const [knownAssetIds, setKnownAssetIds] = useState<{ eth: bigint | null; usdc: bigint | null }>({ eth: null, usdc: null });

  useEffect(() => {
    let cancelled = false;
    const resolvedChainId = chainId ?? DEFAULT_CHAIN_ID;
    const promises: [Promise<bigint>, Promise<bigint> | null] = [
      computeAssetId(resolvedChainId, zeroAddress),
      usdcTokenAddress ? computeAssetId(resolvedChainId, usdcTokenAddress) : null,
    ];

    Promise.all([promises[0], promises[1] ?? Promise.resolve(null)]).then(([ethId, usdcId]) => {
      if (!cancelled) setKnownAssetIds({ eth: ethId, usdc: usdcId });
    });

    return () => { cancelled = true; };
  }, [chainId, usdcTokenAddress]);

  // Build list of available assets with non-zero balances
  const availableAssets = useMemo((): KnownToken[] => {
    const assets: KnownToken[] = [];
    if (knownAssetIds.eth !== null) {
      const bal = balances.get(knownAssetIds.eth) ?? 0n;
      if (bal > 0n) {
        assets.push({
          symbol: nativeSymbol,
          decimals: 18,
          address: zeroAddress,
          icon: (size: number) => <TokenIcon symbol={nativeSymbol} size={size} />,
          assetId: knownAssetIds.eth!,
        });
      }
    }
    if (knownAssetIds.usdc !== null && usdcTokenAddress) {
      const bal = balances.get(knownAssetIds.usdc) ?? 0n;
      if (bal > 0n) {
        assets.push({
          symbol: "USDC",
          decimals: 6,
          address: usdcTokenAddress,
          icon: (size: number) => <USDCIcon size={size} />,
          assetId: knownAssetIds.usdc!,
        });
      }
    }
    return assets;
  }, [knownAssetIds, balances, usdcTokenAddress, nativeSymbol]);

  const selectedAsset = availableAssets[selectedAssetIdx] ?? availableAssets[0] ?? null;
  const selectedBalance = selectedAsset ? (balances.get(selectedAsset.assetId) ?? 0n) : 0n;

  // Reset state and refresh notes when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setRecipient(address ?? "");
      setSelectedAssetIdx(0);
      refreshNotes();
    }
  }, [isOpen, address, refreshNotes]);

  // Clear amount when switching assets
  const handleAssetSelect = (idx: number) => {
    setSelectedAssetIdx(idx);
    setAmount("");
  };

  // Parse amount using correct decimals for selected asset
  const parsedAmount = useMemo((): bigint | null => {
    if (!selectedAsset) return null;
    try {
      const num = parseFloat(amount);
      if (isNaN(num) || num <= 0) return null;
      return selectedAsset.decimals === 18
        ? parseEther(amount)
        : parseUnits(amount, selectedAsset.decimals);
    } catch {
      return null;
    }
  }, [amount, selectedAsset]);

  const formatAmount = useCallback((val: bigint): string => {
    if (!selectedAsset) return "0";
    return selectedAsset.decimals === 18
      ? formatEther(val)
      : formatUnits(val, selectedAsset.decimals);
  }, [selectedAsset]);

  const exceedsBalance = parsedAmount !== null && parsedAmount > selectedBalance;
  const isValidRecipient = isAddress(recipient);

  // Filter notes by selected asset for note consumption preview
  const filteredNotes = useMemo(() => {
    if (!selectedAsset) return [];
    return unspentNotes.filter(n => n.note.asset === selectedAsset.assetId);
  }, [unspentNotes, selectedAsset]);

  // Find note that will be consumed (smallest note >= amount)
  const consumedNote = useMemo(() => {
    if (!parsedAmount) return null;
    const eligible = filteredNotes
      .filter(n => n.leafIndex >= 0 && n.note.amount >= parsedAmount)
      .sort((a, b) => {
        const diff = a.note.amount - b.note.amount;
        if (diff < 0n) return -1;
        if (diff > 0n) return 1;
        return 0;
      });
    return eligible[0] ?? null;
  }, [parsedAmount, filteredNotes]);

  const changeAmount = consumedNote && parsedAmount
    ? consumedNote.note.amount - parsedAmount
    : null;

  // Check cooldown on consumed note
  useEffect(() => {
    if (!consumedNote) return;
    const commitmentHex = ("0x" + consumedNote.commitment.toString(16).padStart(64, "0")) as `0x${string}`;
    checkCooldown(commitmentHex);
  }, [consumedNote, checkCooldown]);

  // Countdown timer
  useEffect(() => {
    if (cooldown?.inCooldown && cooldown.remainingSeconds > 0) {
      setCooldownRemaining(cooldown.remainingSeconds);
      cooldownTimerRef.current = setInterval(() => {
        setCooldownRemaining(prev => {
          if (prev <= 1) {
            if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCooldownRemaining(0);
    }
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, [cooldown]);

  const cooldownActive = cooldownRemaining > 0;
  const cooldownOriginator = cooldown?.originator;
  const recipientMatchesOriginator = cooldownOriginator
    ? recipient.toLowerCase() === cooldownOriginator.toLowerCase()
    : false;

  // Compliance cooldown threshold: only ETH amounts use Chainlink price for USD conversion
  const amountExceedsThreshold = useMemo(() => {
    if (parsedAmount === null) return false;
    if (!selectedAsset) return false;
    if (selectedAsset.symbol === "USDC") {
      const usdValue = parseFloat(formatUnits(parsedAmount, 6));
      return usdValue >= COMPLIANCE_COOLDOWN_THRESHOLD_USD;
    }
    if (chainlinkPrice != null) {
      return (parseFloat(formatEther(parsedAmount)) * chainlinkPrice) >= COMPLIANCE_COOLDOWN_THRESHOLD_USD;
    }
    return true;
  }, [parsedAmount, selectedAsset, chainlinkPrice]);

  const cooldownBlocksSubmit = cooldownActive && !recipientMatchesOriginator && amountExceedsThreshold;

  const formatCooldownTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const canWithdraw = parsedAmount !== null && !exceedsBalance && isValidRecipient && !isPending && !isSplitPending && !cooldownBlocksSubmit;

  const tokenSymbol = selectedAsset?.symbol ?? nativeSymbol;
  const chunks = parsedAmount ? decomposeForToken(parsedAmount, tokenSymbol) : [];
  const formattedChunkValues = chunks.length > 0 ? formatChunks(chunks, tokenSymbol) : [];
  const roundSuggestions = parsedAmount && chunks.length > 1
    ? suggestRoundedAmounts(parsedAmount, tokenSymbol, 2)
    : [];

  const useSplitFlow = chunks.length > 1;
  const activePending = useSplitFlow ? isSplitPending : isPending;
  const activeStatus = useSplitFlow ? splitStatus : status;
  const activeError = useSplitFlow ? splitError : error;
  const activeClearError = useSplitFlow ? clearSplitError : clearError;

  const handleWithdraw = async () => {
    if (!parsedAmount || !isValidRecipient || !selectedAsset) return;
    const assetAddr = selectedAsset.address;
    if (useSplitFlow) {
      await split(parsedAmount, recipient as Address, assetAddr);
    } else {
      await withdraw(parsedAmount, recipient as Address, assetAddr);
    }
  };

  const handleClose = useCallback(() => {
    if (!activePending) onClose();
  }, [activePending, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !activePending) handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, activePending, handleClose]);

  const handleMaxClick = () => {
    if (selectedBalance > 0n) {
      setAmount(formatAmount(selectedBalance));
    }
  };

  const isSuccess = txHash !== null && !activePending && !activeError;
  const formattedMax = selectedAsset
    ? parseFloat(formatAmount(selectedBalance)).toFixed(selectedAsset.decimals === 6 ? 2 : 4)
    : "0";

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
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white font-mono tracking-wider">
                  [ WITHDRAW_V2 ]
                </span>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)]">
                  <ChainIcon size={14} chainId={chainId} />
                  <span className="text-[9px] text-[rgba(255,255,255,0.5)] font-mono">{getChainConfig(chainId).name}</span>
                </span>
              </div>
              {!activePending && (
                <button onClick={handleClose} data-testid="modal-close" className="text-[rgba(255,255,255,0.4)] hover:text-white transition-colors">
                  <XIcon size={20} />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4">
              {/* Input state */}
              {!activePending && !isSuccess && !activeError && (
                <>
                  {/* Asset selector — only show when multiple assets available */}
                  {availableAssets.length > 1 && (
                    <div className="flex gap-2">
                      {availableAssets.map((asset, idx) => {
                        const isSelected = idx === selectedAssetIdx;
                        const bal = balances.get(asset.assetId) ?? 0n;
                        const displayBal = asset.decimals === 18
                          ? parseFloat(formatEther(bal)).toFixed(4)
                          : parseFloat(formatUnits(bal, asset.decimals)).toFixed(2);
                        return (
                          <button
                            key={asset.symbol}
                            onClick={() => handleAssetSelect(idx)}
                            className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-sm border font-mono text-xs transition-all ${
                              isSelected
                                ? "border-[#00EF8B] bg-[rgba(0,239,139,0.08)] text-[#00EF8B]"
                                : "border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] text-[rgba(255,255,255,0.5)] hover:border-[rgba(255,255,255,0.2)] hover:text-white"
                            }`}
                          >
                            {asset.icon(16)}
                            <span className="font-bold">{asset.symbol}</span>
                            <span className="ml-auto text-[10px] opacity-60">{displayBal}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Shielded balance */}
                  <div className="p-4 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)]">
                    <p className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono mb-1">
                      Shielded Balance
                    </p>
                    <p className="text-2xl font-extrabold text-white font-mono flex items-baseline gap-2">
                      {formattedMax} <span className="text-base font-semibold text-[rgba(255,255,255,0.5)] flex items-center gap-1">
                        {selectedAsset ? selectedAsset.icon(16) : <TokenIcon symbol={nativeSymbol} size={16} />}
                        {tokenSymbol}
                      </span>
                    </p>
                    <p className="text-xs text-[rgba(255,255,255,0.4)] font-mono mt-1">
                      {filteredNotes.length} unspent note{filteredNotes.length !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* Amount input */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
                        Withdraw Amount ({tokenSymbol})
                      </label>
                      <button
                        onClick={handleMaxClick}
                        className="text-[10px] text-[#00EF8B] font-mono hover:underline"
                      >
                        MAX
                      </button>
                    </div>
                    <input
                      data-testid="withdraw-amount"
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
                      <p className="text-[11px] text-red-400 font-mono">Amount exceeds shielded balance</p>
                    )}
                  </div>

                  {/* Note consumption preview */}
                  {consumedNote && parsedAmount && (
                    <div className="p-3 rounded-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
                      <p className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono mb-2">
                        Note Selection
                      </p>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] text-[rgba(255,255,255,0.4)] font-mono">Input note</span>
                        <span className="text-[11px] font-semibold text-white font-mono flex items-center gap-1">
                          {parseFloat(formatAmount(consumedNote.note.amount)).toFixed(6)} <TokenIcon symbol={tokenSymbol} size={12} /> {tokenSymbol}
                        </span>
                      </div>
                      {changeAmount !== null && changeAmount > 0n && (
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-[rgba(255,255,255,0.4)] font-mono">Change returned</span>
                          <span className="text-[11px] font-semibold text-[#00EF8B] font-mono flex items-center gap-1">
                            {parseFloat(formatAmount(changeAmount)).toFixed(6)} <TokenIcon symbol={tokenSymbol} size={12} /> {tokenSymbol}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Denomination chunk preview */}
                  {parsedAmount && chunks.length > 1 && !exceedsBalance && (
                    <div className="p-3 rounded-sm bg-[rgba(0,239,139,0.03)] border border-[rgba(0,239,139,0.1)]">
                      <p className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono mb-2">
                        Privacy Split &mdash; {chunks.length} chunks
                      </p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {formattedChunkValues.map((val, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-sm bg-[rgba(0,239,139,0.08)] border border-[rgba(0,239,139,0.15)] text-[10px] font-mono text-[#00EF8B] inline-flex items-center gap-1"
                          >
                            <TokenIcon symbol={tokenSymbol} size={10} />{val} {tokenSymbol}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-[rgba(255,255,255,0.35)] font-mono">
                        Each chunk blends into its denomination anonymity set.
                      </p>
                      {roundSuggestions.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                          <p className="text-[10px] text-[rgba(255,255,255,0.4)] font-mono mb-1">
                            Fewer chunks = better privacy:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {roundSuggestions.map((s, i) => (
                              <button
                                key={i}
                                onClick={() => setAmount(s.formatted)}
                                className="px-2 py-0.5 rounded-sm bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] hover:border-[#00EF8B] text-[10px] font-mono text-[rgba(255,255,255,0.6)] hover:text-[#00EF8B] transition-colors"
                              >
                                {s.formatted} {tokenSymbol} ({s.chunks} chunk{s.chunks !== 1 ? "s" : ""})
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recipient input */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
                      Recipient Address
                    </label>
                    <input
                      data-testid="withdraw-recipient"
                      type="text"
                      placeholder="0x..."
                      value={recipient}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipient(e.target.value)}
                      className="w-full p-3 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-white font-mono text-sm focus:outline-none focus:border-[#00EF8B] focus:bg-[rgba(0,239,139,0.02)] transition-all placeholder-[rgba(255,255,255,0.2)]"
                    />
                    {recipient && !isValidRecipient && (
                      <p className="text-[11px] text-red-400 font-mono">Invalid address</p>
                    )}
                    <p className="text-[11px] text-[rgba(255,255,255,0.3)] font-mono">
                      Use a fresh address for maximum privacy. Defaults to connected wallet.
                    </p>
                  </div>

                  {/* Cooldown warning — only for amounts >= $10K USD */}
                  {cooldownActive && consumedNote && amountExceedsThreshold && (
                    <div className="p-3 rounded-sm bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)]">
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 mt-0.5">
                          <InfoIcon size={14} color="#FFB000" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <p className="text-xs text-amber-400 font-semibold font-mono">
                            Deposit in cooldown &mdash; {formatCooldownTime(cooldownRemaining)} remaining
                          </p>
                          {cooldownOriginator && (
                            <p className="text-[11px] text-[rgba(255,255,255,0.4)] font-mono leading-relaxed">
                              Withdrawal must go to original depositor:{" "}
                              <span className="text-[rgba(255,255,255,0.6)] break-all">{cooldownOriginator}</span>
                            </p>
                          )}
                          {cooldownBlocksSubmit && (
                            <p className="text-[11px] text-red-400 font-mono">
                              Change recipient to the original depositor, or wait for cooldown to expire.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Relayer fee notice */}
                  <div className="p-2.5 rounded-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
                    <p className="text-[11px] text-[rgba(255,255,255,0.4)] font-mono">
                      Withdrawal is processed via relayer. A small fee may apply to cover gas.
                    </p>
                  </div>

                  {/* Withdraw button */}
                  <button
                    data-testid="withdraw-submit"
                    onClick={handleWithdraw}
                    disabled={!canWithdraw}
                    className="w-full py-3 rounded-sm bg-[rgba(0,239,139,0.1)] border border-[rgba(0,239,139,0.2)] hover:bg-[rgba(0,239,139,0.15)] hover:border-[#00EF8B] hover:shadow-[0_0_15px_rgba(0,239,139,0.15)] transition-all text-sm font-bold text-[#00EF8B] font-mono tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {parsedAmount
                      ? useSplitFlow
                        ? `Split & Withdraw ${amount} ${tokenSymbol}`
                        : `Withdraw ${amount} ${tokenSymbol}`
                      : "Enter Amount"}
                  </button>
                </>
              )}

              {/* Processing */}
              {activePending && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-8 h-8 border-2 border-[#00EF8B] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-semibold text-white font-mono">
                    {activeStatus || (useSplitFlow ? "Generating denomination split proof..." : "Generating ZK proof...")}
                  </p>
                  {useSplitFlow ? (
                    <div className="flex items-center gap-2 text-[10px] text-[rgba(255,255,255,0.3)] font-mono">
                      <span className="text-[#00EF8B]">proof</span>
                      <span>&rarr;</span>
                      <span className={activeStatus?.includes("Verifying") ? "text-[#00EF8B]" : ""}>verify</span>
                      <span>&rarr;</span>
                      <span className={activeStatus?.includes("Submitting") ? "text-[#00EF8B]" : ""}>submit</span>
                      <span>&rarr;</span>
                      <span className={activeStatus?.includes("Confirming") ? "text-[#00EF8B]" : ""}>confirm</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[10px] text-[rgba(255,255,255,0.3)] font-mono">
                      <span className="text-[#00EF8B]">proof</span>
                      <span>&rarr;</span>
                      <span className={activeStatus?.includes("Submitting") || activeStatus?.includes("Confirming") ? "text-[#00EF8B]" : ""}>submit</span>
                      <span>&rarr;</span>
                      <span className={activeStatus?.includes("Confirming") ? "text-[#00EF8B]" : ""}>confirm</span>
                    </div>
                  )}
                </div>
              )}

              {/* Success */}
              {isSuccess && (
                <div className="flex flex-col gap-4">
                  <div className="text-center py-2">
                    <div className="inline-flex mb-3">
                      <ShieldCheckIcon size={40} color="#00EF8B" />
                    </div>
                    <p className="text-base font-bold text-white mb-1 font-mono">
                      {useSplitFlow ? "Denomination Split Successful" : "Withdrawal Successful"}
                    </p>
                    <p className="text-[13px] text-[rgba(255,255,255,0.5)] font-mono">{amount} {tokenSymbol} withdrawn privately</p>
                  </div>

                  {useSplitFlow && (
                    <div className="p-3 rounded-sm bg-[rgba(0,239,139,0.04)] border border-[rgba(0,239,139,0.15)]">
                      <p className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono mb-2">
                        {chunks.length} denomination notes created
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {formattedChunkValues.map((val, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-sm bg-[rgba(0,239,139,0.08)] border border-[rgba(0,239,139,0.15)] text-[10px] font-mono text-[#00EF8B]"
                          >
                            {val} {tokenSymbol}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {txHash && (
                    <div className="p-3 rounded-sm bg-[rgba(0,239,139,0.04)] border border-[rgba(0,239,139,0.15)]">
                      <p className="text-[11px] text-[rgba(255,255,255,0.4)] mb-1 font-mono">Transaction</p>
                      <p className="text-xs font-mono text-[#00EF8B] break-all">{txHash}</p>
                    </div>
                  )}

                  <div className="p-3 rounded-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
                    <p className="text-[11px] text-[rgba(255,255,255,0.4)] mb-1 font-mono">Recipient</p>
                    <p className="text-xs font-mono text-white break-all">{recipient}</p>
                  </div>

                  {changeAmount !== null && changeAmount > 0n && (
                    <div className="p-3 rounded-sm bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)]">
                      <p className="text-xs text-amber-400 font-semibold mb-1 font-mono">Change Note Saved</p>
                      <p className="text-[11px] text-[rgba(255,255,255,0.4)] leading-relaxed font-mono">
                        {parseFloat(formatAmount(changeAmount)).toFixed(6)} {tokenSymbol} returned as a new shielded note.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleClose}
                    className="w-full py-3 rounded-sm bg-[rgba(0,239,139,0.1)] border border-[rgba(0,239,139,0.2)] hover:bg-[rgba(0,239,139,0.15)] hover:border-[#00EF8B] transition-all text-sm font-bold text-[#00EF8B] font-mono tracking-wider"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Error */}
              {activeError && !activePending && (
                <div className="flex flex-col gap-4">
                  <div className="text-center py-2">
                    <div className="inline-flex mb-3">
                      <AlertCircleIcon size={40} color="#ef4444" />
                    </div>
                    <p className="text-base font-bold text-white mb-1 font-mono">
                      {useSplitFlow ? "Split Failed" : "Withdrawal Failed"}
                    </p>
                    <p className="text-[13px] text-[rgba(255,255,255,0.5)] font-mono">{errorToUserMessage(activeError)}</p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleClose}
                      className="flex-1 py-3 rounded-sm bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.07)] text-sm font-semibold text-white font-mono transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { activeClearError(); setAmount(""); }}
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
