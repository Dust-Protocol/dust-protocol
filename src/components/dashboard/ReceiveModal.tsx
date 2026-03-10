"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import { XIcon, CopyIcon, CheckIcon } from "@/components/stealth/icons";
import { DustLogo } from "@/components/DustLogo";
import { Share2, ExternalLink } from "lucide-react";

const PRODUCTION_ORIGIN = "https://dustprotocol.app";

function getShareableUrl(payPath: string): string {
  if (typeof window === "undefined") return `${PRODUCTION_ORIGIN}${payPath}`;
  const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  return isDev ? `${window.location.origin}${payPath}` : `${PRODUCTION_ORIGIN}${payPath}`;
}

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  dustName: string | null;
  payPath: string;
}

export function ReceiveModal({ isOpen, onClose, dustName, payPath }: ReceiveModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [fullUrl, setFullUrl] = useState("");
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (!isOpen || !canvasRef.current || !payPath) return;
    const url = getShareableUrl(payPath);
    setFullUrl(url);
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
    QRCode.toCanvas(canvasRef.current, url, {
      width: 220,
      margin: 2,
      color: { dark: "#1A1D2B", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    }, () => {});
  }, [isOpen, payPath]);

  const handleCopy = async () => {
    if (!fullUrl) return;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!fullUrl || !navigator.share) return;
    try {
      await navigator.share({
        title: `Pay ${dustName ?? "me"} on Dust Protocol`,
        text: `Send me a private payment on Dust Protocol`,
        url: fullUrl,
      });
    } catch {
      // User cancelled or share API failed — fall back to copy
      handleCopy();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="relative w-full max-w-[400px] p-6 rounded-md border border-white/[0.08] bg-[#06080F] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <DustLogo size={14} color="#00FF41" />
                <span className="text-xs font-bold text-white/70 font-mono tracking-wider">
                  RECEIVE
                </span>
              </div>
              <button
                onClick={onClose}
                className="text-white/30 hover:text-white transition-colors"
              >
                <XIcon size={18} />
              </button>
            </div>

            {dustName ? (
              <div className="flex flex-col gap-5">
                {/* .dust name */}
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#00FF41] font-mono">{dustName}</p>
                  <p className="text-[11px] text-white/30 font-mono mt-1">
                    Share this link to receive private payments
                  </p>
                </div>

                {/* QR Code */}
                <div className="flex justify-center">
                  <div className="p-3 rounded-sm bg-white">
                    <canvas ref={canvasRef} style={{ display: "block" }} />
                  </div>
                </div>

                {/* Link row — clickable */}
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-sm hover:border-[#00FF41]/30 hover:bg-[#00FF41]/[0.03] transition-all group"
                >
                  <span className="flex-1 text-[12px] text-white/40 font-mono truncate text-left group-hover:text-white/60 transition-colors">
                    {fullUrl}
                  </span>
                  <span className="flex-shrink-0 text-white/30 group-hover:text-[#00FF41] transition-colors">
                    {copied
                      ? <CheckIcon size={14} color="#00FF41" />
                      : <CopyIcon size={14} color="currentColor" />
                    }
                  </span>
                </button>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-sm border border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06] transition-all text-xs font-mono text-white/70 hover:text-white"
                  >
                    {copied ? <CheckIcon size={13} color="#00FF41" /> : <CopyIcon size={13} color="currentColor" />}
                    {copied ? "Copied!" : "Copy Link"}
                  </button>
                  {canShare ? (
                    <button
                      onClick={handleShare}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-sm bg-[#00FF41] hover:bg-[#00FF41]/85 transition-all text-xs font-mono font-bold text-black"
                    >
                      <Share2 size={13} />
                      Share
                    </button>
                  ) : (
                    <a
                      href={fullUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-sm bg-[#00FF41] hover:bg-[#00FF41]/85 transition-all text-xs font-mono font-bold text-black"
                    >
                      <ExternalLink size={13} />
                      Open Link
                    </a>
                  )}
                </div>

                {/* Branding */}
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  <DustLogo size={12} color="rgba(255,255,255,0.2)" />
                  <span className="text-[10px] text-white/20 font-mono tracking-wider">
                    DUST PROTOCOL
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 py-5">
                <p className="text-lg font-bold text-white text-center">No Username Yet</p>
                <p className="text-sm text-white/40 font-mono text-center leading-relaxed">
                  Register a username to get a shareable payment link.
                </p>
              </div>
            )}

            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/[0.08]" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/[0.08]" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/[0.08]" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/[0.08]" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
