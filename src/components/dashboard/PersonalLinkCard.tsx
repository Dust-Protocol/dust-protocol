"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { LinkIcon, CopyIcon, CheckIcon, QRIcon, ExternalLinkIcon } from "@/components/stealth/icons";
import { QRModal } from "@/components/links/QRModal";
import type { OwnedName } from "@/lib/design/types";

interface PersonalLinkCardProps {
  ownedNames: OwnedName[];
  metaAddress: string | null;
  isNamesSettled?: boolean;
}

export function PersonalLinkCard({ ownedNames, metaAddress, isNamesSettled = true }: PersonalLinkCardProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const displayName = ownedNames.length > 0 ? ownedNames[0].fullName : null;
  const dustName = ownedNames.length > 0 ? `${ownedNames[0].name}.dust` : null;
  const payPath = ownedNames.length > 0 ? `/pay/${ownedNames[0].name}` : "";
  const copyText = dustName || displayName || metaAddress || "";

  const handleCopy = async () => {
    const textToCopy = payPath
      ? `${window.location.origin}${payPath}`
      : copyText;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="w-full p-6 rounded-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm relative overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <LinkIcon size={14} color="rgba(255,255,255,0.4)" />
          <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
            IDENTITY
          </span>
        </div>

        {/* Content */}
        {dustName ? (
          <div className="flex justify-between items-end">
            <div>
              <h3 className="text-xl font-bold text-[#00FF41] font-mono mb-1">
                {dustName}
              </h3>
              <span className="text-xs text-[rgba(255,255,255,0.4)] font-mono">
                {payPath}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-[rgba(255,255,255,0.1)] hover:border-[#00FF41] hover:bg-[rgba(0,255,65,0.05)] transition-all group"
              >
                {copied
                  ? <CheckIcon size={12} color="#00FF41" />
                  : <CopyIcon size={12} color="rgba(255,255,255,0.5)" />
                }
                <span className="text-[10px] font-mono text-[rgba(255,255,255,0.6)] group-hover:text-white">
                  {copied ? "Copied!" : "Copy Link"}
                </span>
              </button>
              <button
                onClick={() => setShowQR(true)}
                className="p-2 rounded-sm border border-[rgba(255,255,255,0.1)] hover:border-[#00FF41] hover:bg-[rgba(0,255,65,0.05)] transition-all"
              >
                <QRIcon size={12} color="rgba(255,255,255,0.5)" />
              </button>
              <button
                onClick={() => window.open(payPath, "_blank")}
                className="p-2 rounded-sm border border-[rgba(255,255,255,0.1)] hover:border-[#00FF41] hover:bg-[rgba(0,255,65,0.05)] transition-all"
              >
                <ExternalLinkIcon size={12} color="rgba(255,255,255,0.5)" />
              </button>
            </div>
          </div>
        ) : !isNamesSettled ? (
          <div className="flex items-center gap-2 py-3">
            <div className="w-4 h-4 border-2 border-[rgba(0,255,65,0.4)] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-[rgba(255,255,255,0.4)] font-mono">Resolving identity...</span>
          </div>
        ) : metaAddress ? (
          <div className="p-3 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)]">
            <p className="text-xs font-mono text-[rgba(255,255,255,0.5)] break-all leading-relaxed">
              {metaAddress.slice(0, 30)}...{metaAddress.slice(-20)}
            </p>
          </div>
        ) : (
          <p className="text-xs text-[rgba(255,255,255,0.3)] font-mono">
            Complete onboarding to get your link
          </p>
        )}

        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[rgba(255,255,255,0.1)] rounded-tl-sm" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[rgba(255,255,255,0.1)] rounded-tr-sm" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[rgba(255,255,255,0.1)] rounded-bl-sm" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[rgba(255,255,255,0.1)] rounded-br-sm" />
      </motion.div>

      {dustName && (
        <QRModal
          isOpen={showQR}
          onClose={() => setShowQR(false)}
          url={payPath}
          title="Your Payment Link"
          displayName={dustName}
        />
      )}
    </>
  );
}
