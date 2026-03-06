"use client";

import React, { useState, useEffect, useCallback, useRef, ChangeEvent } from "react";
import { useAccount, useConnect, useChainId } from "wagmi";
import { injected } from "wagmi/connectors";
import { colors, radius, shadows, glass, buttonVariants, transitions, typography, getExplorerBase } from "@/lib/design/tokens";
import { useStealthSend, useStealthName } from "@/hooks/stealth";
import { NAME_SUFFIX } from "@/lib/stealth";
import { getChainConfig } from "@/config/chains";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { NoOptInPayment } from "@/components/pay/NoOptInPayment";
import {
  ShieldIcon, AlertCircleIcon, ArrowUpRightIcon, LockIcon,
  WalletIcon, SendIcon, CopyIcon,
} from "@/components/stealth/icons";
import { DustLogo } from "@/components/DustLogo";

const animations = `
@keyframes dust-success-scale {
  0% { transform: scale(0.6); opacity: 0; }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes dust-check-draw {
  0% { stroke-dashoffset: 24; }
  100% { stroke-dashoffset: 0; }
}
@keyframes dust-fade-up {
  0% { transform: translateY(12px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes dust-confetti {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(-80px) rotate(360deg); opacity: 0; }
}
@keyframes dust-ring-expand {
  0% { transform: scale(0.8); opacity: 0.6; }
  100% { transform: scale(2.5); opacity: 0; }
}
`;

export default function LinkPayPage({ params }: { params: { name: string; link: string } }) {
  const { name, link } = params;
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const walletChainId = useChainId();
  const { resolveName, formatName, isConfigured } = useStealthName();
  const { activeChainId } = useAuth();
  const chainId = activeChainId;
  const chainMismatch = isConnected && walletChainId !== chainId;
  const chainConfig = getChainConfig(chainId);
  const { generateAddressFor, sendEthToStealth, isLoading, error: sendError } = useStealthSend(chainId);

  const [activeTab, setActiveTab] = useState<"wallet" | "qr">("wallet");
  const [resolvedMeta, setResolvedMeta] = useState<string | null>(null);
  const [metaResolving, setMetaResolving] = useState(false);
  const resolvingRef = useRef(false);
  const [amount, setAmount] = useState("");
  const [sendStep, setSendStep] = useState<"input" | "confirm" | "success">("input");
  const [sendTxHash, setSendTxHash] = useState<string | null>(null);

  const dustName = `${link}.${name}.dust`;

  const [resolveError, setResolveError] = useState(false);

  const doResolve = useCallback(async () => {
    if (resolvedMeta || resolvingRef.current || !isConfigured) return;
    resolvingRef.current = true;
    setMetaResolving(true);
    setResolveError(false);
    try {
      const resolved = await resolveName(name + NAME_SUFFIX);
      if (resolved) {
        setResolvedMeta(`st:eth:${resolved}`);
      } else {
        const resolved2 = await resolveName(name);
        if (resolved2) setResolvedMeta(`st:thanos:${resolved2}`);
        else setResolveError(true);
      }
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

  const handleSend = async () => {
    if (!resolvedMeta) return;
    const hash = await sendEthToStealth(resolvedMeta, amount, link);
    if (hash) { setSendTxHash(hash); setSendStep("success"); }
  };

  const isSuccess = sendStep === "success";

  return (
    <div style={{ minHeight: "100vh", background: colors.bg.page, color: colors.text.primary, display: "flex", flexDirection: "column" }}>
      <style>{animations}</style>

      {/* Header */}
      <header style={{
        borderBottom: `1px solid ${colors.border.default}`,
        background: glass.modal.bg,
        backdropFilter: glass.modal.backdropFilter,
        boxShadow: shadows.card,
        padding: "16px 24px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "600px", margin: "0 auto" }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", cursor: "pointer" }}>
              <DustLogo size={24} color={colors.accent.indigo} />
              <span style={{ fontSize: "20px", fontWeight: 800, color: colors.text.primary, fontFamily: typography.fontFamily.heading, letterSpacing: "-0.03em" }}>
                Dust
              </span>
            </div>
          </Link>
          <div style={{ padding: "5px 12px", backgroundColor: "rgba(0,255,65,0.12)", border: "1px solid rgba(0,255,65,0.2)", borderRadius: radius.full }}>
            <span style={{ fontSize: "11px", color: colors.accent.indigoBright, fontWeight: 600, letterSpacing: "0.02em", fontFamily: typography.fontFamily.heading }}>Payment</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "48px 16px" }}>
        <div style={{ width: "100%", maxWidth: "460px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ width: "100%", position: "relative" }}>
              <div style={{
                position: "absolute", inset: "-2px", borderRadius: "26px",
                background: "linear-gradient(135deg, #00FF41, #7C3AED, #00FF41)",
                opacity: isSuccess ? 0.8 : 0.15,
                transition: "opacity 0.6s ease",
              }} />

              <div style={{ background: colors.bg.cardSolid, borderRadius: radius.xl, overflow: "hidden", width: "100%", position: "relative", boxShadow: shadows.card }}>

                <div style={{
                  padding: "28px 24px 24px",
                  textAlign: "center",
                  background: isSuccess
                    ? "linear-gradient(180deg, rgba(34, 197, 94, 0.06) 0%, transparent 100%)"
                    : "linear-gradient(180deg, rgba(43, 90, 226, 0.04) 0%, transparent 100%)",
                  borderBottom: isSuccess ? "none" : `1px solid ${colors.border.default}`,
                  transition: "background 0.4s ease",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                    <div style={{ padding: "14px", backgroundColor: isSuccess ? "rgba(34, 197, 94, 0.1)" : "rgba(43, 90, 226, 0.08)", borderRadius: "50%", transition: "background-color 0.4s ease", position: "relative" }}>
                      {isSuccess && (
                        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(34, 197, 94, 0.3)", animation: "dust-ring-expand 1s ease-out forwards" }} />
                      )}
                      <ShieldIcon size={26} color={isSuccess ? "#22C55E" : colors.accent.indigo} />
                    </div>
                    <span style={{ fontSize: "22px", fontWeight: 700, color: isSuccess ? "#22C55E" : colors.accent.indigoBright }}>{dustName}</span>
                    <span style={{ fontSize: "13px", color: colors.text.muted }}>
                      {isSuccess ? "Private payment completed" : "Send a private payment"}
                    </span>
                  </div>
                </div>

                {!isSuccess && (
                  <div style={{ display: "flex", borderBottom: `1px solid ${colors.border.default}` }}>
                    <button
                      style={{
                        flex: 1, padding: "14px", textAlign: "center", cursor: "pointer",
                        background: "none", border: "none",
                        borderBottomWidth: "2px", borderBottomStyle: "solid",
                        borderBottomColor: activeTab === "wallet" ? "#00FF41" : "transparent",
                        transition: "all 0.2s ease",
                      }}
                      onClick={() => setActiveTab("wallet")}
                    >
                      <div style={{ display: "flex", gap: "6px", justifyContent: "center", alignItems: "center" }}>
                        <WalletIcon size={14} color={activeTab === "wallet" ? colors.accent.indigo : colors.text.muted} />
                        <span style={{ fontSize: "13px", fontWeight: activeTab === "wallet" ? 700 : 500, color: activeTab === "wallet" ? colors.accent.indigo : colors.text.muted }}>Send with Wallet</span>
                      </div>
                    </button>
                    <button
                      style={{
                        flex: 1, padding: "14px", textAlign: "center", cursor: "pointer",
                        background: "none", border: "none",
                        borderBottomWidth: "2px", borderBottomStyle: "solid",
                        borderBottomColor: activeTab === "qr" ? "#00FF41" : "transparent",
                        transition: "all 0.2s ease",
                      }}
                      onClick={() => setActiveTab("qr")}
                    >
                      <div style={{ display: "flex", gap: "6px", justifyContent: "center", alignItems: "center" }}>
                        <CopyIcon size={14} color={activeTab === "qr" ? colors.accent.indigo : colors.text.muted} />
                        <span style={{ fontSize: "13px", fontWeight: activeTab === "qr" ? 700 : 500, color: activeTab === "qr" ? colors.accent.indigo : colors.text.muted }}>QR / Address</span>
                      </div>
                    </button>
                  </div>
                )}

                <div style={{ padding: "24px" }}>
                  {isSuccess ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", paddingTop: "8px", paddingBottom: "8px" }}>
                      <div style={{ position: "relative", width: "80px", height: "80px" }}>
                        {[
                          { color: "#00FF41", x: -20, y: -10, delay: "0s", size: 6 },
                          { color: "#7C3AED", x: 25, y: -15, delay: "0.1s", size: 5 },
                          { color: "#22C55E", x: -30, y: 5, delay: "0.2s", size: 7 },
                          { color: "#D97706", x: 30, y: 0, delay: "0.15s", size: 4 },
                          { color: "#E53E3E", x: -10, y: -25, delay: "0.25s", size: 5 },
                          { color: "#0891B2", x: 15, y: -20, delay: "0.05s", size: 6 },
                        ].map((p, i) => (
                          <div key={i} style={{
                            position: "absolute", left: `calc(50% + ${p.x}px)`, top: `calc(50% + ${p.y}px)`,
                            width: `${p.size}px`, height: `${p.size}px`, borderRadius: "50%", backgroundColor: p.color,
                            animation: `dust-confetti 1.2s ease-out ${p.delay} forwards`,
                          }} />
                        ))}
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", animation: "dust-success-scale 0.5s ease-out forwards" }}>
                          <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "linear-gradient(135deg, #22C55E, #16A34A)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(34, 197, 94, 0.3)" }}>
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5"
                                strokeDasharray="24" strokeDashoffset="24"
                                style={{ animation: "dust-check-draw 0.4s ease-out 0.3s forwards" }} />
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", animation: "dust-fade-up 0.4s ease-out 0.2s both" }}>
                        <span style={{ fontSize: "22px", fontWeight: 700, color: colors.text.primary }}>Payment Sent!</span>
                        <div style={{ display: "flex", gap: "6px", alignItems: "baseline" }}>
                          <span style={{ fontSize: "28px", fontWeight: 700, color: colors.text.primary, fontFamily: "'JetBrains Mono', monospace" }}>{amount}</span>
                          <span style={{ fontSize: "16px", fontWeight: 500, color: colors.text.muted }}>{chainConfig.nativeCurrency.symbol}</span>
                        </div>
                        <span style={{ fontSize: "14px", color: colors.text.muted }}>
                          sent to <span style={{ color: colors.accent.indigoBright, fontWeight: 600 }}>{dustName}</span>
                        </span>
                      </div>

                      {sendTxHash && (
                        <div style={{ animation: "dust-fade-up 0.4s ease-out 0.5s both" }}>
                          <a href={`${getExplorerBase(chainId)}/tx/${sendTxHash}`} target="_blank" rel="noopener noreferrer">
                            <div style={{ display: "flex", gap: "6px", alignItems: "center", padding: "10px 16px", backgroundColor: colors.bg.input, borderRadius: radius.sm, border: `1px solid ${colors.border.default}`, cursor: "pointer" }}>
                              <ArrowUpRightIcon size={13} color={colors.accent.indigo} />
                              <span style={{ fontSize: "13px", color: colors.accent.indigo, fontWeight: 500 }}>View on Explorer</span>
                            </div>
                          </a>
                        </div>
                      )}

                      <span
                        style={{ fontSize: "13px", color: colors.text.muted, cursor: "pointer", animation: "dust-fade-up 0.4s ease-out 0.6s both" }}
                        onClick={() => { setSendStep("input"); setAmount(""); setSendTxHash(null); }}
                      >
                        Send another payment
                      </span>
                    </div>
                  ) : activeTab === "wallet" ? (
                    <>
                      {metaResolving ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", paddingTop: "24px", paddingBottom: "24px" }}>
                          <div style={{ width: "24px", height: "24px", border: `2px solid ${colors.accent.indigo}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                          <span style={{ fontSize: "13px", color: colors.text.muted }}>Preparing payment...</span>
                        </div>
                      ) : resolveError ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", paddingTop: "24px", paddingBottom: "24px" }}>
                          <AlertCircleIcon size={24} color={colors.accent.red} />
                          <span style={{ fontSize: "13px", color: colors.accent.red }}>Could not resolve {dustName}</span>
                          <button
                            style={{ fontSize: "13px", color: colors.accent.indigo, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                            onClick={() => { setResolveError(false); setResolvedMeta(null); }}
                          >
                            Retry
                          </button>
                        </div>
                      ) : !isConnected ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", paddingTop: "16px", paddingBottom: "16px" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "15px", fontWeight: 600, color: colors.text.primary }}>Connect to send</span>
                            <span style={{ fontSize: "13px", color: colors.text.muted, textAlign: "center" }}>
                              Connect your wallet to send a private payment
                            </span>
                          </div>
                          <button
                            style={{
                              width: "100%", padding: "14px",
                              background: buttonVariants.primary.bg,
                              borderRadius: radius.sm, cursor: "pointer",
                              boxShadow: buttonVariants.primary.boxShadow,
                              border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                            }}
                            onClick={() => connect({ connector: injected() })}
                          >
                            <WalletIcon size={16} color="#06080F" />
                            <span style={{ fontSize: "14px", color: "#06080F", fontWeight: 600 }}>Connect Wallet</span>
                          </button>
                          <span style={{ fontSize: "11px", color: colors.text.muted, textAlign: "center" }}>
                            Or switch to <span style={{ color: colors.accent.indigo, cursor: "pointer", fontWeight: 500 }} onClick={() => setActiveTab("qr")}>QR / Address</span> to send from any wallet
                          </span>
                        </div>
                      ) : sendStep === "input" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                          <div>
                            <span style={{ fontSize: "12px", color: colors.text.tertiary, display: "block", marginBottom: "8px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Amount</span>
                            <div style={{ position: "relative" }}>
                              <input
                                placeholder="0.0" type="number" step="0.001" min="0" value={amount}
                                onKeyDown={(e: React.KeyboardEvent) => { if (['-', 'e', 'E', '+'].includes(e.key)) e.preventDefault(); }}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                  const v = e.target.value;
                                  if (v === '' || parseFloat(v) >= 0) setAmount(v);
                                }}
                                style={{
                                  width: "100%", height: "64px", backgroundColor: colors.bg.input,
                                  border: `1.5px solid ${colors.border.default}`, borderRadius: radius.md,
                                  color: colors.text.primary, fontSize: "28px", fontWeight: 600,
                                  fontFamily: "'JetBrains Mono', monospace", padding: "0 60px 0 16px",
                                  outline: "none", boxSizing: "border-box",
                                }}
                              />
                              <span style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", fontWeight: 600, color: colors.text.muted }}>{chainConfig.nativeCurrency.symbol}</span>
                            </div>
                            <span style={{ fontSize: "11px", color: colors.text.muted, marginTop: "6px", display: "block" }}>on {chainConfig.name}</span>
                          </div>
                          <button
                            style={{
                              width: "100%", height: "52px",
                              background: amount ? buttonVariants.primary.bg : colors.bg.elevated,
                              borderRadius: radius.md, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                              cursor: amount && resolvedMeta ? "pointer" : "not-allowed",
                              opacity: amount && resolvedMeta && !isLoading ? 1 : 0.5,
                              boxShadow: amount ? buttonVariants.primary.boxShadow : "none",
                              border: "none",
                            }}
                            onClick={handlePreview}
                          >
                            <span style={{ fontSize: "15px", fontWeight: 600, color: amount ? "#06080F" : colors.text.muted }}>
                              Preview Payment
                            </span>
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                          <div style={{ padding: "20px", backgroundColor: colors.bg.input, borderRadius: radius.md, border: `1px solid ${colors.border.default}` }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "13px", color: colors.text.muted }}>Amount</span>
                                <span style={{ fontSize: "20px", fontWeight: 700, color: colors.text.primary, fontFamily: "'JetBrains Mono', monospace" }}>{amount} {chainConfig.nativeCurrency.symbol}</span>
                              </div>
                              <div style={{ height: "1px", backgroundColor: colors.border.default }} />
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "13px", color: colors.text.muted }}>To</span>
                                <span style={{ fontSize: "16px", fontWeight: 600, color: colors.accent.indigoBright }}>{dustName}</span>
                              </div>
                              <div style={{ height: "1px", backgroundColor: colors.border.default }} />
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "13px", color: colors.text.muted }}>Network fee</span>
                                <span style={{ fontSize: "13px", fontWeight: 600, color: "#22C55E" }}>Free (sponsored)</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", padding: "12px 14px", backgroundColor: "rgba(43, 90, 226, 0.04)", borderRadius: radius.sm, border: "1px solid rgba(43, 90, 226, 0.1)" }}>
                            <LockIcon size={14} color={colors.accent.indigo} />
                            <span style={{ fontSize: "12px", color: colors.text.tertiary }}>
                              This payment uses a stealth address. It cannot be linked to {dustName}.
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: "10px" }}>
                            <button
                              style={{
                                flex: 1, height: "48px", background: buttonVariants.secondary.bg, borderRadius: radius.sm,
                                border: buttonVariants.secondary.border, display: "flex", alignItems: "center",
                                justifyContent: "center", cursor: "pointer",
                              }}
                              onClick={() => setSendStep("input")}
                            >
                              <span style={{ fontSize: "14px", fontWeight: 500, color: colors.text.secondary }}>Back</span>
                            </button>
                            <button
                              style={{
                                flex: 2, height: "48px",
                                background: buttonVariants.primary.bg,
                                borderRadius: radius.sm, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                cursor: isLoading ? "wait" : "pointer",
                                boxShadow: buttonVariants.primary.boxShadow,
                                border: "none",
                              }}
                              onClick={handleSend}
                              disabled={isLoading || chainMismatch}
                            >
                              {isLoading ? (
                                <div style={{ width: "16px", height: "16px", border: "2px solid #06080F", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                              ) : chainMismatch ? (
                                <span style={{ fontSize: "14px", fontWeight: 600, color: "#06080F" }}>Switch wallet to {chainConfig.name}</span>
                              ) : (
                                <>
                                  <SendIcon size={15} color="#06080F" />
                                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#06080F" }}>Send Payment</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                      {sendError && (
                        <div style={{ display: "flex", gap: "6px", alignItems: "center", padding: "12px 14px", background: buttonVariants.danger.bg, border: buttonVariants.danger.border, borderRadius: radius.xs, marginTop: "12px" }}>
                          <AlertCircleIcon size={14} color={colors.accent.red} />
                          <span style={{ fontSize: "12px", color: colors.accent.red }}>{sendError}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <NoOptInPayment
                      recipientName={name}
                      displayName={dustName}
                      linkSlug={link}
                    />
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", paddingTop: "4px" }}>
              <Link href="/" style={{ textDecoration: "none" }}>
                <span style={{ fontSize: "13px", color: colors.text.muted, fontWeight: 500, cursor: "pointer" }}>
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
