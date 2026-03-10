"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentLinks } from "@/hooks/stealth/usePaymentLinks";
import { useStealthScanner } from "@/hooks/stealth";
import { colors, radius, shadows, getExplorerBase } from "@/lib/design/tokens";
import {
  ArrowLeftIcon, MoreHorizontalIcon, LinkIcon, CopyIcon, CheckIcon,
  QRIcon, ActivityIcon, TrashIcon,
  ArrowDownLeftIcon, ArrowUpRightIcon, ChainIcon,
} from "@/components/stealth/icons";
import { QRModal } from "@/components/links/QRModal";

export default function LinkDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { ownedNames, stealthKeys, activeChainId } = useAuth();
  const { getLink, deleteLink } = usePaymentLinks();
  const { payments, scanInBackground, stopBackgroundScan, isScanning } = useStealthScanner(stealthKeys, { chainId: activeChainId });
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const link = getLink(id);
  const username = ownedNames[0]?.name || "";

  useEffect(() => {
    if (stealthKeys) {
      scanInBackground();
      return () => stopBackgroundScan();
    }
  }, [stealthKeys, scanInBackground, stopBackgroundScan]);

  const linkPayments = useMemo(() => {
    if (!link) return [];
    return payments.filter(p => p.announcement.linkSlug === link.slug);
  }, [payments, link]);

  const totalReceived = useMemo(
    () => linkPayments.reduce((sum, p) => sum + parseFloat(p.originalAmount || p.balance || "0"), 0),
    [linkPayments]
  );

  if (!link) {
    return (
      <div style={{ padding: "40px", maxWidth: "680px", margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", paddingTop: "60px", paddingBottom: "60px", textAlign: "center" }}>
          <span style={{ fontSize: "18px", fontWeight: 600, color: colors.text.primary }}>Link not found</span>
          <button
            style={{ padding: "10px 20px", backgroundColor: colors.bg.input, borderRadius: radius.full, cursor: "pointer", border: "none" }}
            onClick={() => router.push("/links")}
          >
            <span style={{ fontSize: "14px", color: colors.text.secondary }}>Back to Links</span>
          </button>
        </div>
      </div>
    );
  }

  const dustName = `${link.slug}.${username}.dust`;
  const payPath = `/pay/${username}/${link.slug}`;
  const accentColor = link.emojiBg || "#00EF8B";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(dustName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = () => {
    deleteLink(link.id);
    router.push("/links");
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: "640px", margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Top nav */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            style={{ padding: "8px", borderRadius: radius.full, background: "none", border: "none", cursor: "pointer" }}
            onClick={() => router.push("/links")}
          >
            <ArrowLeftIcon size={20} color={colors.text.secondary} />
          </button>
          <div style={{ position: "relative" }}>
            <button
              style={{ padding: "8px", borderRadius: radius.full, background: "none", border: "none", cursor: "pointer" }}
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreHorizontalIcon size={20} color={colors.text.secondary} />
            </button>
            {showMenu && (
              <div style={{
                position: "absolute", right: "0", top: "40px", zIndex: 50,
                backgroundColor: colors.bg.card, borderRadius: radius.sm,
                border: `1.5px solid ${colors.border.default}`,
                boxShadow: shadows.modal, minWidth: "150px", overflow: "hidden",
              }}>
                <button
                  style={{ width: "100%", padding: "10px 14px", display: "flex", gap: "8px", alignItems: "center", background: "none", border: "none", cursor: "pointer" }}
                  onClick={handleDelete}
                >
                  <TrashIcon size={15} color={colors.accent.red} />
                  <span style={{ fontSize: "13px", color: colors.accent.red, fontWeight: 500 }}>Delete Link</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Hero — emoji + name + .dust */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", paddingTop: "4px", paddingBottom: "4px" }}>
          <div style={{
            width: "88px", height: "88px",
            borderRadius: radius.full,
            background: `linear-gradient(145deg, ${accentColor}18, ${accentColor}30)`,
            border: `2px solid ${accentColor}25`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "40px",
          }}>
            {link.emoji}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "22px", fontWeight: 700, color: colors.text.primary, letterSpacing: "-0.01em" }}>
              {link.name}
            </span>
            {link.description && (
              <span style={{ fontSize: "13px", color: colors.text.muted, textAlign: "center", maxWidth: "360px", lineHeight: "1.5" }}>
                {link.description}
              </span>
            )}
          </div>
        </div>

        {/* .dust address bar */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 16px",
          backgroundColor: colors.bg.card,
          borderRadius: radius.md,
          border: `1.5px solid ${colors.border.default}`,
        }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flex: 1, overflow: "hidden" }}>
            <div style={{
              width: "30px", height: "30px", borderRadius: radius.full,
              background: `linear-gradient(135deg, ${accentColor}20, ${accentColor}40)`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <LinkIcon size={13} color={accentColor} />
            </div>
            <span style={{ fontSize: "14px", fontWeight: 500, color: colors.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {dustName}
            </span>
          </div>
          <div style={{ display: "flex", gap: "2px" }}>
            <button
              style={{
                padding: "7px", borderRadius: radius.full,
                backgroundColor: copied ? `${accentColor}10` : "transparent",
                border: "none", cursor: "pointer", transition: "all 0.15s ease",
              }}
              onClick={handleCopy}
            >
              {copied
                ? <CheckIcon size={15} color={accentColor} />
                : <CopyIcon size={15} color={colors.text.muted} />
              }
            </button>
            <button
              style={{ padding: "7px", borderRadius: radius.full, border: "none", cursor: "pointer", background: "transparent" }}
              onClick={() => setShowQR(true)}
            >
              <QRIcon size={15} color={colors.text.muted} />
            </button>
          </div>
        </div>

        <QRModal
          isOpen={showQR}
          onClose={() => setShowQR(false)}
          url={payPath}
          title={link.name}
          displayName={dustName}
          accentColor={accentColor}
        />

        {/* Stats row — single card with dividers */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "20px",
          backgroundColor: colors.bg.card,
          borderRadius: radius.lg,
          border: `1.5px solid ${colors.border.default}`,
          boxShadow: shadows.card,
        }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "24px", fontWeight: 700, color: colors.text.primary }}>{link.views}</span>
            <span style={{ fontSize: "11px", fontWeight: 500, color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Views</span>
          </div>
          <div style={{ width: "1px", height: "40px", backgroundColor: colors.border.default }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "24px", fontWeight: 700, color: colors.text.primary }}>{linkPayments.length}</span>
            <span style={{ fontSize: "11px", fontWeight: 500, color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Payments</span>
          </div>
          <div style={{ width: "1px", height: "40px", backgroundColor: colors.border.default }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
            <div style={{ display: "flex", gap: "6px", justifyContent: "center", alignItems: "center" }}>
              <ChainIcon size={20} chainId={activeChainId} />
              <span style={{ fontSize: "24px", fontWeight: 700, color: colors.accent.indigo }}>
                {totalReceived.toFixed(2)}
              </span>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 500, color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Received</span>
          </div>
        </div>

        {/* Activity section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingTop: "4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "16px", fontWeight: 600, color: colors.text.primary }}>Activity</span>
            {isScanning && (
              <div style={{ width: "14px", height: "14px", border: `2px solid ${colors.text.muted}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            )}
          </div>

          {linkPayments.length === 0 ? (
            <div style={{
              padding: "40px 24px",
              backgroundColor: colors.bg.card,
              borderRadius: radius.lg,
              border: `1.5px solid ${colors.border.default}`,
              textAlign: "center",
            }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "48px", height: "48px", borderRadius: radius.full,
                  backgroundColor: colors.bg.input,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <ActivityIcon size={22} color={colors.text.muted} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text.secondary }}>No activity yet</span>
                  <span style={{ fontSize: "12px", color: colors.text.muted }}>Payments to this link will show here</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              backgroundColor: colors.bg.card,
              borderRadius: radius.lg,
              border: `1.5px solid ${colors.border.default}`,
              overflow: "hidden",
            }}>
              {linkPayments.map((payment, i) => {
                const displayAmount = parseFloat(payment.originalAmount || payment.balance || "0");
                return (
                  <div
                    key={payment.announcement.txHash}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "14px 18px",
                      borderTop: i > 0 ? `1px solid ${colors.border.default}` : "none",
                    }}
                  >
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <div style={{
                        width: "38px", height: "38px",
                        borderRadius: radius.full,
                        backgroundColor: "rgba(43, 90, 226, 0.07)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <ArrowDownLeftIcon size={18} color={colors.accent.indigo} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 500, color: colors.text.primary }}>
                          {payment.announcement.caller?.slice(0, 6)}...{payment.announcement.caller?.slice(-4) || "unknown"}
                        </span>
                        <span style={{ fontSize: "11px", color: colors.text.muted }}>
                          Block #{payment.announcement.blockNumber.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: colors.accent.indigo }}>
                        +{displayAmount.toFixed(4)}
                      </span>
                      <a href={`${getExplorerBase(activeChainId)}/tx/${payment.announcement.txHash}`} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}>
                        <div style={{ padding: "5px", borderRadius: radius.full }}>
                          <ArrowUpRightIcon size={13} color={colors.text.muted} />
                        </div>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
