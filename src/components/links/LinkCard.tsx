"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { OwnedName, PaymentLink } from "@/lib/design/types";
import {
  LinkIcon, CopyIcon, CheckIcon, QRIcon, EyeIcon, WalletIcon,
} from "@/components/stealth/icons";
import { QRModal } from "./QRModal";

interface PersonalLinkCardProps {
  name: OwnedName;
  type: "personal";
  accentColor: string;
}

interface CustomLinkCardProps {
  link: PaymentLink;
  username: string;
  type: "custom";
  accentColor: string;
}

type LinkCardProps = PersonalLinkCardProps | CustomLinkCardProps;

export function LinkCard(props: LinkCardProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const isPersonal = props.type === "personal";
  const title = isPersonal ? "Personal" : props.link.name;
  const dustName = isPersonal
    ? `${props.name.name}.dust`
    : `${props.link.slug}.${props.username}.dust`;
  const payPath = isPersonal
    ? `/pay/${props.name.name}`
    : `/pay/${props.username}/${props.link.slug}`;
  const emoji = isPersonal ? undefined : props.link.emoji;
  const emojiBg = isPersonal ? undefined : props.link.emojiBg;
  const views = isPersonal ? undefined : props.link.views;
  const payments = isPersonal ? undefined : props.link.payments;
  const accentColor = props.accentColor;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(dustName);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.warn("Clipboard API unavailable");
    }
  };

  const handleQR = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowQR(true);
  };

  const handleClick = () => {
    if (isPersonal) {
      window.open(payPath, "_blank");
    } else {
      router.push(`/links/${props.link.id}`);
    }
  };

  return (
    <>
      <div
        className="p-6 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-sm backdrop-blur-sm cursor-pointer transition-all duration-200 hover:-translate-y-px"
        style={{
          borderColor: accentColor,
          borderWidth: "2.5px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 8px 24px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 2px 8px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)";
        }}
        onClick={handleClick}
      >
        <div className="flex flex-col gap-5">
          {/* Header row */}
          <div className="flex items-start justify-between">
            {emoji ? (
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-[22px]"
                style={{
                  backgroundColor: emojiBg,
                  boxShadow: `0 3px 10px ${accentColor}40`,
                }}
              >
                {emoji}
              </div>
            ) : (
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center border"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}1F 0%, ${accentColor}0F 100%)`,
                  borderColor: `${accentColor}26`,
                }}
              >
                <LinkIcon size={20} color={accentColor} />
              </div>
            )}

            <div className="flex flex-col items-end gap-1">
              <div className="px-2.5 py-1 rounded-sm bg-[rgba(255,255,255,0.04)]">
                <span className="text-[9px] uppercase tracking-wider font-mono text-[rgba(255,255,255,0.5)]">
                  Simple Payment
                </span>
              </div>
              {views !== undefined && (
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-0.5">
                    <EyeIcon size={12} color="rgba(255,255,255,0.30)" />
                    <span className="text-[11px] text-[rgba(255,255,255,0.30)] font-mono">{views}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <WalletIcon size={11} color="rgba(255,255,255,0.30)" />
                    <span className="text-[11px] text-[rgba(255,255,255,0.30)] font-mono">{payments}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <span className="text-[16px] font-semibold text-[rgba(255,255,255,0.92)] font-mono">{title}</span>

          {/* Link row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 overflow-hidden">
              <LinkIcon size={14} color="rgba(255,255,255,0.30)" />
              <span className="text-[13px] text-[rgba(255,255,255,0.30)] font-mono truncate">{dustName}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                className="p-1.5 rounded-full hover:bg-[rgba(255,255,255,0.04)] transition-all duration-150"
                onClick={handleCopy}
              >
                {copied
                  ? <CheckIcon size={14} color={accentColor} />
                  : <CopyIcon size={14} color="rgba(255,255,255,0.30)" />
                }
              </button>
              <button
                className="p-1.5 rounded-full hover:bg-[rgba(255,255,255,0.04)] transition-all duration-150"
                onClick={handleQR}
              >
                <QRIcon size={14} color="rgba(255,255,255,0.30)" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <QRModal
        isOpen={showQR}
        onClose={() => setShowQR(false)}
        url={payPath}
        title={title}
        displayName={dustName}
        accentColor={accentColor}
      />
    </>
  );
}
