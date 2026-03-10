"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStealthSend, useStealthName } from "@/hooks/stealth";
import { useAuth } from "@/contexts/AuthContext";
import { isStealthName, NAME_SUFFIX, lookupStealthMetaAddress, getRegistryForChain, SCHEME_ID } from "@/lib/stealth";
import { getChainConfig } from "@/config/chains";
import { getChainProvider } from "@/lib/providers";
import { ethers } from "ethers";
import { getExplorerBase } from "@/lib/design/tokens";
import {
  SendIcon, CheckCircleIcon, AlertCircleIcon, LockIcon,
  ArrowUpRightIcon, XIcon, ETHIcon,
} from "@/components/stealth/icons";

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SendModal({ isOpen, onClose }: SendModalProps) {
  const { activeChainId } = useAuth();
  const chainConfig = getChainConfig(activeChainId);
  const { generateAddressFor, sendEthToStealth, lastGeneratedAddress, isLoading, error: sendError } = useStealthSend(activeChainId);
  const { resolveName, isConfigured: nameRegistryConfigured } = useStealthName();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sendStep, setSendStep] = useState<"input" | "confirm" | "success">("input");
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvedLinkSlug, setResolvedLinkSlug] = useState<string | undefined>(undefined);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [sendTxHash, setSendTxHash] = useState<string | null>(null);

  useEffect(() => {
    const resolve = async () => {
      setResolveError(null);
      setResolvedLinkSlug(undefined);
      if (!recipient) { setResolvedAddress(null); return; }
      if (recipient.startsWith("st:")) { setResolvedAddress(recipient); return; }

      // Handle 0x addresses — look up stealth meta-address from ERC-6538 registry
      if (recipient.startsWith("0x") && recipient.length === 42) {
        setIsResolving(true);
        try {
          const provider = getChainProvider(activeChainId);
          const metaBytes = await lookupStealthMetaAddress(provider, recipient, SCHEME_ID.SECP256K1, getRegistryForChain(activeChainId));
          setIsResolving(false);
          if (metaBytes) {
            setResolvedAddress(`st:eth:0x${metaBytes.replace(/^0x/, "")}`);
          } else {
            setResolvedAddress(null);
            setResolveError("This address hasn't registered for stealth payments");
          }
        } catch {
          setIsResolving(false);
          setResolvedAddress(null);
          setResolveError("Failed to look up address");
        }
        return;
      }

      if (nameRegistryConfigured && isStealthName(recipient)) {
        setIsResolving(true);
        // Handle multi-part .dust names: "link.username.dust" → resolve "username", extract linkSlug
        // Single part: "username.dust" → resolve "username"
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
          setResolvedAddress(`st:eth:${resolved}`);
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
  }, [recipient, nameRegistryConfigured, resolveName, activeChainId]);

  const handlePreview = () => {
    const addr = resolvedAddress || recipient;
    if (!addr || !amount) return;
    if (generateAddressFor(addr)) setSendStep("confirm");
  };

  const handleSend = async () => {
    const hash = await sendEthToStealth(resolvedAddress || recipient, amount, resolvedLinkSlug);
    if (hash) { setSendTxHash(hash); setSendStep("success"); }
  };

  const reset = () => {
    setRecipient(""); setAmount(""); setSendStep("input");
    setSendTxHash(null); setResolvedAddress(null); setResolvedLinkSlug(undefined); setResolveError(null);
  };

  const handleClose = () => { reset(); onClose(); };

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
            className="relative w-full max-w-[440px] p-6 rounded-md border border-[rgba(255,255,255,0.1)] bg-[#06080F] shadow-2xl overflow-hidden"
          >
            {/* Header — hidden on success */}
            {sendStep !== "success" && (
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <SendIcon size={16} color="#00EF8B" />
                  <span className="text-sm font-bold text-white font-mono tracking-wider">
                    [ SEND ]
                  </span>
                </div>
                <button
                  onClick={handleClose}
                  className="text-[rgba(255,255,255,0.4)] hover:text-white transition-colors"
                >
                  <XIcon size={20} />
                </button>
              </div>
            )}

            {/* Input step */}
            {sendStep === "input" && (
              <div className="flex flex-col gap-5">
                {/* Recipient field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
                    Recipient
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={`alice${NAME_SUFFIX} or 0x...`}
                      value={recipient}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setRecipient(e.target.value)}
                      className={[
                        "w-full p-3 rounded-sm bg-[rgba(255,255,255,0.03)] border text-white font-mono text-sm",
                        "focus:outline-none focus:bg-[rgba(0,239,139,0.02)] transition-all placeholder-[rgba(255,255,255,0.2)]",
                        resolvedAddress
                          ? "border-[#00EF8B]"
                          : resolveError
                          ? "border-red-500"
                          : "border-[rgba(255,255,255,0.1)] focus:border-[#00EF8B]",
                      ].join(" ")}
                    />
                    {/* Status indicator inside input */}
                    {!isResolving && resolvedAddress && !recipient.startsWith("st:") && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        <CheckCircleIcon size={18} color="#00EF8B" />
                      </span>
                    )}
                    {isResolving && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        <span className="inline-block w-4 h-4 border-2 border-[#00EF8B] border-t-transparent rounded-full animate-spin" />
                      </span>
                    )}
                  </div>
                  <div className="h-4 mt-0.5">
                    {isResolving && (
                      <p className="text-[11px] text-[rgba(255,255,255,0.4)] font-mono">
                        {recipient.startsWith("0x") ? "Looking up address..." : "Looking up name..."}
                      </p>
                    )}
                    {!isResolving && resolvedAddress && !recipient.startsWith("st:") && (
                      <p className="text-[11px] text-[#00EF8B] font-mono font-semibold">
                        {recipient.startsWith("0x") ? "Address resolved" : "Name resolved"}
                      </p>
                    )}
                    {!isResolving && resolveError && (
                      <div className="flex items-center gap-1">
                        <AlertCircleIcon size={11} color="#ef4444" />
                        <p className="text-[11px] text-red-400 font-mono">{resolveError}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Amount field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
                    Amount
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const v = e.target.value;
                        if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
                      }}
                      className="w-full p-3 pr-16 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-white font-mono text-2xl font-bold focus:outline-none focus:border-[#00EF8B] focus:bg-[rgba(0,239,139,0.02)] transition-all placeholder-[rgba(255,255,255,0.2)]"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[rgba(255,255,255,0.5)] font-mono flex items-center gap-1">
                      <ETHIcon size={14} />
                      {chainConfig.nativeCurrency.symbol}
                    </div>
                  </div>
                  <p className="text-[11px] text-[rgba(255,255,255,0.4)] font-mono">{chainConfig.name}</p>
                </div>

                {/* Preview button */}
                <button
                  onClick={handlePreview}
                  disabled={(!resolvedAddress && !recipient.startsWith("st:")) || !amount || isLoading || isResolving}
                  className="w-full py-3 rounded-sm bg-[rgba(0,239,139,0.1)] border border-[rgba(0,239,139,0.2)] hover:bg-[rgba(0,239,139,0.15)] hover:border-[#00EF8B] hover:shadow-[0_0_15px_rgba(0,239,139,0.15)] transition-all text-sm font-bold text-[#00EF8B] font-mono tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  [ PREVIEW_PAYMENT ]
                </button>
              </div>
            )}

            {/* Confirm step */}
            {sendStep === "confirm" && lastGeneratedAddress && (
              <div className="flex flex-col gap-5">
                {/* Big amount hero */}
                <div className="flex flex-col items-center gap-1 py-2">
                  <p className="text-5xl font-extrabold text-white font-mono tracking-tight leading-none text-center">
                    {amount}{" "}
                    <span className="text-xl font-semibold text-[rgba(255,255,255,0.5)]">
                      {chainConfig.nativeCurrency.symbol}
                    </span>
                  </p>
                  <p className="text-sm text-[rgba(255,255,255,0.5)] font-mono text-center">
                    to{" "}
                    <span className="font-bold text-white">
                      {recipient.includes(".dust") ? recipient : `${recipient.slice(0, 14)}...`}
                    </span>
                  </p>
                </div>

                {/* Details card */}
                <div className="p-4 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[rgba(255,255,255,0.5)] font-mono">Network</span>
                    <span className="text-xs font-semibold text-white font-mono">{chainConfig.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[rgba(255,255,255,0.5)] font-mono">Privacy</span>
                    <div className="flex items-center gap-1">
                      <LockIcon size={12} color="#00EF8B" />
                      <span className="text-xs font-semibold text-[#00EF8B] font-mono">Stealth</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[rgba(255,255,255,0.5)] font-mono">Gas</span>
                    <span className="text-xs font-semibold text-white font-mono">Sponsored</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setSendStep("input")}
                    className="flex-1 py-3 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.06)] transition-all text-sm font-semibold text-white font-mono"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={isLoading}
                    className="flex-[2] py-3 rounded-sm bg-[rgba(0,239,139,0.1)] border border-[rgba(0,239,139,0.2)] hover:bg-[rgba(0,239,139,0.15)] hover:border-[#00EF8B] hover:shadow-[0_0_15px_rgba(0,239,139,0.15)] transition-all text-sm font-bold text-[#00EF8B] font-mono tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block w-4 h-4 border-2 border-[#00EF8B] border-t-transparent rounded-full animate-spin" />
                        <span>Sending...</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <SendIcon size={15} color="#00EF8B" />
                        [ CONFIRM_SEND ]
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Success step */}
            {sendStep === "success" && (
              <div className="relative overflow-hidden -mx-6 -mb-6 -mt-6">
                {/* Confetti particles */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {[...Array(18)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute rounded-sm"
                      style={{
                        width: `${4 + Math.random() * 6}px`,
                        height: `${4 + Math.random() * 6}px`,
                        borderRadius: i % 3 === 0 ? "1px" : "9999px",
                        backgroundColor: ["#00EF8B", "#00EF8B", "#7C3AED", "#F59E0B", "#10B981", "#EC4899", "#06B6D4"][i % 7],
                        left: `${5 + (i * 5.2) % 90}%`,
                        top: "-10px",
                        opacity: 0,
                        animation: `confettiFall ${1.5 + Math.random() * 1.5}s ease-out ${0.1 + i * 0.06}s both`,
                      }}
                    />
                  ))}
                </div>

                <div className="flex flex-col gap-0 p-6 pt-8">
                  {/* Emoji burst */}
                  <p
                    className="text-[52px] text-center leading-none"
                    style={{ animation: "successPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
                  >
                    🎉
                  </p>

                  {/* Big amount hero */}
                  <div
                    className="flex flex-col items-center gap-1 pt-5 pb-2"
                    style={{ animation: "successSlideUp 0.5s ease-out 0.15s both" }}
                  >
                    <p className="text-[44px] font-extrabold text-white font-mono tracking-tight leading-none text-center">
                      {amount}{" "}
                      <span className="text-[22px] font-semibold text-[rgba(255,255,255,0.5)]">
                        {chainConfig.nativeCurrency.symbol}
                      </span>
                    </p>
                    <p className="text-[15px] text-[rgba(255,255,255,0.5)] font-mono text-center">
                      sent to{" "}
                      <span className="font-bold text-white">
                        {recipient.includes(".dust") ? recipient : `${recipient.slice(0, 10)}...${recipient.slice(-4)}`}
                      </span>
                    </p>
                  </div>

                  {/* Privacy badge */}
                  <div
                    className="flex justify-center pt-4 pb-6"
                    style={{ animation: "successSlideUp 0.5s ease-out 0.25s both" }}
                  >
                    <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[rgba(0,239,139,0.06)] rounded-full border border-[rgba(0,239,139,0.15)]">
                      <LockIcon size={12} color="#00EF8B" />
                      <span className="text-xs font-semibold text-[#00EF8B] font-mono">
                        Private · Stealth · Gas Free
                      </span>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div
                    className="flex flex-col gap-2.5"
                    style={{ animation: "successSlideUp 0.5s ease-out 0.35s both" }}
                  >
                    {sendTxHash && (
                      <a
                        href={`${getExplorerBase(activeChainId)}/tx/${sendTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.06)] transition-all text-sm font-semibold text-[rgba(255,255,255,0.6)] font-mono"
                      >
                        <ArrowUpRightIcon size={14} color="currentColor" />
                        View on Explorer
                      </a>
                    )}
                    <button
                      onClick={handleClose}
                      className="w-full py-3.5 rounded-sm bg-[rgba(0,239,139,0.1)] border border-[rgba(0,239,139,0.2)] hover:bg-[rgba(0,239,139,0.15)] hover:border-[#00EF8B] hover:shadow-[0_0_15px_rgba(0,239,139,0.15)] transition-all text-sm font-bold text-[#00EF8B] font-mono tracking-wider"
                    >
                      [ DONE ]
                    </button>
                  </div>
                </div>

                <style>{`
                  @keyframes confettiFall {
                    0% { opacity: 1; transform: translateY(0) rotate(0deg); }
                    100% { opacity: 0; transform: translateY(340px) rotate(720deg); }
                  }
                  @keyframes successPop {
                    0% { opacity: 0; transform: scale(0.3); }
                    50% { opacity: 1; transform: scale(1.15); }
                    100% { opacity: 1; transform: scale(1); }
                  }
                  @keyframes successSlideUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                `}</style>
              </div>
            )}

            {/* Send error */}
            {sendError && (
              <div className="flex items-center gap-1.5 mt-4 p-3 rounded-sm bg-[rgba(239,68,68,0.04)] border border-[rgba(239,68,68,0.15)]">
                <AlertCircleIcon size={14} color="#ef4444" />
                <p className="text-xs text-red-400 font-mono">{sendError}</p>
              </div>
            )}

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
