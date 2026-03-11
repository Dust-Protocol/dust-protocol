"use client";

import React, { useState } from "react";
import { KeyIcon, CopyIcon, CheckIcon, InfoIcon } from "@/components/stealth/icons";

interface SecuritySectionProps {
  metaAddress: string | null;
  viewingPublicKey?: string;
}

export function SecuritySection({ metaAddress, viewingPublicKey }: SecuritySectionProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      console.warn("Clipboard API unavailable");
    }
  };

  return (
    <div className="p-6 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.03)] flex items-center justify-center flex-shrink-0">
            <KeyIcon size={16} color="rgba(255,255,255,0.5)" />
          </div>
          <span className="text-[15px] text-white font-semibold">Security</span>
        </div>

        {metaAddress && (
          <div className="flex flex-col gap-3">
            <span className="text-[13px] text-[rgba(255,255,255,0.5)] font-medium">Private Address</span>
            <div className="px-4 py-3.5 bg-[rgba(255,255,255,0.03)] rounded-sm">
              <span className="text-[11px] text-[rgba(255,255,255,0.35)] font-mono break-all leading-relaxed">
                {metaAddress.slice(0, 10)}...{metaAddress.slice(-8)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(metaAddress, "meta")}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[rgba(255,255,255,0.03)] rounded-full hover:bg-[rgba(255,255,255,0.06)] transition-colors cursor-pointer"
            >
              {copied === "meta"
                ? <CheckIcon size={14} color="#7C3AED" />
                : <CopyIcon size={14} color="rgba(255,255,255,0.5)" />}
              <span className={`text-[13px] font-medium ${copied === "meta" ? "text-[#7C3AED]" : "text-[rgba(255,255,255,0.7)]"}`}>
                {copied === "meta" ? "Copied" : "Copy Meta-Address"}
              </span>
            </button>
          </div>
        )}

        {viewingPublicKey && (
          <div className="flex flex-col gap-3">
            <span className="text-[13px] text-[rgba(255,255,255,0.5)] font-medium">Viewing Public Key</span>
            <div className="px-4 py-3.5 bg-[rgba(255,255,255,0.03)] rounded-sm">
              <span className="text-[11px] text-[rgba(255,255,255,0.35)] font-mono break-all leading-relaxed">
                {viewingPublicKey}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(viewingPublicKey, "viewing")}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[rgba(255,255,255,0.03)] rounded-full hover:bg-[rgba(255,255,255,0.06)] transition-colors cursor-pointer"
            >
              {copied === "viewing"
                ? <CheckIcon size={14} color="#7C3AED" />
                : <CopyIcon size={14} color="rgba(255,255,255,0.5)" />}
              <span className={`text-[13px] font-medium ${copied === "viewing" ? "text-[#7C3AED]" : "text-[rgba(255,255,255,0.7)]"}`}>
                {copied === "viewing" ? "Copied" : "Copy Viewing Key"}
              </span>
            </button>
          </div>
        )}

        <div className="flex items-start gap-2.5 p-3.5 bg-[rgba(217,119,6,0.04)] rounded-sm">
          <div className="flex-shrink-0 mt-px">
            <InfoIcon size={14} color="#FFB000" />
          </div>
          <span className="text-[12px] text-[#FFB000] leading-relaxed">
            Changing your PIN will generate different stealth keys. You would lose access to payments sent to your current identity.
          </span>
        </div>
      </div>
    </div>
  );
}
