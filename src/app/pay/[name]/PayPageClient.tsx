"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo, type ChangeEvent } from "react";
import { useAccount, useConnect, useChainId, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { getExplorerBase } from "@/lib/design/tokens";
import { useStealthSend, useStealthName } from "@/hooks/stealth";
import { NAME_SUFFIX } from "@/lib/stealth";
import { getSupportedChains, getChainConfig, DEFAULT_CHAIN_ID } from "@/config/chains";
import { getTokensForChain, NATIVE_TOKEN_ADDRESS, type TokenConfig } from "@/config/tokens";
import { ChainIcon, TokenIcon } from "@/components/stealth/icons";
import Link from "next/link";
import { NoOptInPayment } from "@/components/pay/NoOptInPayment";
import {
  AlertCircleIcon, ArrowUpRightIcon, LockIcon,
  WalletIcon, SendIcon, CopyIcon,
} from "@/components/stealth/icons";
import { DustLogo } from "@/components/DustLogo";

// Only show chains that have core stealth contracts deployed (announcer + registry)
const SUPPORTED_CHAINS = getSupportedChains().filter(
  (c) => c.contracts.announcer && c.contracts.registry
);

// ─── Chain Selector ──────────────────────────────────────────────────────────
function PayChainSelector({
  selectedChainId,
  onChange,
}: {
  selectedChainId: number;
  onChange: (chainId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const chain = getChainConfig(selectedChainId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-sm border text-xs font-mono transition-all w-full ${
          open
            ? "border-[#00FF41] bg-[rgba(0,255,65,0.02)]"
            : "border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(0,255,65,0.2)]"
        }`}
      >
        <ChainIcon size={18} chainId={selectedChainId} />
        <span className="text-white font-medium flex-1 text-left">{chain.name}</span>
        <span className="text-[rgba(255,255,255,0.3)] text-[10px]">{chain.nativeCurrency.symbol}</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10"
          className={`text-[rgba(255,255,255,0.3)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-[#0a0d14] border border-[rgba(255,255,255,0.1)] rounded-sm min-w-[200px] z-50 overflow-hidden"
          style={{ boxShadow: "0 8px 32px -4px rgba(0,0,0,0.8)" }}
        >
          {SUPPORTED_CHAINS.map((c) => {
            const active = c.id === selectedChainId;
            return (
              <button
                key={c.id}
                onClick={() => { onChange(c.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-[11px] font-mono transition-all flex items-center gap-2.5 ${
                  active
                    ? "text-[#00FF41] bg-[rgba(0,255,65,0.05)]"
                    : "text-[rgba(255,255,255,0.6)] hover:bg-[rgba(0,255,65,0.05)] hover:text-[#00FF41]"
                }`}
              >
                <ChainIcon size={16} chainId={c.id} />
                <span className="flex-1">{c.name}</span>
                <span className="text-[rgba(255,255,255,0.3)] text-[10px]">{c.nativeCurrency.symbol}</span>
                {active && <span className="text-[#00FF41] text-xs">&#10003;</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Token Selector ──────────────────────────────────────────────────────────

interface TokenOption {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  isNative: boolean;
}

function PayTokenSelector({
  chainId,
  selectedToken,
  onChange,
}: {
  chainId: number;
  selectedToken: string;
  onChange: (address: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const tokens = useMemo((): TokenOption[] => {
    const chain = getChainConfig(chainId);
    const native: TokenOption = {
      address: NATIVE_TOKEN_ADDRESS,
      symbol: chain.nativeCurrency.symbol,
      name: chain.nativeCurrency.name,
      decimals: chain.nativeCurrency.decimals,
      isNative: true,
    };
    const erc20s: TokenOption[] = getTokensForChain(chainId).map((t: TokenConfig) => ({
      ...t, isNative: false,
    }));
    return [native, ...erc20s];
  }, [chainId]);

  const selected = tokens.find((t) => t.address === selectedToken) ?? tokens[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-2.5 rounded-sm border text-[11px] font-mono font-bold transition-all ${
          open
            ? "border-[#00FF41] bg-[rgba(0,255,65,0.1)] text-[#00FF41]"
            : "border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] text-white hover:border-[rgba(0,255,65,0.2)]"
        }`}
      >
        <TokenIcon symbol={selected.symbol} size={14} />
        <span>{selected.symbol}</span>
        <svg
          width="8" height="8" viewBox="0 0 10 10"
          className={`text-[rgba(255,255,255,0.3)] transition-transform duration-150 ml-0.5 ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 bg-[#0a0d14] border border-[rgba(255,255,255,0.1)] rounded-sm min-w-[180px] z-50 overflow-hidden"
          style={{ boxShadow: "0 8px 32px -4px rgba(0,0,0,0.8)" }}
        >
          {tokens.map((t) => {
            const active = t.address === selectedToken;
            return (
              <button
                key={t.address}
                onClick={() => { onChange(t.address); setOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-[11px] font-mono transition-all flex items-center gap-2.5 ${
                  active
                    ? "text-[#00FF41] bg-[rgba(0,255,65,0.05)]"
                    : "text-[rgba(255,255,255,0.6)] hover:bg-[rgba(0,255,65,0.05)] hover:text-[#00FF41]"
                }`}
              >
                <TokenIcon symbol={t.symbol} size={16} />
                <span className="flex-1 font-medium">{t.symbol}</span>
                <span className="text-[rgba(255,255,255,0.25)] text-[10px] font-normal">{t.name}</span>
                {active && <span className="text-[#00FF41] text-xs ml-1">&#10003;</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PayPageClient({ name }: { name: string }) {
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const walletChainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { resolveName, formatName, isConfigured } = useStealthName();

  // Cross-chain state
  const [selectedChainId, setSelectedChainId] = useState(DEFAULT_CHAIN_ID);
  const [selectedToken, setSelectedToken] = useState(NATIVE_TOKEN_ADDRESS);
  const [isSwitching, setIsSwitching] = useState(false);
  const chainConfig = getChainConfig(selectedChainId);
  const chainMismatch = isConnected && walletChainId !== selectedChainId;

  const { generateAddressFor, sendEthToStealth, sendTokenToStealth, isLoading, error: sendError } = useStealthSend(selectedChainId);

  const isNativeToken = selectedToken === NATIVE_TOKEN_ADDRESS;
  const selectedTokenConfig = useMemo(() => {
    if (isNativeToken) return null;
    return getTokensForChain(selectedChainId).find(
      (t) => t.address.toLowerCase() === selectedToken.toLowerCase()
    ) ?? null;
  }, [selectedChainId, selectedToken, isNativeToken]);

  const displaySymbol = isNativeToken
    ? chainConfig.nativeCurrency.symbol
    : (selectedTokenConfig?.symbol ?? "???");

  const handleChainChange = useCallback((chainId: number) => {
    setSelectedChainId(chainId);
    setSelectedToken(NATIVE_TOKEN_ADDRESS);
    setSendStep("input");
    setLocalError(null);
  }, []);

  const [activeTab, setActiveTab] = useState<"wallet" | "qr">("wallet");
  const [resolvedMeta, setResolvedMeta] = useState<string | null>(null);
  const [metaResolving, setMetaResolving] = useState(false);
  const resolvingRef = useRef(false);
  const [amount, setAmount] = useState("");
  const [sendStep, setSendStep] = useState<"input" | "confirm" | "success">("input");
  const [sendTxHash, setSendTxHash] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const fullName = formatName(name);

  const doResolve = useCallback(async (force = false) => {
    if ((!force && resolvedMeta) || resolvingRef.current) return;
    resolvingRef.current = true;
    setMetaResolving(true);
    setResolveError(false);
    try {
      // Server-side resolution avoids browser RPC timeouts
      const res = await fetch(`/api/resolve-meta/${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.metaAddress) {
          setResolvedMeta(`st:eth:${data.metaAddress}`);
          return;
        }
      }
      // Fallback: try client-side resolution if server fails
      if (isConfigured) {
        const resolved = await resolveName(name + NAME_SUFFIX);
        if (resolved) { setResolvedMeta(`st:eth:${resolved}`); return; }
        const resolved2 = await resolveName(name);
        if (resolved2) { setResolvedMeta(`st:thanos:${resolved2}`); return; }
      }
      setResolveError(true);
    } catch (e) {
      console.error('[pay] Name resolution failed:', e);
      setResolveError(true);
    } finally {
      resolvingRef.current = false;
      setMetaResolving(false);
    }
  }, [resolvedMeta, isConfigured, name, resolveName]);

  useEffect(() => { doResolve(); }, [doResolve]);

  const handlePreview = () => {
    if (!resolvedMeta || !amount) return;
    if (generateAddressFor(resolvedMeta)) setSendStep("confirm");
  };

  const handleSwitchChain = useCallback(async () => {
    setIsSwitching(true);
    setLocalError(null);
    try {
      await switchChain({ chainId: selectedChainId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to switch network';
      setLocalError(msg.includes('rejected') ? 'Network switch rejected' : `Failed to switch network`);
    } finally {
      setIsSwitching(false);
    }
  }, [switchChain, selectedChainId]);

  const handleSend = async () => {
    if (!resolvedMeta) return;
    setLocalError(null);
    let hash: string | null;
    if (isNativeToken) {
      hash = await sendEthToStealth(resolvedMeta, amount);
    } else {
      hash = await sendTokenToStealth(resolvedMeta, selectedToken, amount);
    }
    if (hash) { setSendTxHash(hash); setSendStep("success"); }
  };

  const resetPayment = () => {
    setSendStep("input");
    setAmount("");
    setSendTxHash(null);
  };

  const isSuccess = sendStep === "success";

  return (
    <div className="min-h-screen bg-[#06080F] text-white flex flex-col">

      {/* ── Header ── */}
      <header className="border-b border-white/[0.04] bg-[#06080F]/95 backdrop-blur-md sticky top-0 z-10">
        <div className="flex justify-between items-center max-w-[480px] mx-auto px-5 py-3.5">
          <Link href="/" className="no-underline">
            <div className="flex gap-2 items-center cursor-pointer">
              <DustLogo size={20} color="#00FF41" />
              <span className="text-[16px] font-bold text-white tracking-tight">Dust</span>
            </div>
          </Link>
          <div className="px-2.5 py-1 bg-[rgba(0,255,65,0.06)] border border-[rgba(0,255,65,0.15)] rounded-sm">
            <span className="text-[9px] text-[#00FF41] font-mono font-semibold tracking-wider uppercase">Payment</span>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 flex justify-center px-4 py-10">
        <div className="w-full max-w-[440px]">
          <div className="flex flex-col gap-4">

            {/* ── Main Card ── */}
            <div className="relative">
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[rgba(255,255,255,0.1)]" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[rgba(255,255,255,0.1)]" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[rgba(255,255,255,0.1)]" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[rgba(255,255,255,0.1)]" />

              <div className={`w-full rounded-md border overflow-hidden transition-all duration-300 ${
                isSuccess
                  ? "border-[rgba(34,197,94,0.3)] bg-[#06080F]"
                  : "border-[rgba(255,255,255,0.1)] bg-[#06080F]"
              }`}
                style={{ boxShadow: isSuccess ? "0 0 30px rgba(34,197,94,0.08)" : "0 4px 24px rgba(0,0,0,0.3)" }}
              >

                {/* ── Recipient Header ── */}
                <div className={`px-6 pt-7 pb-5 text-center border-b transition-all duration-300 ${
                  isSuccess ? "border-[rgba(34,197,94,0.15)]" : "border-[rgba(255,255,255,0.06)]"
                }`}>
                  <div className="flex flex-col items-center gap-3">
                    <div className={`p-3 rounded-sm transition-colors duration-300 ${
                      isSuccess ? "bg-[rgba(34,197,94,0.08)]" : "bg-[rgba(0,255,65,0.04)]"
                    }`}>
                      <DustLogo size={28} color={isSuccess ? "#22c55e" : "#00FF41"} />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-xl font-bold font-mono tracking-tight transition-colors duration-300 ${
                        isSuccess ? "text-green-400" : "text-[#00FF41]"
                      }`}>
                        {fullName}
                      </span>
                      <span className="text-[11px] text-[rgba(255,255,255,0.35)] font-mono">
                        {isSuccess ? "Private payment completed" : "Send a private payment"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Tab Switcher ── */}
                {!isSuccess && (
                  <div className="flex border-b border-[rgba(255,255,255,0.06)]">
                    {([
                      ["wallet", WalletIcon, "WALLET"],
                      ["qr", CopyIcon, "QR / ADDRESS"],
                    ] as const).map(([tab, Icon, label]) => {
                      const active = activeTab === tab;
                      return (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab as "wallet" | "qr")}
                          className={`flex-1 py-3 flex items-center justify-center gap-1.5 border-b-2 transition-all font-mono text-[10px] tracking-wider ${
                            active
                              ? "text-[#00FF41] border-[#00FF41]"
                              : "text-[rgba(255,255,255,0.35)] border-transparent hover:text-[rgba(255,255,255,0.5)]"
                          }`}
                        >
                          <Icon size={12} color={active ? "#00FF41" : "rgba(255,255,255,0.35)"} />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* ── Tab Content ── */}
                <div className="p-6">
                  {isSuccess ? (
                    <SuccessView
                      amount={amount}
                      symbol={displaySymbol}
                      fullName={fullName}
                      chainId={selectedChainId}
                      txHash={sendTxHash}
                      onSendAnother={resetPayment}
                    />
                  ) : activeTab === "wallet" ? (
                    <>
                      {metaResolving ? (
                        <div className="flex flex-col items-center gap-3 py-8">
                          <div className="w-5 h-5 border-2 border-[#00FF41] border-t-transparent rounded-full animate-spin" />
                          <span className="text-[11px] text-[rgba(255,255,255,0.35)] font-mono">Preparing payment...</span>
                        </div>
                      ) : resolveError ? (
                        <div className="flex flex-col items-center gap-3 py-8">
                          <AlertCircleIcon size={20} color="#ef4444" />
                          <span className="text-xs text-[#ef4444] font-mono">Could not resolve {fullName}</span>
                          <button
                            onClick={() => doResolve(true)}
                            className="text-[11px] text-[#00FF41] font-mono underline cursor-pointer bg-transparent border-none"
                          >
                            Retry
                          </button>
                        </div>
                      ) : !isConnected ? (
                        <div className="flex flex-col items-center gap-5 py-4">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="text-sm font-bold text-white font-mono">Connect to send</span>
                            <span className="text-[11px] text-[rgba(255,255,255,0.35)] font-mono text-center">
                              Connect your wallet to send a private payment
                            </span>
                          </div>
                          <button
                            onClick={() => connect({ connector: injected() })}
                            className="w-full py-3 rounded-sm border border-[#00FF41]/30 bg-[#00FF41]/[0.05] text-[#00FF41] font-mono text-xs font-semibold tracking-wider flex items-center justify-center gap-2 cursor-pointer hover:border-[#00FF41] hover:bg-[#00FF41]/[0.1] transition-all"
                            style={{ boxShadow: "0 0 12px rgba(0,255,65,0.05)" }}
                          >
                            <WalletIcon size={14} color="#00FF41" />
                            CONNECT WALLET
                          </button>
                          <span className="text-[10px] text-[rgba(255,255,255,0.25)] font-mono text-center">
                            Or switch to{" "}
                            <span
                              className="text-[#00FF41] cursor-pointer hover:underline"
                              onClick={() => setActiveTab("qr")}
                            >
                              QR / Address
                            </span>{" "}
                            to send from any wallet
                          </span>
                        </div>
                      ) : sendStep === "input" ? (
                        <div className="flex flex-col gap-4">
                          {/* Chain selector */}
                          <div>
                            <label className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono block mb-1.5">
                              Network
                            </label>
                            <PayChainSelector
                              selectedChainId={selectedChainId}
                              onChange={handleChainChange}
                            />
                          </div>

                          {/* Amount + Token */}
                          <div>
                            <label className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono block mb-1.5">
                              Amount
                            </label>
                            <div className="flex gap-2 items-center">
                              <input
                                placeholder="0.0"
                                type="number"
                                step="any"
                                min="0"
                                value={amount}
                                onKeyDown={(e) => { if (["-", "e", "E", "+"].includes(e.key)) e.preventDefault(); }}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                  const v = e.target.value;
                                  if (v === "" || parseFloat(v) >= 0) setAmount(v);
                                }}
                                className="flex-1 py-2.5 px-3 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-white font-mono text-sm font-semibold focus:outline-none focus:border-[#00FF41] focus:bg-[rgba(0,255,65,0.02)] placeholder-[rgba(255,255,255,0.2)] transition-all"
                              />
                              <PayTokenSelector
                                  chainId={selectedChainId}
                                  selectedToken={selectedToken}
                                  onChange={setSelectedToken}
                                />
                            </div>
                          </div>

                          {/* Preview button */}
                          <button
                            onClick={handlePreview}
                            disabled={!amount || !resolvedMeta}
                            className={`w-full py-3 rounded-sm font-mono text-xs font-semibold tracking-wider flex items-center justify-center gap-2 transition-all ${
                              amount && resolvedMeta
                                ? "border border-[rgba(0,255,65,0.2)] bg-[rgba(0,255,65,0.1)] text-[#00FF41] cursor-pointer hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41] hover:shadow-[0_0_15px_rgba(0,255,65,0.15)]"
                                : "border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] text-[rgba(255,255,255,0.3)] cursor-not-allowed"
                            }`}
                          >
                            PREVIEW PAYMENT
                          </button>
                        </div>
                      ) : (
                        <ConfirmView
                          amount={amount}
                          symbol={displaySymbol}
                          fullName={fullName}
                          chainName={chainConfig.name}
                          chainId={selectedChainId}
                          isNativeToken={isNativeToken}
                          isLoading={isLoading}
                          isSwitching={isSwitching}
                          chainMismatch={chainMismatch}
                          onBack={() => { setSendStep("input"); setLocalError(null); }}
                          onSend={handleSend}
                          onSwitchChain={handleSwitchChain}
                        />
                      )}

                      {(sendError || localError) && (
                        <div className="flex gap-2 items-center p-3 mt-3 rounded-sm bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.2)]">
                          <AlertCircleIcon size={13} color="#ef4444" />
                          <span className="text-[11px] text-[#ef4444] font-mono">{sendError || localError}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <NoOptInPayment recipientName={name} displayName={fullName} />
                  )}
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex justify-center pt-1">
              <Link href="/" className="no-underline">
                <span className="text-[11px] text-[rgba(255,255,255,0.25)] font-mono cursor-pointer hover:text-[rgba(255,255,255,0.5)] transition-colors">
                  Pay someone else
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm View ────────────────────────────────────────────────────────────

function ConfirmView({
  amount, symbol, fullName, chainName, chainId, isNativeToken,
  isLoading, isSwitching, chainMismatch, onBack, onSend, onSwitchChain,
}: {
  amount: string; symbol: string; fullName: string; chainName: string;
  chainId: number; isNativeToken: boolean;
  isLoading: boolean; isSwitching: boolean; chainMismatch: boolean;
  onBack: () => void; onSend: () => void; onSwitchChain: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="p-4 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-[rgba(255,255,255,0.4)] font-mono uppercase tracking-wider">Amount</span>
            <span className="text-lg font-bold text-white font-mono">{amount} {symbol}</span>
          </div>
          <div className="h-px bg-[rgba(255,255,255,0.06)]" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-[rgba(255,255,255,0.4)] font-mono uppercase tracking-wider">To</span>
            <span className="text-sm font-semibold text-[#00FF41] font-mono">{fullName}</span>
          </div>
          <div className="h-px bg-[rgba(255,255,255,0.06)]" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-[rgba(255,255,255,0.4)] font-mono uppercase tracking-wider">Network</span>
            <div className="flex items-center gap-1.5">
              <ChainIcon size={12} chainId={chainId} />
              <span className="text-xs text-[rgba(255,255,255,0.6)] font-mono">{chainName}</span>
            </div>
          </div>
          <div className="h-px bg-[rgba(255,255,255,0.06)]" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-[rgba(255,255,255,0.4)] font-mono uppercase tracking-wider">Fee</span>
            <span className="text-xs font-semibold text-green-400 font-mono">
              {isNativeToken ? "FREE (SPONSORED)" : "GAS ONLY"}
            </span>
          </div>
        </div>
      </div>

      {/* Privacy note */}
      <div className="flex gap-2 items-center p-3 rounded-sm bg-[rgba(0,255,65,0.03)] border border-[rgba(0,255,65,0.08)]">
        <LockIcon size={12} color="#00FF41" />
        <span className="text-[10px] text-[rgba(255,255,255,0.35)] font-mono">
          Stealth address — cannot be linked to {fullName}
        </span>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-sm border border-[rgba(255,255,255,0.08)] bg-transparent text-[rgba(255,255,255,0.5)] font-mono text-[11px] tracking-wider cursor-pointer hover:border-[rgba(255,255,255,0.2)] hover:text-[rgba(255,255,255,0.7)] transition-all"
        >
          BACK
        </button>
        <button
          onClick={chainMismatch ? onSwitchChain : onSend}
          disabled={isLoading || isSwitching}
          className={`flex-[2] py-3 rounded-sm font-mono text-[11px] tracking-wider flex items-center justify-center gap-2 transition-all ${
            isLoading || isSwitching
              ? "border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] text-[rgba(255,255,255,0.3)] cursor-wait"
              : chainMismatch
                ? "border border-[rgba(255,200,0,0.3)] bg-[rgba(255,200,0,0.06)] text-[#FFC800] cursor-pointer hover:bg-[rgba(255,200,0,0.1)] hover:border-[#FFC800]"
                : "border border-[rgba(0,255,65,0.2)] bg-[rgba(0,255,65,0.1)] text-[#00FF41] cursor-pointer hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41] hover:shadow-[0_0_15px_rgba(0,255,65,0.15)]"
          }`}
        >
          {isLoading || isSwitching ? (
            <>
              <div className={`w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin ${
                isSwitching ? "border-[#FFC800]" : "border-[#00FF41]"
              }`} />
              <span>{isSwitching ? "SWITCHING..." : "SENDING..."}</span>
            </>
          ) : chainMismatch ? (
            <span>SWITCH TO {chainName.toUpperCase()}</span>
          ) : (
            <>
              <SendIcon size={13} color="#00FF41" />
              <span>SEND PAYMENT</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Success View ────────────────────────────────────────────────────────────

function SuccessView({
  amount, symbol, fullName, chainId, txHash, onSendAnother,
}: {
  amount: string; symbol: string; fullName: string;
  chainId: number; txHash: string | null; onSendAnother: () => void;
}) {
  const chainConfig = getChainConfig(chainId);

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      {/* Check icon */}
      <div className="w-16 h-16 rounded-sm bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" stroke="#22c55e" strokeWidth="2.5" />
        </svg>
      </div>

      {/* Info */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm font-bold text-white font-mono tracking-wider">PAYMENT SENT</span>
        <div className="flex items-baseline gap-2">
          <span className="text-[28px] font-extrabold text-white font-mono">{amount}</span>
          <span className="text-base font-medium text-[rgba(255,255,255,0.4)]">{symbol}</span>
        </div>
        <span className="text-xs text-[rgba(255,255,255,0.4)] font-mono">
          sent to <span className="text-[#00FF41] font-semibold">{fullName}</span>
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <ChainIcon size={11} chainId={chainId} />
          <span className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono">{chainConfig.name}</span>
        </div>
      </div>

      {/* Explorer link */}
      {txHash && (
        <a
          href={`${getExplorerBase(chainId)}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="no-underline"
        >
          <div className="flex gap-1.5 items-center px-3 py-2 rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(0,255,65,0.2)] transition-all cursor-pointer">
            <ArrowUpRightIcon size={11} color="#00FF41" />
            <span className="text-[11px] text-[#00FF41] font-mono font-medium">View on Explorer</span>
          </div>
        </a>
      )}

      {/* Send another */}
      <button
        onClick={onSendAnother}
        className="text-[10px] text-[rgba(255,255,255,0.25)] font-mono cursor-pointer bg-transparent border-none hover:text-[rgba(255,255,255,0.5)] transition-colors"
      >
        Send another payment
      </button>
    </div>
  );
}
