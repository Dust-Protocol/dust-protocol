"use client";

import React, { useState, useEffect, ChangeEvent } from "react";
import { ethers } from "ethers";
import { getChainConfig } from "@/config/chains";
import { getTokensForChain, NATIVE_TOKEN_ADDRESS, type TokenConfig } from "@/config/tokens";
import { useStealthSend, useStealthName } from "@/hooks/stealth";
import { isStealthName, NAME_SUFFIX } from "@/lib/stealth";
import { useAuth } from "@/contexts/AuthContext";
import { useAccount } from "wagmi";
import { getChainProvider } from "@/lib/providers";
import { AlertCircleIcon as AlertIcon } from "@/components/stealth/icons";
import {
  CheckCircleIcon, AlertCircleIcon, LockIcon, ArrowUpRightIcon, TokenIcon,
} from "@/components/stealth/icons";
import { getExplorerBase } from "@/lib/design/tokens";

const ERC20_BALANCE_ABI = [
  "function balanceOf(address) view returns (uint256)",
];

export function SendForm() {
  const { activeChainId } = useAuth();
  const { address: walletAddress } = useAccount();
  const chainConfig = getChainConfig(activeChainId);
  const symbol = chainConfig.nativeCurrency.symbol;
  const tokens = getTokensForChain(activeChainId);
  const { generateAddressFor, sendEthToStealth, sendTokenToStealth, lastGeneratedAddress, isLoading, error: sendError } = useStealthSend(activeChainId);
  const { resolveName, isConfigured: nameRegistryConfigured } = useStealthName();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<string>(NATIVE_TOKEN_ADDRESS);
  const [sendStep, setSendStep] = useState<"input" | "confirm" | "success">("input");
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvedLinkSlug, setResolvedLinkSlug] = useState<string | undefined>(undefined);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [sendTxHash, setSendTxHash] = useState<string | null>(null);

  // H3: Fetch user's token balances for the token selector
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});
  const [nativeBalance, setNativeBalance] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    const fetchBalances = async () => {
      try {
        const provider = getChainProvider(activeChainId);
        // Fetch native balance
        const ethBal = await provider.getBalance(walletAddress);
        if (!cancelled) {
          setNativeBalance(parseFloat(ethers.utils.formatEther(ethBal)).toFixed(4));
        }
        // Fetch ERC-20 balances
        const balMap: Record<string, string> = {};
        await Promise.allSettled(
          tokens.map(async (t) => {
            const erc20 = new ethers.Contract(t.address, ERC20_BALANCE_ABI, provider);
            const bal: ethers.BigNumber = await erc20.balanceOf(walletAddress);
            balMap[t.address] = parseFloat(ethers.utils.formatUnits(bal, t.decimals)).toFixed(
              t.decimals <= 6 ? 2 : 4
            );
          })
        );
        if (!cancelled) {
          setTokenBalances(balMap);
        }
      } catch (e) {
        console.warn("[SendForm] Failed to fetch token balances:", e);
      }
    };
    fetchBalances();
    return () => { cancelled = true; };
  }, [walletAddress, activeChainId, tokens]);

  const isNativeToken = selectedToken === NATIVE_TOKEN_ADDRESS;
  const selectedTokenConfig: TokenConfig | undefined = tokens.find(t => t.address === selectedToken);
  const displaySymbol = isNativeToken ? symbol : (selectedTokenConfig?.symbol ?? symbol);

  useEffect(() => {
    const resolve = async () => {
      setResolveError(null);
      setResolvedLinkSlug(undefined);
      if (!recipient) { setResolvedAddress(null); return; }
      if (recipient.startsWith("st:")) { setResolvedAddress(recipient); return; }
      if (nameRegistryConfigured && isStealthName(recipient)) {
        setIsResolving(true);
        let nameToResolve = recipient;
        const normalized = recipient.toLowerCase().trim();
        if (normalized.endsWith(NAME_SUFFIX)) {
          const withoutSuffix = normalized.slice(0, -NAME_SUFFIX.length);
          const parts = withoutSuffix.split(".");
          if (parts.length > 1) {
            nameToResolve = parts[parts.length - 1] + NAME_SUFFIX;
            setResolvedLinkSlug(parts[0]);
          }
        }
        const resolved = await resolveName(nameToResolve);
        setIsResolving(false);
        if (resolved) {
          setResolvedAddress(`st:thanos:${resolved}`);
        } else {
          setResolvedAddress(null);
          setResolvedLinkSlug(undefined);
          setResolveError(`Name "${nameToResolve.replace(NAME_SUFFIX, "")}" not found`);
        }
        return;
      }
      setResolvedAddress(null);
    };
    const t = setTimeout(resolve, 300);
    return () => clearTimeout(t);
  }, [recipient, nameRegistryConfigured, resolveName]);

  const handlePreview = () => {
    const addr = resolvedAddress || recipient;
    if (!addr || !amount) return;
    if (generateAddressFor(addr)) setSendStep("confirm");
  };

  const handleSend = async () => {
    const addr = resolvedAddress || recipient;
    let hash: string | null;
    if (isNativeToken) {
      hash = await sendEthToStealth(addr, amount, resolvedLinkSlug);
    } else {
      hash = await sendTokenToStealth(addr, selectedToken, amount);
    }
    if (hash) { setSendTxHash(hash); setSendStep("success"); }
  };

  const reset = () => {
    setRecipient(""); setAmount(""); setSelectedToken(NATIVE_TOKEN_ADDRESS); setSendStep("input");
    setSendTxHash(null); setResolvedAddress(null); setResolvedLinkSlug(undefined); setResolveError(null);
  };

  return (
    <div className="flex flex-col gap-5">
      {sendStep === "input" && (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-base font-semibold text-white">Send Private Payment</span>
            <span className="text-[13px] text-[rgba(255,255,255,0.4)]">Only the recipient can access these funds</span>
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[9px] uppercase tracking-wider font-mono text-[rgba(255,255,255,0.5)] mb-2 block">Recipient</label>
              <input
                className="w-full h-12 px-3.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-sm text-white text-sm placeholder:text-[rgba(255,255,255,0.25)] focus:outline-none focus:border-[#7c7fff] focus:shadow-[0_0_0_1px_rgba(124,127,255,0.3)] transition-colors font-mono"
                placeholder={`alice${NAME_SUFFIX} or st:thanos:0x...`}
                value={recipient}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setRecipient(e.target.value)}
              />
              <div className="h-5 mt-1.5">
                {isResolving && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 border border-[rgba(255,255,255,0.4)] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[11px] text-[rgba(255,255,255,0.4)]">Resolving...</span>
                  </div>
                )}
                {!isResolving && resolvedAddress && !recipient.startsWith("st:") && (
                  <div className="flex items-center gap-1.5">
                    <CheckCircleIcon size={11} color="#00d68f" />
                    <span className="text-[11px] text-[#00d68f]">Resolved: {resolvedAddress.slice(0, 28)}...</span>
                  </div>
                )}
                {!isResolving && resolveError && (
                  <div className="flex items-center gap-1.5">
                    <AlertIcon size={11} color="#ff6b6b" />
                    <span className="text-[11px] text-[#ff6b6b]">{resolveError}</span>
                  </div>
                )}
              </div>
            </div>
            {tokens.length > 0 && (
              <div>
                <label className="text-[9px] uppercase tracking-wider font-mono text-[rgba(255,255,255,0.5)] mb-2 block">Token</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    className="px-3 py-1.5 rounded-sm text-[13px] font-medium cursor-pointer transition-all duration-150"
                    style={{
                      background: isNativeToken ? "rgba(124,127,255,0.2)" : "rgba(255,255,255,0.04)",
                      color: isNativeToken ? "#fff" : "rgba(255,255,255,0.6)",
                      border: `1px solid ${isNativeToken ? "#7c7fff" : "rgba(255,255,255,0.06)"}`,
                    }}
                    onClick={() => setSelectedToken(NATIVE_TOKEN_ADDRESS)}
                  >
                    <span className="flex items-center gap-1.5"><TokenIcon symbol={symbol} size={16} />{symbol}</span>{nativeBalance !== null && <span className="text-[11px] ml-1 opacity-70">{nativeBalance}</span>}
                  </button>
                  {tokens.map((t: TokenConfig) => {
                    const isActive = selectedToken === t.address;
                    const bal = tokenBalances[t.address];
                    return (
                      <button
                        key={t.address}
                        className="px-3 py-1.5 rounded-sm text-[13px] font-medium cursor-pointer transition-all duration-150"
                        style={{
                          background: isActive ? "rgba(124,127,255,0.2)" : "rgba(255,255,255,0.04)",
                          color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
                          border: `1px solid ${isActive ? "#7c7fff" : "rgba(255,255,255,0.06)"}`,
                        }}
                        onClick={() => setSelectedToken(t.address)}
                      >
                        <span className="flex items-center gap-1.5"><TokenIcon symbol={t.symbol} size={16} />{t.symbol}</span>{bal !== undefined && <span className="text-[11px] ml-1 opacity-70">{bal}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <label className="text-[9px] uppercase tracking-wider font-mono text-[rgba(255,255,255,0.5)] mb-2 block">Amount</label>
              <input
                className="w-full h-14 px-3.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-sm text-white text-2xl font-medium placeholder:text-[rgba(255,255,255,0.25)] focus:outline-none focus:border-[#7c7fff] focus:shadow-[0_0_0_1px_rgba(124,127,255,0.3)] transition-colors font-mono"
                placeholder="0.0"
                type="number"
                step="0.001"
                min="0"
                value={amount}
                onKeyDown={(e) => { if (['-', 'e', 'E', '+'].includes(e.key)) e.preventDefault(); }}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const v = e.target.value;
                  if (v === '' || parseFloat(v) >= 0) setAmount(v);
                }}
              />
              <span className="text-[11px] text-[rgba(255,255,255,0.4)] mt-1.5 block">{displaySymbol} on {chainConfig.name}</span>
            </div>
          </div>
          <button
            className="h-12 w-full py-2 px-4 rounded-sm bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41] text-sm font-bold text-[#00FF41] font-mono transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handlePreview}
            disabled={(!resolvedAddress && !recipient.startsWith("st:")) || !amount || isLoading || isResolving}
          >
            Preview Payment
          </button>
        </>
      )}

      {sendStep === "confirm" && lastGeneratedAddress && (
        <>
          <div className="p-5 bg-[rgba(255,255,255,0.04)] rounded-sm border border-[rgba(255,255,255,0.06)]">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[rgba(255,255,255,0.4)]">Amount</span>
                <span className="text-[18px] font-semibold text-white font-mono">{amount} {displaySymbol}</span>
              </div>
              <div className="h-px bg-[rgba(255,255,255,0.06)]" />
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[rgba(255,255,255,0.4)]">To</span>
                <span className="text-[13px] text-white font-mono">
                  {recipient.includes(".dust") ? recipient : `${recipient.slice(0, 14)}...`}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-3.5 bg-[rgba(52,211,153,0.04)] rounded-sm border border-[rgba(52,211,153,0.1)]">
            <LockIcon size={16} color="#00d68f" />
            <span className="text-[12px] text-[rgba(255,255,255,0.5)]">This payment is private.</span>
          </div>
          <div className="flex gap-2.5">
            <button
              className="flex-1 h-11 px-4 rounded-sm bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-sm font-medium text-white hover:bg-[rgba(255,255,255,0.08)] transition-colors"
              onClick={() => setSendStep("input")}
            >
              Back
            </button>
            <button
              className="flex-[2] h-11 px-4 rounded-sm bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41] text-sm font-bold text-[#00FF41] font-mono transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              onClick={handleSend}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-[#00FF41] border-t-transparent rounded-full animate-spin" />
              ) : "Send Payment"}
            </button>
          </div>
        </>
      )}

      {sendStep === "success" && (
        <div className="flex flex-col items-center gap-6 py-7">
          <div className="p-4 bg-[rgba(52,211,153,0.08)] rounded-full">
            <CheckCircleIcon size={32} color="#00d68f" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[18px] font-semibold text-white">Payment Sent</span>
            <span className="text-[13px] text-[rgba(255,255,255,0.4)] text-center">{amount} {displaySymbol} sent privately</span>
          </div>
          {sendTxHash && (
            <a href={`${getExplorerBase(activeChainId)}/tx/${sendTxHash}`} target="_blank" rel="noopener noreferrer">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(255,255,255,0.06)] rounded-sm border border-[rgba(255,255,255,0.08)] hover:border-[#7c7fff] transition-colors cursor-pointer">
                <ArrowUpRightIcon size={13} color="#7c7fff" />
                <span className="text-[12px] text-[#7c7fff] font-medium">View on Explorer</span>
              </div>
            </a>
          )}
          <button
            className="h-11 px-7 rounded-sm bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41] text-sm font-bold text-[#00FF41] font-mono transition-all duration-150"
            onClick={reset}
          >
            Send Another
          </button>
        </div>
      )}

      {sendError && (
        <div className="flex items-center gap-1.5 p-3 px-3.5 bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.15)] rounded-sm">
          <AlertCircleIcon size={14} color="#ff6b6b" />
          <span className="text-[12px] text-[#ff6b6b]">{sendError}</span>
        </div>
      )}
    </div>
  );
}
