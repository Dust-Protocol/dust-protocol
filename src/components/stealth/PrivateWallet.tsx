"use client";

import React, { useState, useEffect, ChangeEvent } from "react";
import {
  useStealthAddress,
  useStealthScanner,
  useStealthSend,
  useStealthName,
} from "@/hooks/stealth";
import { useAuth } from "@/contexts/AuthContext";
import { useWalletConnect } from "@/hooks/wallet-connect/useWalletConnect";
import { isStealthName, NAME_SUFFIX, GeneratedStealthAddress, ScanResult } from "@/lib/stealth";
import { getChainConfig, getMinClaimableBalance } from "@/config/chains";
import { isPrivyEnabled } from "@/config/privy";
import { useLogin } from "@privy-io/react-auth";
import { useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import {
  ShieldIcon, LockIcon, SendIcon, InboxIcon, SettingsIcon, HomeIcon,
  CopyIcon, CheckIcon, CheckCircleIcon, AlertCircleIcon, InfoIcon,
  WalletIcon, RefreshIcon, ArrowUpRightIcon, ArrowDownLeftIcon,
  TagIcon, TrashIcon, KeyIcon, HistoryIcon, MailIcon,
} from "./icons";

interface ColorTokens {
  bg: { page: string; card: string; input: string; elevated: string; hover: string };
  border: { default: string; light: string; accent: string; accentGreen: string };
  text: { primary: string; secondary: string; tertiary: string; muted: string };
  accent: { indigo: string; indigoBright: string; indigoDark: string; green: string; greenBright: string; greenDark: string; red: string; redDark: string; amber: string };
  glow: { indigo: string; green: string };
}

interface RadiusTokens {
  xl: string; lg: string; md: string; sm: string; xs: string;
}

interface OwnedName {
  name: string;
  fullName: string;
}

interface ClaimAddress {
  address: string;
  label?: string;
  balance?: string;
}

interface StealthPayment extends ScanResult {
  balance?: string;
  claimed?: boolean;
  keyMismatch?: boolean;
}

const colors: ColorTokens = {
  bg: { page: "#07070a", card: "#0d0d12", input: "#12121a", elevated: "#1a1a24", hover: "#22222e" },
  border: { default: "#2d2d3a", light: "#3d3d4a", accent: "#6366f1", accentGreen: "#10b981" },
  text: { primary: "#ffffff", secondary: "#e2e2e8", tertiary: "#a0a0b0", muted: "#6b6b7a" },
  accent: {
    indigo: "#7c7fff", indigoBright: "#9b9eff", indigoDark: "#5b5edd",
    green: "#00d68f", greenBright: "#00ffaa", greenDark: "#00b377",
    red: "#ff6b6b", redDark: "#ff4757", amber: "#ffbe0b",
  },
  glow: { indigo: "0 0 30px rgba(124, 127, 255, 0.3)", green: "0 0 30px rgba(0, 214, 143, 0.3)" },
};

const radius: RadiusTokens = { xl: "20px", lg: "16px", md: "12px", sm: "8px", xs: "6px" };

type ViewType = "home" | "send" | "inbox" | "history" | "settings";

export const PrivateWallet = () => {
  const { isConnected, address } = useWalletConnect();
  const { ownedNames: authOwnedNames, activeChainId } = useAuth();
  const {
    stealthKeys, metaAddress, deriveKeysFromWallet, clearKeys,
    registerMetaAddress, isRegistered, isLoading: isKeyLoading,
    isSigningMessage, error: keyError,
    // Unified claim addresses
    claimAddresses, selectedClaimAddress, selectedClaimIndex, claimAddressesInitialized,
    selectClaimAddress,
  } = useStealthAddress();

  const { payments, scan, isScanning, claimPayment, error: scanError } = useStealthScanner(stealthKeys, { chainId: activeChainId });
  const { generateAddressFor, sendEthToStealth, lastGeneratedAddress, isLoading: isSendLoading, error: sendError } = useStealthSend(activeChainId);
  const { ownedNames: _hookNames, registerName, checkAvailability, resolveName, validateName, formatName, isConfigured: nameRegistryConfigured, isLoading: isNameLoading } = useStealthName();
  const { login: privyLogin } = useLogin();
  const { connect } = useConnect();
  // Use AuthContext's ownedNames — it has discovery via metaAddress, whereas the local hook does not
  const ownedNames = authOwnedNames.length > 0 ? authOwnedNames : _hookNames;
  const [view, setView] = useState<ViewType>("home");
  const [copied, setCopied] = useState(false);
  const [setupStep, setSetupStep] = useState<"welcome" | "signing" | "ready">("welcome");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sendStep, setSendStep] = useState<"input" | "confirm" | "success">("input");
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvedLinkSlug, setResolvedLinkSlug] = useState<string | undefined>(undefined);
  const [isResolving, setIsResolving] = useState(false);
  const [sendTxHash, setSendTxHash] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [isNameAvailable, setIsNameAvailable] = useState<boolean | null>(null);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [claimingIndex, setClaimingIndex] = useState<number | null>(null);
  const [claimedTx, setClaimedTx] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const pendingPayments = payments.filter(p => {
    if (p.claimed || p.keyMismatch) return false;
    const bal = parseFloat(p.balance || "0");
    // Sponsored wallet types (create2, account, eip7702) can claim any amount
    // Only apply minimum balance check for EOA wallets where user pays gas
    if (p.walletType && p.walletType !== 'eoa') return bal > 0;
    return bal >= getMinClaimableBalance(activeChainId);
  });

  useEffect(() => {
    const resolve = async () => {
      setResolvedLinkSlug(undefined);
      if (!recipient) { setResolvedAddress(null); return; }
      if (recipient.startsWith("st:")) { setResolvedAddress(recipient); return; }
      if (nameRegistryConfigured && isStealthName(recipient)) {
        setIsResolving(true);
        let nameToResolve = recipient;
        const normalized = recipient.toLowerCase().trim();
        if (normalized.endsWith('.dust')) {
          const withoutSuffix = normalized.slice(0, -4);
          const parts = withoutSuffix.split(".");
          if (parts.length > 1) {
            nameToResolve = parts[parts.length - 1] + '.dust';
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
        }
        return;
      }
      setResolvedAddress(null);
    };
    const t = setTimeout(resolve, 300);
    return () => clearTimeout(t);
  }, [recipient, nameRegistryConfigured, resolveName]);

  useEffect(() => {
    const check = async () => {
      if (!nameInput || !nameRegistryConfigured) { setIsNameAvailable(null); return; }
      if (!validateName(nameInput).valid) { setIsNameAvailable(null); return; }
      setIsCheckingName(true);
      const available = await checkAvailability(nameInput);
      setIsNameAvailable(available);
      setIsCheckingName(false);
    };
    const t = setTimeout(check, 500);
    return () => clearTimeout(t);
  }, [nameInput, nameRegistryConfigured, validateName, checkAvailability]);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSetup = async () => {
    setSetupStep("signing");
    try {
      const result = await deriveKeysFromWallet();
      if (!result) {
        // Signature was rejected or failed — go back to welcome
        setSetupStep("welcome");
        return;
      }
      setSetupStep("ready");
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (errMsg.includes('User rejected') || errMsg.includes('user_rejected') || errMsg.includes('ACTION_REJECTED')) {
        // User cancelled — don't show error toast, just reset
        setSetupStep("welcome");
        return;
      }
      console.error('[PrivateWallet] Signature failed:', errMsg);
      setSetupStep("welcome");
    }
  };

  const handleSendPreview = () => {
    const addr = resolvedAddress || recipient;
    if (!addr || !amount) return;
    if (generateAddressFor(addr)) setSendStep("confirm");
  };

  const handleSend = async () => {
    try {
      const hash = await sendEthToStealth(resolvedAddress || recipient, amount, resolvedLinkSlug);
      if (hash) { setSendTxHash(hash); setSendStep("success"); }
    } catch {
      // Error state already set by sendEthToStealth
    }
  };

  const handleClaim = async (index: number) => {
    setClaimingIndex(index);
    try {
      const payment = payments[index];
      const claimTo = claimAddressesInitialized && selectedClaimAddress ? selectedClaimAddress.address : address;
      if (!claimTo) return;

      // Always use standard claim path — relayer mode deprecated (keys must stay client-side)
      const txHash = await claimPayment(payment, claimTo);
      if (txHash) setClaimedTx(txHash);
    } catch {
      // Error state already set by claimPayment
    } finally {
      setClaimingIndex(null);
    }
  };

  const handleRegisterName = async () => {
    if (!metaAddress || !nameInput) return;
    const txHash = await registerName(nameInput, metaAddress);
    if (txHash) {
      setNameInput(""); setIsNameAvailable(null);
      // Also register on-chain (ERC-6538) so people can find you by wallet address too
      if (!isRegistered) {
        try { await registerMetaAddress(); } catch { /* non-critical */ }
      }
      setRegistrationSuccess(true);
      setTimeout(() => setRegistrationSuccess(false), 5000);
    }
  };

  const resetSendFlow = () => {
    setRecipient(""); setAmount(""); setSendStep("input");
    setSendTxHash(null); setResolvedAddress(null);
  };

  if (!isConnected) {
    return (
      <div
        className="w-full p-12 px-8 text-center rounded-[20px] border"
        style={{ background: colors.bg.card, borderColor: colors.border.default }}
      >
        <div className="flex flex-col items-center gap-6">
          <div style={{ color: colors.accent.indigo, opacity: 0.9 }}><ShieldIcon size={48} /></div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-[20px] font-semibold text-white">Private Wallet</span>
            <span className="text-sm text-[rgba(255,255,255,0.3)] max-w-[280px] leading-relaxed">
              Send and receive payments that cannot be traced to your identity
            </span>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            {/* Social login buttons — only when Privy is configured */}
            {isPrivyEnabled && (
              <>
                <button
                  className="w-full h-[46px] flex items-center justify-center gap-2.5 rounded-sm border text-sm font-medium cursor-pointer transition-colors"
                  style={{ background: colors.bg.input, borderColor: colors.border.default, color: colors.text.primary }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = colors.bg.elevated; (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border.light; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = colors.bg.input; (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border.default; }}
                  onClick={() => privyLogin({ loginMethods: ['google'] })}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>

                <button
                  className="w-full h-[46px] flex items-center justify-center gap-2.5 rounded-sm border text-sm font-medium cursor-pointer transition-colors"
                  style={{ background: colors.bg.input, borderColor: colors.border.default, color: colors.text.primary }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = colors.bg.elevated; (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border.light; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = colors.bg.input; (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border.default; }}
                  onClick={() => privyLogin({ loginMethods: ['email'] })}
                >
                  <MailIcon size={18} color={colors.text.tertiary} />
                  Continue with Email
                </button>

                <button
                  className="w-full h-[46px] flex items-center justify-center gap-2.5 rounded-sm border text-sm font-medium cursor-pointer transition-colors"
                  style={{ background: colors.bg.input, borderColor: colors.border.default, color: colors.text.primary }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = colors.bg.elevated; (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border.light; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = colors.bg.input; (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border.default; }}
                  onClick={() => privyLogin({ loginMethods: ['farcaster'] })}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M5.5 3h13v18h-2.25v-7.5a4.25 4.25 0 0 0-8.5 0V21H5.5V3z" fill="#855DCD"/>
                    <path d="M3 5.5L5.5 3h13L21 5.5H3z" fill="#855DCD"/>
                  </svg>
                  Continue with Farcaster
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px" style={{ background: colors.border.default }} />
                  <span className="text-[11px] uppercase tracking-widest font-medium" style={{ color: colors.text.muted }}>or</span>
                  <div className="flex-1 h-px" style={{ background: colors.border.default }} />
                </div>
              </>
            )}

            {/* Wallet connect button */}
            <button
              className="w-full h-[46px] flex items-center justify-center gap-2.5 rounded-sm text-sm font-medium text-white cursor-pointer transition-colors"
              style={{ background: colors.accent.indigoDark }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = colors.accent.indigo; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = colors.accent.indigoDark; }}
              onClick={() => connect({ connector: injected() })}
            >
              <WalletIcon size={18} />
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!stealthKeys) {
    return (
      <div
        className="w-full p-12 px-8 rounded-[20px] border animate-[fadeIn_0.4s_ease-out]"
        style={{ background: colors.bg.card, borderColor: colors.border.default }}
      >
        <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div style={{ color: colors.accent.indigo, opacity: 0.9 }}><KeyIcon size={44} /></div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[20px] font-semibold text-white">Activate Private Mode</span>
              <span className="text-sm leading-relaxed max-w-xs" style={{ color: colors.text.muted }}>
                Create your private receiving address. Anyone can send to it, but only you can access the funds.
              </span>
            </div>
          </div>

          {setupStep === "welcome" && (
            <button
              className="h-[46px] px-7 rounded-sm text-sm font-medium text-white cursor-pointer transition-colors disabled:opacity-50"
              style={{ background: colors.accent.indigoDark }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = colors.accent.indigo; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = colors.accent.indigoDark; }}
              onClick={handleSetup}
              disabled={isKeyLoading || isSigningMessage}
            >
              Create Private Address
            </button>
          )}

          {setupStep === "signing" && (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#7c7fff] border-t-transparent rounded-full animate-spin" />
              <span className="text-[13px]" style={{ color: colors.text.muted }}>Sign the message in your wallet...</span>
            </div>
          )}

          {keyError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-sm" style={{ background: "rgba(248,113,113,0.08)", borderRadius: radius.xs }}>
              <AlertCircleIcon size={16} color={colors.accent.red} />
              <span className="text-[13px]" style={{ color: colors.accent.red }}>{keyError}</span>
            </div>
          )}

          <div className="p-3.5 px-4 rounded-sm border" style={{ background: colors.bg.input, borderColor: colors.border.default }}>
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5" style={{ color: colors.text.muted }}><InfoIcon size={14} /></div>
              <span className="text-[12px] leading-relaxed" style={{ color: colors.text.muted }}>
                Your private address is derived from your wallet signature. You can recover it anytime by signing the same message.
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-[20px] overflow-hidden animate-[fadeIn_0.3s_ease-out]"
      style={{ background: colors.bg.card, border: `1.5px solid ${colors.border.default}`, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
    >
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Header */}
      <div
        className="p-6 border-b"
        style={{ borderColor: colors.border.default, background: "linear-gradient(180deg, rgba(124,127,255,0.04) 0%, transparent 100%)" }}
      >
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] uppercase tracking-[0.12em] font-bold" style={{ color: colors.accent.indigo }}>Private Wallet</span>
            <div className="flex items-center gap-3.5">
              {ownedNames.length > 0 ? (
                <span className="text-[20px] font-bold text-white">{ownedNames[0].fullName}</span>
              ) : (
                <span className="text-sm font-mono" style={{ color: colors.text.secondary }}>{metaAddress?.slice(0, 18)}...</span>
              )}
              <button
                className="h-8 px-3.5 rounded-sm text-[12px] font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
                style={{
                  background: copied ? "rgba(0,214,143,0.2)" : colors.bg.elevated,
                  border: `1.5px solid ${copied ? colors.accent.green : colors.border.light}`,
                  color: copied ? colors.accent.greenBright : colors.text.secondary,
                }}
                onClick={() => handleCopy(ownedNames.length > 0 ? ownedNames[0].fullName : metaAddress || "")}
              >
                {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {isRegistered && (
              <div className="flex items-center gap-1.5">
                <CheckCircleIcon size={13} color={colors.accent.greenBright} />
                <span className="text-[12px] font-semibold" style={{ color: colors.accent.greenBright }}>Registered on-chain</span>
              </div>
            )}
          </div>
          {pendingPayments.length > 0 && (
            <button
              className="h-9 px-4 rounded-sm flex items-center gap-2 cursor-pointer transition-colors"
              style={{
                background: "linear-gradient(135deg, rgba(255,190,11,0.15) 0%, rgba(255,190,11,0.05) 100%)",
                border: "1.5px solid rgba(255,190,11,0.5)",
              }}
              onClick={() => setView("inbox")}
            >
              <InboxIcon size={16} color={colors.accent.amber} />
              <span className="text-[13px] font-bold" style={{ color: colors.accent.amber }}>{pendingPayments.length} pending</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex p-2.5 px-3 gap-1 border-b justify-between" style={{ borderColor: colors.border.default, background: colors.bg.input }}>
        {([
          { id: "home", label: "Home", Icon: HomeIcon },
          { id: "send", label: "Send", Icon: SendIcon },
          { id: "inbox", label: "Inbox", Icon: InboxIcon },
          { id: "history", label: "History", Icon: HistoryIcon },
          { id: "settings", label: "", Icon: SettingsIcon },
        ] as const).map((item) => (
          <button
            key={item.id}
            className="h-9 rounded-sm cursor-pointer transition-colors flex items-center justify-center gap-1.5 relative"
            style={{
              padding: item.label ? "0 12px" : "0 10px",
              minWidth: item.label ? "auto" : "36px",
              background: view === item.id ? colors.bg.elevated : "transparent",
              border: view === item.id ? `1.5px solid ${colors.accent.indigo}` : "1.5px solid transparent",
              fontWeight: view === item.id ? 600 : 500,
              fontSize: "12px",
              color: view === item.id ? colors.text.primary : colors.text.tertiary,
            }}
            onClick={() => setView(item.id)}
          >
            <item.Icon size={16} color={view === item.id ? colors.accent.indigo : colors.text.tertiary} />
            {item.label && <span>{item.label}</span>}
            {item.id === "inbox" && pendingPayments.length > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-[5px] rounded-[9px] flex items-center justify-center text-[10px] font-bold text-black"
                style={{ background: colors.accent.amber }}
              >
                {pendingPayments.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5">
        {view === "home" && <HomeView {...{ colors, radius, ownedNames, nameRegistryConfigured, nameInput, setNameInput, isCheckingName, isNameAvailable, formatName, validateName, handleRegisterName, isNameLoading, setView, scan, isRegistered, isKeyLoading, registrationSuccess, handleCopy }} />}
        {view === "send" && <SendView {...{ colors, radius, sendStep, recipient, setRecipient, amount, setAmount, isResolving, resolvedAddress, handleSendPreview, handleSend, setSendStep, lastGeneratedAddress, isSendLoading, sendTxHash, resetSendFlow, sendError }} />}
        {view === "inbox" && <InboxView {...{ colors, radius, payments, isScanning, scan, claimAddressesInitialized, claimAddresses, selectedIndex: selectedClaimIndex, selectAddress: selectClaimAddress, handleClaim, claimingIndex, claimedTx, scanError }} />}
        {view === "history" && <HistoryView {...{ colors, radius, payments }} />}
        {view === "settings" && <SettingsView {...{ colors, radius, metaAddress, handleCopy, copied, claimAddressesInitialized, claimAddresses, clearKeys }} />}
      </div>
    </div>
  );
};

// Sub-component interfaces
interface HomeViewProps {
  colors: ColorTokens;
  radius: RadiusTokens;
  ownedNames: OwnedName[];
  nameRegistryConfigured: boolean;
  nameInput: string;
  setNameInput: (v: string) => void;
  isCheckingName: boolean;
  isNameAvailable: boolean | null;
  formatName: (name: string) => string;
  validateName: (name: string) => { valid: boolean; error?: string };
  handleRegisterName: () => void;
  isNameLoading: boolean;
  setView: (v: ViewType) => void;
  scan: () => void;
  isRegistered: boolean;
  isKeyLoading: boolean;
  registrationSuccess: boolean;
  handleCopy: (text: string) => void;
}

interface SendViewProps {
  colors: ColorTokens;
  radius: RadiusTokens;
  sendStep: "input" | "confirm" | "success";
  recipient: string;
  setRecipient: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  isResolving: boolean;
  resolvedAddress: string | null;
  handleSendPreview: () => void;
  handleSend: () => Promise<void>;
  setSendStep: (v: "input" | "confirm" | "success") => void;
  lastGeneratedAddress: GeneratedStealthAddress | null;
  isSendLoading: boolean;
  sendTxHash: string | null;
  resetSendFlow: () => void;
  sendError: string | null;
}

interface InboxViewProps {
  colors: ColorTokens;
  radius: RadiusTokens;
  payments: StealthPayment[];
  isScanning: boolean;
  scan: () => void;
  claimAddressesInitialized: boolean;
  claimAddresses: ClaimAddress[];
  selectedIndex: number;
  selectAddress: (idx: number) => void;
  handleClaim: (idx: number) => Promise<void>;
  claimingIndex: number | null;
  claimedTx: string | null;
  scanError: string | null;
}

interface SettingsViewProps {
  colors: ColorTokens;
  radius: RadiusTokens;
  metaAddress: string | null;
  handleCopy: (text: string) => void;
  copied: boolean;
  claimAddressesInitialized: boolean;
  claimAddresses: ClaimAddress[];
  clearKeys: () => void;
}

interface HistoryViewProps {
  colors: ColorTokens;
  radius: RadiusTokens;
  payments: StealthPayment[];
}

// Sub-components
const HomeView = ({ colors, radius, ownedNames, nameRegistryConfigured, nameInput, setNameInput, isCheckingName, isNameAvailable, formatName, validateName, handleRegisterName, isNameLoading, setView, scan, isRegistered, isKeyLoading, registrationSuccess, handleCopy }: HomeViewProps) => (
  <div className="flex flex-col gap-4 animate-[fadeIn_0.25s_ease-out]">
    <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    <div
      className="p-5 rounded-xl border"
      style={{ background: "linear-gradient(180deg, rgba(124,127,255,0.06) 0%, transparent 100%)", borderColor: colors.border.default, border: `1.5px solid ${colors.border.default}` }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <TagIcon size={17} color={colors.accent.indigo} />
            <span className="text-[15px] font-semibold text-white">Your Private Name</span>
          </div>
          {ownedNames.length > 0 && (
            <div className="px-2.5 py-1 rounded-sm border text-[11px] font-semibold" style={{ background: "rgba(0,214,143,0.15)", borderColor: "rgba(0,214,143,0.4)", color: colors.accent.greenBright }}>
              Registered
            </div>
          )}
        </div>
        {ownedNames.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {ownedNames.map((name: OwnedName) => (
              <div key={name.name} className="flex items-center justify-between px-4 py-3.5 rounded-sm border" style={{ background: colors.bg.input, borderColor: colors.border.default }}>
                <span className="text-[17px] font-bold text-white">{name.fullName}</span>
              </div>
            ))}
          </div>
        ) : nameRegistryConfigured ? (
          <div className="flex flex-col gap-3.5">
            <span className="text-[13px]" style={{ color: colors.text.tertiary }}>Register a name so others can send to you easily</span>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  className="w-full h-12 px-4 pr-14 rounded-sm border text-white text-[15px] font-mono placeholder:text-[rgba(255,255,255,0.25)] focus:outline-none transition-colors"
                  style={{ background: colors.bg.input, borderColor: colors.border.default }}
                  placeholder="yourname"
                  value={nameInput}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNameInput(e.target.value)}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold" style={{ color: colors.accent.indigo }}>{NAME_SUFFIX}</span>
              </div>
              <button
                className="h-12 px-6 rounded-sm border text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                style={{ background: colors.bg.elevated, borderColor: colors.border.light, color: colors.text.primary }}
                onClick={handleRegisterName}
                disabled={!isNameAvailable || isNameLoading || isCheckingName}
              >
                {isNameLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Register"}
              </button>
            </div>
            {isCheckingName && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 border border-[#7c7fff] border-t-transparent rounded-full animate-spin" />
                <span className="text-[12px]" style={{ color: colors.text.secondary }}>Checking...</span>
              </div>
            )}
            {!isCheckingName && isNameAvailable === true && nameInput && (
              <div className="flex items-center gap-1.5">
                <CheckCircleIcon size={14} color={colors.accent.greenBright} />
                <span className="text-[13px] font-semibold" style={{ color: colors.accent.greenBright }}>{formatName(nameInput)} is available</span>
              </div>
            )}
            {!isCheckingName && isNameAvailable === false && nameInput && (
              <div className="flex items-center gap-1.5">
                <AlertCircleIcon size={14} color={colors.accent.red} />
                <span className="text-[13px] font-semibold" style={{ color: colors.accent.red }}>{formatName(nameInput)} is already taken</span>
              </div>
            )}
            {!isCheckingName && isNameAvailable === null && nameInput && validateName(nameInput).valid && (
              <div className="flex items-center gap-1.5">
                <AlertCircleIcon size={14} color={colors.accent.amber} />
                <span className="text-[13px] font-medium" style={{ color: colors.accent.amber }}>Could not check availability</span>
              </div>
            )}
          </div>
        ) : <span className="text-[13px]" style={{ color: colors.text.muted }}>Name registry not available</span>}
      </div>
    </div>

    <div className="flex gap-3.5">
      <button
        className="flex-1 h-[72px] rounded-xl flex items-center justify-center gap-3 cursor-pointer transition-all"
        style={{
          background: "linear-gradient(135deg, rgba(124,127,255,0.1) 0%, rgba(124,127,255,0.02) 100%)",
          border: `1.5px solid ${colors.accent.indigo}`,
        }}
        onClick={() => setView("send")}
      >
        <ArrowUpRightIcon size={24} color={colors.accent.indigoBright} />
        <span className="text-base font-semibold text-white">Send</span>
      </button>
      <button
        className="flex-1 h-[72px] rounded-xl flex items-center justify-center gap-3 cursor-pointer transition-all"
        style={{
          background: "linear-gradient(135deg, rgba(0,214,143,0.1) 0%, rgba(0,214,143,0.02) 100%)",
          border: `1.5px solid ${colors.accent.green}`,
        }}
        onClick={() => { setView("inbox"); scan(); }}
      >
        <ArrowDownLeftIcon size={24} color={colors.accent.greenBright} />
        <span className="text-base font-semibold text-white">Receive</span>
      </button>
    </div>

    {registrationSuccess && (
      <div className="p-3.5 px-[18px] rounded-xl border-[1.5px] border-[rgba(0,214,143,0.4)] animate-[fadeIn_0.3s_ease-out]" style={{ background: "rgba(0,214,143,0.1)" }}>
        <div className="flex items-center gap-2.5">
          <CheckCircleIcon size={18} color={colors.accent.greenBright} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold" style={{ color: colors.accent.greenBright }}>Registered successfully</span>
            <span className="text-[12px]" style={{ color: colors.text.secondary }}>Name and on-chain identity are both live</span>
          </div>
        </div>
      </div>
    )}

    <div className="p-[18px] px-5 rounded-xl border" style={{ background: colors.bg.input, borderColor: colors.border.default }}>
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2.5">
          <LockIcon size={16} color={colors.accent.indigo} />
          <span className="text-[13px] font-semibold" style={{ color: colors.text.secondary }}>How it works</span>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-start gap-2.5">
            <span className="text-[12px] min-w-[18px] text-center font-semibold" style={{ color: colors.text.muted }}>1</span>
            <span className="text-[12px] leading-relaxed" style={{ color: colors.text.tertiary }}>Share your <span className="font-semibold" style={{ color: colors.accent.indigoBright }}>.dust</span> name or address with the sender</span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-[12px] min-w-[18px] text-center font-semibold" style={{ color: colors.text.muted }}>2</span>
            <span className="text-[12px] leading-relaxed" style={{ color: colors.text.tertiary }}>Each payment generates a unique stealth address</span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-[12px] min-w-[18px] text-center font-semibold" style={{ color: colors.text.muted }}>3</span>
            <span className="text-[12px] leading-relaxed" style={{ color: colors.text.tertiary }}>Only you can discover and claim the funds</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const SendView = ({ colors, radius, sendStep, recipient, setRecipient, amount, setAmount, isResolving, resolvedAddress, handleSendPreview, handleSend, setSendStep, lastGeneratedAddress, isSendLoading, sendTxHash, resetSendFlow, sendError }: SendViewProps) => {
  const { activeChainId } = useAuth();
  const chainConfig = getChainConfig(activeChainId);
  const symbol = chainConfig.nativeCurrency.symbol;
  return (
  <div className="flex flex-col gap-5 animate-[fadeIn_0.25s_ease-out]">
    <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    {sendStep === "input" && (
      <>
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold text-white">Send Private Payment</span>
          <span className="text-[13px]" style={{ color: colors.text.muted }}>Only the recipient can access these funds</span>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[9px] uppercase tracking-wider font-mono block mb-2" style={{ color: colors.text.tertiary }}>Recipient</label>
            <input
              className="w-full h-12 px-3.5 rounded-sm border text-sm font-mono transition-colors focus:outline-none"
              style={{ background: colors.bg.input, borderColor: colors.border.default, color: colors.text.primary }}
              placeholder={`alice${NAME_SUFFIX} or st:thanos:0x...`}
              value={recipient}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setRecipient(e.target.value)}
            />
            <div className="h-5 mt-1.5">
              {isResolving && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 border border-[rgba(255,255,255,0.4)] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[11px]" style={{ color: colors.text.muted }}>Resolving...</span>
                </div>
              )}
              {!isResolving && resolvedAddress && !recipient.startsWith("st:") && (
                <div className="flex items-center gap-1.5">
                  <CheckCircleIcon size={11} color={colors.accent.green} />
                  <span className="text-[11px]" style={{ color: colors.accent.green }}>Resolved: {resolvedAddress.slice(0, 28)}...</span>
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-wider font-mono block mb-2" style={{ color: colors.text.tertiary }}>Amount</label>
            <input
              className="w-full h-14 px-3.5 rounded-sm border text-2xl font-medium font-mono transition-colors focus:outline-none"
              style={{ background: colors.bg.input, borderColor: colors.border.default, color: colors.text.primary }}
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
            <span className="text-[11px] mt-1.5 block" style={{ color: colors.text.muted }}>{symbol} on {chainConfig.name}</span>
          </div>
        </div>
        <button
          className="h-12 w-full rounded-sm text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: colors.accent.indigoDark }}
          onClick={handleSendPreview}
          disabled={(!resolvedAddress && !recipient.startsWith("st:")) || !amount || isSendLoading || isResolving}
        >
          Preview Payment
        </button>
      </>
    )}

    {sendStep === "confirm" && lastGeneratedAddress && (
      <>
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold text-white">Confirm Payment</span>
          <span className="text-[13px]" style={{ color: colors.text.muted }}>Review before sending</span>
        </div>
        <div className="p-5 rounded-xl border" style={{ background: colors.bg.input, borderColor: colors.border.default }}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: colors.text.muted }}>Amount</span>
              <span className="text-[18px] font-semibold font-mono text-white">{amount} {symbol}</span>
            </div>
            <div className="h-px" style={{ background: colors.border.default }} />
            <div className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: colors.text.muted }}>To</span>
              <span className="text-[13px] font-mono text-white">{recipient.includes(".dust") ? recipient : `${recipient.slice(0, 14)}...`}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-sm border border-[rgba(52,211,153,0.1)]" style={{ background: "rgba(52,211,153,0.04)" }}>
          <LockIcon size={16} color={colors.accent.green} />
          <span className="text-[12px]" style={{ color: colors.text.tertiary }}>This payment is private. Only the recipient can access these funds.</span>
        </div>
        <div className="flex gap-2.5">
          <button
            className="flex-1 h-11 rounded-sm border text-[13px] font-medium transition-colors"
            style={{ background: colors.bg.elevated, borderColor: colors.border.default, color: colors.text.primary }}
            onClick={() => setSendStep("input")}
          >
            Back
          </button>
          <button
            className="flex-[2] h-11 rounded-sm text-[13px] font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            style={{ background: colors.accent.indigoDark }}
            onClick={handleSend}
            disabled={isSendLoading}
          >
            {isSendLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Send Payment"}
          </button>
        </div>
      </>
    )}

    {sendStep === "success" && (
      <div className="flex flex-col items-center gap-6 py-7 animate-[fadeIn_0.3s_ease-out]">
        <div className="p-4 rounded-full" style={{ background: "rgba(52,211,153,0.08)" }}>
          <CheckCircleIcon size={32} color={colors.accent.green} />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[18px] font-semibold text-white">Payment Sent</span>
          <span className="text-[13px] text-center" style={{ color: colors.text.muted }}>{amount} {symbol} sent privately to {recipient.includes(".dust") ? recipient : "recipient"}</span>
        </div>
        {sendTxHash && (
          <div className="flex flex-col items-center gap-2.5 w-full max-w-sm">
            <div className="p-2.5 px-3 rounded-sm border w-full" style={{ background: colors.bg.input, borderColor: colors.border.default }}>
              <span className="text-[11px] font-mono leading-relaxed break-all" style={{ color: colors.text.secondary }}>{sendTxHash}</span>
            </div>
            <a href={`${getChainConfig(activeChainId).blockExplorerUrl}/tx/${sendTxHash}`} target="_blank" rel="noopener noreferrer">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border cursor-pointer transition-colors" style={{ background: colors.bg.elevated, borderColor: colors.border.light }}>
                <ArrowUpRightIcon size={13} color={colors.accent.indigo} />
                <span className="text-[12px] font-medium" style={{ color: colors.accent.indigo }}>View on Explorer</span>
              </div>
            </a>
          </div>
        )}
        <button
          className="h-11 px-7 rounded-sm text-[13px] font-medium text-white transition-colors"
          style={{ background: colors.accent.indigoDark }}
          onClick={resetSendFlow}
        >
          Send Another
        </button>
      </div>
    )}

    {sendError && (
      <div className="flex items-center gap-1.5 px-3.5 py-3 rounded-sm" style={{ background: "rgba(248,113,113,0.08)" }}>
        <AlertCircleIcon size={14} color={colors.accent.red} />
        <span className="text-[12px]" style={{ color: colors.accent.red }}>{sendError}</span>
      </div>
    )}
  </div>
  );
};

const InboxView = ({ colors, radius, payments, isScanning, scan, claimAddressesInitialized, claimAddresses, selectedIndex, selectAddress, handleClaim, claimingIndex, claimedTx, scanError }: InboxViewProps) => {
  const { activeChainId } = useAuth();
  const symbol = getChainConfig(activeChainId).nativeCurrency.symbol;
  const accentColor = colors.accent.green;
  const accentBright = colors.accent.greenBright;
  const accentDark = colors.accent.greenDark;

  return (
    <div className="flex flex-col gap-4 animate-[fadeIn_0.25s_ease-out]">
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: colors.border.default }}>
        <div className="flex flex-col gap-0.5">
          <span className="text-[18px] font-semibold text-white">Inbox</span>
          <span className="text-[12px]" style={{ color: colors.text.muted }}>Receiving payments</span>
        </div>
        <div className="flex gap-2.5">
          <button
            className="h-[38px] px-3.5 rounded-sm border text-[12px] font-medium transition-colors disabled:opacity-50 flex items-center justify-center"
            style={{ background: colors.bg.elevated, borderColor: colors.border.light, color: colors.text.secondary }}
            onClick={() => scan()}
            disabled={isScanning}
          >
            {isScanning
              ? <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
              : <RefreshIcon size={14} />
            }
          </button>
        </div>
      </div>

      {/* Claim Address Selector */}
      {claimAddressesInitialized && claimAddresses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium" style={{ color: colors.text.muted }}>Claim to:</span>
          {claimAddresses.slice(0, 3).map((addr: ClaimAddress, idx: number) => (
            <button
              key={addr.address}
              className="h-7 px-3 rounded-sm border text-[11px] font-medium cursor-pointer transition-colors"
              style={{
                background: selectedIndex === idx ? accentColor : "transparent",
                borderColor: selectedIndex === idx ? accentColor : colors.border.default,
                color: selectedIndex === idx ? colors.bg.page : colors.text.muted,
              }}
              onClick={() => selectAddress(idx)}
            >
              {addr.label || `Wallet ${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Success State */}
      {claimedTx && (
        <div
          className="p-5 rounded-[16px] border border-[rgba(0,214,143,0.3)]"
          style={{ background: "linear-gradient(135deg, rgba(0,214,143,0.1) 0%, rgba(0,214,143,0.02) 100%)" }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full" style={{ background: "rgba(0,214,143,0.15)" }}>
                <CheckCircleIcon size={20} color={accentBright} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold text-white">Payment Claimed!</span>
                <span className="text-[12px]" style={{ color: colors.text.muted }}>Funds sent to your wallet</span>
              </div>
            </div>

            <div className="p-3 px-3.5 rounded-sm" style={{ background: "rgba(0,0,0,0.25)" }}>
              <span className="text-[10px] font-medium block mb-1.5" style={{ color: colors.text.muted }}>Transaction Hash</span>
              <span className="text-[11px] font-mono leading-relaxed break-all" style={{ color: accentBright }}>{claimedTx}</span>
            </div>

            <a href={`${getChainConfig(activeChainId).blockExplorerUrl}/tx/${claimedTx}`} target="_blank" rel="noopener noreferrer">
              <button
                className="w-full h-10 rounded-sm border border-[rgba(0,214,143,0.3)] flex items-center justify-center gap-2 text-[13px] font-medium transition-colors"
                style={{ background: "rgba(0,214,143,0.15)", color: accentBright }}
              >
                <ArrowUpRightIcon size={14} color={accentBright} />
                View on Explorer
              </button>
            </a>
          </div>
        </div>
      )}

      {/* Payments List */}
      {(() => {
        const pendingList = payments.filter(p => !p.claimed);
        return pendingList.length === 0 ? (
          <div
            className="p-12 px-6 rounded-[16px] border text-center"
            style={{ background: colors.bg.input, borderColor: colors.border.default }}
          >
            <div className="flex flex-col items-center gap-3.5">
              <div className="p-4 rounded-full" style={{ background: colors.bg.elevated }}>
                <InboxIcon size={32} color={colors.text.muted} />
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[15px] font-medium text-white">No pending payments</span>
                <span className="text-[13px] max-w-[240px] leading-relaxed" style={{ color: colors.text.muted }}>
                  When someone sends you a private payment, it will appear here
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {pendingList.map((payment: StealthPayment) => {
              const index = payments.indexOf(payment);
              const balance = parseFloat(payment.balance || "0");
              const isTooLowForGas = balance > 0 && balance < getMinClaimableBalance(activeChainId) && (!payment.walletType || payment.walletType === 'eoa');
              const canClaim = !payment.claimed && !payment.keyMismatch && !isTooLowForGas;

              return (
                <div
                  key={payment.announcement.txHash}
                  className="p-[18px] rounded-xl transition-all duration-200"
                  style={{
                    background: colors.bg.input,
                    border: `1px solid ${canClaim ? "rgba(0,214,143,0.3)" : colors.border.default}`,
                    opacity: payment.claimed || isTooLowForGas ? 0.5 : 1,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <div
                        className="p-2.5 rounded-sm"
                        style={{ background: payment.claimed ? "rgba(0,214,143,0.1)" : canClaim ? "rgba(0,214,143,0.1)" : colors.bg.elevated }}
                      >
                        {payment.claimed ? (
                          <CheckCircleIcon size={18} color={colors.accent.green} />
                        ) : canClaim ? (
                          <ArrowDownLeftIcon size={18} color={colors.accent.green} />
                        ) : (
                          <AlertCircleIcon size={18} color={colors.text.muted} />
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[18px] font-semibold font-mono text-white">
                          {balance.toFixed(4)} {symbol}
                        </span>
                        <span className="text-[11px]" style={{ color: colors.text.muted }}>
                          Block #{payment.announcement.blockNumber.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {payment.claimed ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm" style={{ background: "rgba(0,214,143,0.1)" }}>
                        <CheckCircleIcon size={12} color={colors.accent.green} />
                        <span className="text-[12px] font-medium" style={{ color: colors.accent.green }}>Claimed</span>
                      </div>
                    ) : payment.keyMismatch ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm" style={{ background: "rgba(255,107,107,0.1)" }}>
                        <AlertCircleIcon size={12} color={colors.accent.red} />
                        <span className="text-[12px] font-medium" style={{ color: colors.accent.red }}>Key Mismatch</span>
                      </div>
                    ) : isTooLowForGas ? (
                      <div className="px-3 py-1.5 rounded-sm" style={{ background: "rgba(255,190,11,0.1)" }}>
                        <span className="text-[12px] font-medium" style={{ color: colors.accent.amber }}>Dust</span>
                      </div>
                    ) : (
                      <button
                        className="h-[38px] px-5 rounded-sm text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        style={{ background: accentColor, color: colors.bg.page }}
                        onClick={() => handleClaim(index)}
                        disabled={claimingIndex === index}
                      >
                        {claimingIndex === index ? (
                          <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Claiming...
                          </>
                        ) : "Claim"}
                      </button>
                    )}
                  </div>

                  {payment.keyMismatch && (
                    <p className="text-[11px] mt-2.5 pl-[52px]" style={{ color: colors.accent.red }}>
                      Your current keys don&apos;t match this payment
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {scanError && (
        <div className="p-3 px-3.5 rounded-sm" style={{ background: "rgba(255,107,107,0.08)" }}>
          <div className="flex items-center gap-2">
            <AlertCircleIcon size={14} color={colors.accent.red} />
            <span className="text-[12px]" style={{ color: colors.accent.red }}>{scanError}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const HistoryView = ({ colors, radius, payments }: HistoryViewProps) => {
  const { activeChainId } = useAuth();
  const claimedPayments = payments.filter(p => p.claimed);
  const EXPLORER_BASE = getChainConfig(activeChainId).blockExplorerUrl;

  return (
    <div className="flex flex-col gap-4 animate-[fadeIn_0.25s_ease-out]">
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="flex flex-col gap-1">
        <span className="text-[18px] font-semibold text-white">History</span>
        <span className="text-[13px]" style={{ color: colors.text.muted }}>Your claimed payments</span>
      </div>

      {claimedPayments.length === 0 ? (
        <div
          className="p-12 px-6 rounded-[16px] border text-center"
          style={{ background: colors.bg.input, borderColor: colors.border.default }}
        >
          <div className="flex flex-col items-center gap-3.5">
            <div className="p-4 rounded-full" style={{ background: colors.bg.elevated }}>
              <HistoryIcon size={32} color={colors.text.muted} />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[15px] font-medium text-white">No history yet</span>
              <span className="text-[13px] max-w-[240px] leading-relaxed" style={{ color: colors.text.muted }}>
                Claimed payments will appear here
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {claimedPayments.map((payment: StealthPayment) => (
            <div
              key={payment.announcement.txHash}
              className="p-4 rounded-xl border"
              style={{ background: colors.bg.input, borderColor: colors.border.default }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-sm" style={{ background: "rgba(0,214,143,0.1)" }}>
                    <CheckCircleIcon size={18} color={colors.accent.green} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold" style={{ color: colors.accent.green }}>Claimed</span>
                    <span className="text-[11px]" style={{ color: colors.text.muted }}>
                      Block #{payment.announcement.blockNumber.toLocaleString()}
                    </span>
                  </div>
                </div>
                <a href={`${EXPLORER_BASE}/tx/${payment.announcement.txHash}`} target="_blank" rel="noopener noreferrer">
                  <button
                    className="h-8 px-3 rounded-sm border text-[11px] font-medium transition-colors flex items-center gap-1.5"
                    style={{ background: colors.bg.elevated, borderColor: colors.border.light, color: colors.text.secondary }}
                  >
                    <ArrowUpRightIcon size={12} />
                    Explorer
                  </button>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {claimedPayments.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-sm border" style={{ background: colors.bg.input, borderColor: colors.border.default }}>
          <span className="text-[12px]" style={{ color: colors.text.muted }}>Total payments claimed</span>
          <span className="text-sm font-semibold" style={{ color: colors.accent.green }}>
            {claimedPayments.length}
          </span>
        </div>
      )}
    </div>
  );
};

const SettingsView = ({ colors, radius, metaAddress, handleCopy, copied, claimAddressesInitialized, claimAddresses, clearKeys }: SettingsViewProps) => {
  const { activeChainId } = useAuth();
  const symbol = getChainConfig(activeChainId).nativeCurrency.symbol;
  return (
  <div className="flex flex-col gap-5 animate-[fadeIn_0.25s_ease-out]">
    <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    <div className="flex flex-col gap-1">
      <span className="text-[18px] font-semibold text-white">Settings</span>
      <span className="text-sm" style={{ color: colors.text.muted }}>Manage your private wallet</span>
    </div>

    <div className="p-5 rounded-[16px] border" style={{ background: colors.bg.input, borderColor: colors.border.default }}>
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2.5">
          <KeyIcon size={16} color={colors.text.muted} />
          <span className="text-[13px] font-medium" style={{ color: colors.text.muted }}>Private Address</span>
        </div>
        <div className="p-3.5 px-4 rounded-xl border" style={{ background: colors.bg.page, borderColor: colors.border.default }}>
          <span className="text-[12px] font-mono leading-relaxed break-all" style={{ color: colors.text.tertiary }}>{metaAddress}</span>
        </div>
        <button
          className="h-10 w-full rounded-sm border text-[13px] font-medium transition-colors flex items-center justify-center gap-2"
          style={{ background: colors.bg.page, borderColor: colors.border.default, color: colors.text.primary }}
          onClick={() => handleCopy(metaAddress || "")}
        >
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          {copied ? "Copied" : "Copy Address"}
        </button>
      </div>
    </div>

    {claimAddressesInitialized && (
      <div className="p-5 rounded-[16px] border" style={{ background: colors.bg.input, borderColor: colors.border.default }}>
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2.5">
            <WalletIcon size={16} color={colors.text.muted} />
            <span className="text-[13px] font-medium" style={{ color: colors.text.muted }}>Claim Addresses</span>
          </div>
          {claimAddresses.map((addr: ClaimAddress, idx: number) => (
            <div key={addr.address} className="flex items-center justify-between px-4 py-3.5 rounded-xl" style={{ background: colors.bg.page }}>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-white">{addr.label || `Wallet ${idx + 1}`}</span>
                <span className="text-[11px] font-mono" style={{ color: colors.text.muted }}>{addr.address.slice(0, 14)}...{addr.address.slice(-10)}</span>
              </div>
              <span className="text-sm font-medium font-mono" style={{ color: colors.accent.green }}>{parseFloat(addr.balance || "0").toFixed(4)} {symbol}</span>
            </div>
          ))}
        </div>
      </div>
    )}

    <div className="p-5 rounded-[16px] border border-[rgba(239,68,68,0.12)]" style={{ background: "rgba(239,68,68,0.03)" }}>
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2.5">
          <TrashIcon size={16} color={colors.accent.red} />
          <span className="text-[13px] font-medium" style={{ color: colors.accent.red }}>Danger Zone</span>
        </div>
        <button
          className="h-11 w-full rounded-sm border border-[rgba(239,68,68,0.2)] text-sm font-medium transition-colors"
          style={{ background: "rgba(239,68,68,0.1)", color: colors.accent.red }}
          onClick={clearKeys}
        >
          Reset Private Wallet
        </button>
        <span className="text-[12px]" style={{ color: colors.text.muted }}>This will clear your keys. You can recover them by signing with the same wallet.</span>
      </div>
    </div>
  </div>
  );
};
