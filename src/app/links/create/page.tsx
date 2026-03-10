"use client";

import React, { useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentLinks } from "@/hooks/stealth/usePaymentLinks";
import { colors, radius, shadows } from "@/lib/design/tokens";
import {
  WalletIcon, BoxIcon, SendIcon, RefreshIcon,
  ChevronDownIcon, ChevronUpIcon, MailIcon, UserIcon, MessageCircleIcon,
  ArrowLeftIcon, InfoIcon, CheckIcon,
} from "@/components/stealth/icons";

const EMOJI_LIST = [
  "🎨", "🎸", "🎭", "🎪", "🍕", "🍔", "🍩", "🎂",
  "☕", "🌟", "💎", "🔥", "🎯", "🎮", "📸", "🎵",
  "🌈", "🦄", "🐱", "🐶", "💡", "🚀", "💰", "🎁",
  "❤️", "🌊", "🏆", "⚡", "🎤", "🛒", "📚", "🎬",
];

const BG_COLORS = [
  "#F9A8D4", "#FCA5A5", "#FCD34D", "#86EFAC",
  "#5EEAD4", "#93C5FD", "#A5B4FC", "#C4B5FD",
];

const TEMPLATES = [
  {
    id: "simple",
    name: "Simple Payment",
    tagline: '"Just send me money!"',
    desc: "Basic payment link. Share it, get paid.",
    perfect: "Everything else",
    icon: WalletIcon,
    iconBg: "linear-gradient(135deg, #86EFAC 0%, #34D399 100%)",
    iconColor: "#fff",
    borderColor: "#34D399",
    available: true,
  },
  {
    id: "digital",
    name: "Digital Product",
    tagline: '"Buy my design pack - $25"',
    desc: "Sell digital files with instant delivery.",
    perfect: "Selling digital stuff",
    icon: BoxIcon,
    iconBg: "linear-gradient(135deg, #C4B5FD 0%, #A78BFA 100%)",
    iconColor: "#fff",
    borderColor: "#A78BFA",
    available: false,
  },
  {
    id: "request",
    name: "Payment Request",
    tagline: '"You owe me $50"',
    desc: "Ask someone specific to pay you.",
    perfect: "When someone owes you",
    icon: SendIcon,
    iconBg: "linear-gradient(135deg, #93C5FD 0%, #60A5FA 100%)",
    iconColor: "#fff",
    borderColor: "#60A5FA",
    available: false,
  },
  {
    id: "fundraiser",
    name: "Fundraiser",
    tagline: '"Help me reach $1,000!"',
    desc: "Collect money toward a goal with progress bar.",
    perfect: "Raising funds for something",
    icon: RefreshIcon,
    iconBg: "linear-gradient(135deg, #86EFAC 0%, #34D399 100%)",
    iconColor: "#fff",
    borderColor: "#34D399",
    available: false,
  },
];

export default function CreateLinkPage() {
  const router = useRouter();
  const { ownedNames } = useAuth();
  const { createLink } = usePaymentLinks();

  const [step, setStep] = useState<"template" | "form">("template");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🎨");
  const [emojiBg, setEmojiBg] = useState(BG_COLORS[0]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [collectEmail, setCollectEmail] = useState(false);
  const [collectName, setCollectName] = useState(false);
  const [collectTelegram, setCollectTelegram] = useState(false);

  const username = ownedNames[0]?.name || "";

  const handleCreate = () => {
    if (!name.trim()) return;
    const slug = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");
    createLink({ name: name.trim(), slug, description, emoji, emojiBg });
    router.push("/links");
  };

  if (step === "template") {
    return (
      <div style={{ padding: "40px", maxWidth: "680px", margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <button
              style={{ padding: "8px", borderRadius: radius.full, background: "none", border: "none", cursor: "pointer" }}
              onClick={() => router.push("/links")}
            >
              <ArrowLeftIcon size={20} color={colors.text.secondary} />
            </button>
            <span style={{ fontSize: "24px", fontWeight: 700, color: colors.text.primary }}>Create Link</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "18px", fontWeight: 600, color: colors.text.primary }}>Choose a Template</span>
              <InfoIcon size={16} color={colors.text.muted} />
            </div>
            <span style={{ fontSize: "14px", color: colors.text.muted }}>Pick the perfect template for your payment link.</span>
          </div>

          {/* Popular */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontSize: "15px", fontWeight: 600, color: colors.text.primary }}>Popular</span>
            {TEMPLATES.slice(0, 3).map((t) => {
              const Icon = t.icon;
              return (
                <div
                  key={t.id}
                  style={{
                    position: "relative", overflow: "hidden",
                    backgroundColor: colors.bg.card, borderRadius: radius.lg,
                    border: t.available ? `2.5px solid ${t.borderColor}` : `2px solid ${colors.border.default}`,
                    cursor: t.available ? "pointer" : "default",
                    opacity: t.available ? 1 : 0.55,
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => t.available && setStep("form")}
                >
                  {/* Colored accent strip */}
                  {t.available && (
                    <div style={{ position: "absolute", left: "0", top: "0", bottom: "0", width: "4px", background: t.iconBg }} />
                  )}
                  <div style={{ padding: t.available ? "20px 24px 20px 28px" : "20px 24px" }}>
                    <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
                      <div style={{
                        width: "52px", height: "52px", borderRadius: radius.full, background: t.iconBg,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        boxShadow: `0 4px 12px ${t.borderColor}40`,
                      }}>
                        <Icon size={24} color={t.iconColor} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" as const, alignItems: "center" }}>
                          <span style={{ fontSize: "15px", fontWeight: 600, color: colors.text.primary }}>{t.name}</span>
                          <span style={{ fontSize: "12px", color: colors.text.muted, fontStyle: "italic" }}>{t.tagline}</span>
                        </div>
                        <span style={{ fontSize: "13px", color: colors.text.tertiary }}>{t.desc}</span>
                        <span style={{ fontSize: "12px", color: t.available ? t.borderColor : colors.text.muted, fontWeight: 500 }}>
                          Perfect for: {t.perfect}
                        </span>
                      </div>
                      {!t.available && (
                        <div style={{ padding: "5px 12px", backgroundColor: colors.bg.input, borderRadius: radius.full, flexShrink: 0 }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: colors.text.muted }}>Coming Soon</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* More Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontSize: "15px", fontWeight: 600, color: colors.text.primary }}>More Options</span>
            {TEMPLATES.slice(3).map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.id} style={{ padding: "20px 24px", backgroundColor: colors.bg.card, borderRadius: radius.lg, border: `2px solid ${colors.border.default}`, opacity: 0.55 }}>
                  <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
                    <div style={{ width: "52px", height: "52px", borderRadius: radius.full, background: t.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={24} color={t.iconColor} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" as const, alignItems: "center" }}>
                        <span style={{ fontSize: "15px", fontWeight: 600, color: colors.text.primary }}>{t.name}</span>
                        <span style={{ fontSize: "12px", color: colors.text.muted, fontStyle: "italic" }}>{t.tagline}</span>
                      </div>
                      <span style={{ fontSize: "13px", color: colors.text.tertiary }}>{t.desc}</span>
                      <span style={{ fontSize: "12px", color: colors.text.muted }}>Perfect for: {t.perfect}</span>
                    </div>
                    <div style={{ padding: "5px 12px", backgroundColor: colors.bg.input, borderRadius: radius.full, flexShrink: 0 }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: colors.text.muted }}>Coming Soon</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Form
  return (
    <div style={{ padding: "40px", maxWidth: "680px", margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <button
            style={{ padding: "8px", borderRadius: radius.full, background: "none", border: "none", cursor: "pointer" }}
            onClick={() => setStep("template")}
          >
            <ArrowLeftIcon size={20} color={colors.text.secondary} />
          </button>
          <span style={{ fontSize: "24px", fontWeight: 700, color: colors.text.primary }}>Create Link</span>
        </div>

        {/* Link Name & Style */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <span style={{ fontSize: "16px", fontWeight: 600, color: colors.text.primary }}>Link Name &amp; Style</span>
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            {/* Emoji picker trigger */}
            <div style={{ position: "relative" }}>
              <button
                style={{
                  width: "72px", height: "72px", borderRadius: radius.full, backgroundColor: emojiBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", fontSize: "32px", position: "relative",
                  boxShadow: `0 4px 16px ${emojiBg}80`,
                  border: "none", transition: "all 0.2s ease",
                }}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                {emoji}
                {/* Edit badge */}
                <div style={{
                  position: "absolute", bottom: "-2px", right: "-2px",
                  width: "24px", height: "24px", borderRadius: radius.full,
                  backgroundColor: colors.bg.card, border: `2px solid ${colors.border.default}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: "10px" }}>✏️</span>
                </div>
              </button>
              {/* Emoji picker dropdown */}
              {showEmojiPicker && (
                <div style={{
                  position: "absolute", top: "80px", left: "0", zIndex: 50,
                  backgroundColor: colors.bg.card, borderRadius: radius.lg,
                  border: `2px solid ${colors.border.default}`,
                  boxShadow: shadows.modal, padding: "16px", width: "300px",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: colors.text.secondary }}>Background Color</span>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" as const }}>
                      {BG_COLORS.map((bg) => (
                        <button
                          key={bg}
                          style={{
                            width: "32px", height: "32px", borderRadius: radius.full,
                            backgroundColor: bg, cursor: "pointer", transition: "all 0.15s ease",
                            border: emojiBg === bg ? `3px solid ${colors.accent.indigo}` : "2px solid transparent",
                            boxShadow: emojiBg === bg ? `0 2px 8px ${bg}80` : "none",
                          }}
                          onClick={() => setEmojiBg(bg)}
                        />
                      ))}
                    </div>
                    <div style={{ height: "1px", backgroundColor: colors.border.default }} />
                    <span style={{ fontSize: "12px", fontWeight: 600, color: colors.text.secondary }}>Choose Emoji</span>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "4px" }}>
                      {EMOJI_LIST.map((e) => (
                        <button
                          key={e}
                          style={{
                            width: "36px", height: "36px", borderRadius: radius.sm,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", fontSize: "20px", transition: "all 0.1s ease",
                            backgroundColor: emoji === e ? colors.bg.input : "transparent",
                            border: "none",
                          }}
                          onClick={() => { setEmoji(e); setShowEmojiPicker(false); }}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <input
              placeholder="e.g., Coffee Tips"
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              style={{
                flex: 1, height: "52px", padding: "0 16px",
                backgroundColor: colors.bg.input, border: `2px solid ${colors.border.default}`, borderRadius: radius.md,
                fontSize: "16px", fontWeight: 500, color: colors.text.primary,
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Description */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <span style={{ fontSize: "16px", fontWeight: 600, color: colors.text.primary }}>Description (Optional)</span>
          <textarea
            placeholder="Tell people what this payment is for..."
            value={description}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            style={{
              backgroundColor: colors.bg.input, border: `2px solid ${colors.border.default}`, borderRadius: radius.md,
              fontSize: "14px", color: colors.text.primary, minHeight: "120px", padding: "16px",
              outline: "none", resize: "vertical", boxSizing: "border-box", width: "100%",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Amount */}
        <div style={{ padding: "20px 24px", backgroundColor: "rgba(43, 90, 226, 0.04)", borderRadius: radius.lg, border: "2px solid rgba(43, 90, 226, 0.15)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "16px", fontWeight: 600, color: colors.accent.indigo }}>Amount</span>
            <span style={{ fontSize: "14px", color: colors.text.secondary, lineHeight: "1.6" }}>
              <span style={{ fontWeight: 600, color: colors.accent.indigo }}>Open Amount:</span> Let customers choose their own amount - perfect for tips and donations!
            </span>
          </div>
        </div>

        {/* Advanced */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          <span style={{ fontSize: "16px", fontWeight: 600, color: colors.text.primary, marginBottom: "12px" }}>Advanced</span>
          <div
            style={{
              padding: "16px 20px", backgroundColor: colors.bg.card,
              borderRadius: showAdvanced ? `${radius.lg} ${radius.lg} 0 0` : radius.lg,
              border: `2px solid ${colors.border.default}`,
              cursor: "pointer",
            }}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: radius.full,
                  background: "linear-gradient(135deg, #A5B4FC 0%, #818CF8 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(129, 140, 248, 0.3)",
                }}>
                  <UserIcon size={18} color="#fff" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 500, color: colors.text.primary }}>Collect Payer Info</span>
                  <span style={{ fontSize: "12px", color: colors.text.muted }}>Gather additional information from customers</span>
                </div>
              </div>
              {showAdvanced
                ? <ChevronUpIcon size={18} color={colors.text.muted} />
                : <ChevronDownIcon size={18} color={colors.text.muted} />
              }
            </div>
          </div>

          {showAdvanced && (
            <div style={{
              padding: "16px 20px 20px",
              backgroundColor: colors.bg.card,
              borderRadius: `0 0 ${radius.lg} ${radius.lg}`,
              borderLeft: `2px solid ${colors.border.default}`,
              borderRight: `2px solid ${colors.border.default}`,
              borderBottom: `2px solid ${colors.border.default}`,
            }}>
              <span style={{ fontSize: "13px", color: colors.text.tertiary, display: "block", marginBottom: "16px" }}>
                Select the information you&apos;d like to collect from customers during payment:
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* Email */}
                <div
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "14px 16px", backgroundColor: colors.bg.card,
                    borderRadius: radius.md, border: `2px solid ${collectEmail ? "rgba(43, 90, 226, 0.3)" : colors.border.default}`,
                    transition: "all 0.15s ease", cursor: "pointer",
                  }}
                  onClick={() => setCollectEmail(!collectEmail)}
                >
                  <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: radius.full, background: "linear-gradient(135deg, #FCA5A5 0%, #F87171 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <MailIcon size={16} color="#fff" />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 500, color: colors.text.primary }}>Email Address</span>
                      <span style={{ fontSize: "12px", color: colors.text.muted }}>Get payer&apos;s email for receipts and updates</span>
                    </div>
                  </div>
                  <div style={{
                    width: "24px", height: "24px", borderRadius: radius.xs,
                    border: `2px solid ${collectEmail ? colors.accent.indigo : colors.border.default}`,
                    backgroundColor: collectEmail ? colors.accent.indigo : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s ease",
                  }}>
                    {collectEmail && <CheckIcon size={14} color="#fff" />}
                  </div>
                </div>
                {/* Name */}
                <div
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "14px 16px", backgroundColor: colors.bg.card,
                    borderRadius: radius.md, border: `2px solid ${collectName ? "rgba(43, 90, 226, 0.3)" : colors.border.default}`,
                    transition: "all 0.15s ease", cursor: "pointer",
                  }}
                  onClick={() => setCollectName(!collectName)}
                >
                  <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: radius.full, background: "linear-gradient(135deg, #93C5FD 0%, #60A5FA 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <UserIcon size={16} color="#fff" />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 500, color: colors.text.primary }}>Name</span>
                      <span style={{ fontSize: "12px", color: colors.text.muted }}>Collect payer&apos;s name</span>
                    </div>
                  </div>
                  <div style={{
                    width: "24px", height: "24px", borderRadius: radius.xs,
                    border: `2px solid ${collectName ? colors.accent.indigo : colors.border.default}`,
                    backgroundColor: collectName ? colors.accent.indigo : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s ease",
                  }}>
                    {collectName && <CheckIcon size={14} color="#fff" />}
                  </div>
                </div>
                {/* Telegram */}
                <div
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "14px 16px", backgroundColor: colors.bg.card,
                    borderRadius: radius.md, border: `2px solid ${collectTelegram ? "rgba(43, 90, 226, 0.3)" : colors.border.default}`,
                    transition: "all 0.15s ease", cursor: "pointer",
                  }}
                  onClick={() => setCollectTelegram(!collectTelegram)}
                >
                  <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: radius.full, background: "linear-gradient(135deg, #5EEAD4 0%, #2DD4BF 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <MessageCircleIcon size={16} color="#fff" />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 500, color: colors.text.primary }}>Telegram Username</span>
                      <span style={{ fontSize: "12px", color: colors.text.muted }}>Collect payer&apos;s Telegram username</span>
                    </div>
                  </div>
                  <div style={{
                    width: "24px", height: "24px", borderRadius: radius.xs,
                    border: `2px solid ${collectTelegram ? colors.accent.indigo : colors.border.default}`,
                    backgroundColor: collectTelegram ? colors.accent.indigo : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s ease",
                  }}>
                    {collectTelegram && <CheckIcon size={14} color="#fff" />}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: "16px", padding: "12px 16px", backgroundColor: "rgba(217, 119, 6, 0.06)", borderRadius: radius.sm }}>
                <span style={{ fontSize: "12px", color: colors.accent.amber, lineHeight: "1.5" }}>
                  <span style={{ fontWeight: 600 }}>Tip:</span> Collecting customer info helps you provide better service and build relationships with your customers.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Create button */}
        <button
          style={{
            width: "100%", padding: "16px",
            background: name.trim() ? "linear-gradient(135deg, #00FF41 0%, #00FF41 100%)" : colors.bg.elevated,
            borderRadius: radius.full,
            cursor: name.trim() ? "pointer" : "not-allowed",
            boxShadow: name.trim() ? "0 4px 16px rgba(43, 90, 226, 0.35)" : "none",
            border: "none",
            transition: "all 0.2s ease",
          }}
          onClick={handleCreate}
        >
          <span style={{ fontSize: "15px", fontWeight: 600, color: name.trim() ? "white" : colors.text.muted, textAlign: "center", display: "block" }}>
            Create Payment Link
          </span>
        </button>

        {username && name.trim() && (
          <div style={{ padding: "12px 16px", backgroundColor: "rgba(43, 90, 226, 0.04)", borderRadius: radius.sm, textAlign: "center" }}>
            <span style={{ fontSize: "12px", color: colors.accent.indigo }}>
              Your link: <span style={{ fontWeight: 600 }}>{name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "")}.{username}.dust</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
