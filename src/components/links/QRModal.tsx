"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { XIcon } from "@/components/stealth/icons";
import { DustLogo } from "@/components/DustLogo";

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
  displayName?: string;
  accentColor?: string;
}

export function QRModal({ isOpen, onClose, url, title, displayName, accentColor = "#00FF41" }: QRModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    // Use actual web URL for QR code (not the .dust display name)
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = url.startsWith("http") ? url : `${origin}${url.startsWith("/") ? url : `/${url}`}`;
    QRCode.toCanvas(canvasRef.current, fullUrl, {
      width: 260,
      margin: 2,
      color: { dark: "#1A1D2B", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    }, (err) => {
      if (!err) setReady(true);
    });
  }, [isOpen, url]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-[400px] p-10 px-8 bg-[rgba(13,15,23,0.95)] rounded-3xl border border-[rgba(255,255,255,0.08)] backdrop-blur-2xl"
          style={{
            boxShadow: "0 24px 64px rgba(0,0,0,0.65), 0 8px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)",
          }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full border border-[rgba(255,255,255,0.08)] flex items-center justify-center cursor-pointer hover:bg-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.05)] transition-all duration-150"
            onClick={onClose}
          >
            <XIcon size={16} color="rgba(255,255,255,0.65)" />
          </button>

          <div className="flex flex-col items-center gap-6">
            {/* Title */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[22px] font-bold text-[rgba(255,255,255,0.92)]">{title}</span>
              <span className="text-[14px] text-[rgba(255,255,255,0.30)] font-mono">Scan to open payment link</span>
            </div>

            {/* QR Code with colored border */}
            <div
              className="p-4 rounded-xl bg-white"
              style={{
                border: `4px solid ${accentColor}`,
                boxShadow: `0 4px 20px ${accentColor}25`,
              }}
            >
              <canvas ref={canvasRef} style={{ display: "block", borderRadius: "12px" }} />
            </div>

            {/* Display name */}
            <div className="px-5 py-2.5 bg-[rgba(255,255,255,0.04)] rounded-full max-w-full">
              <span className="text-[14px] font-semibold text-[rgba(255,255,255,0.92)] font-mono text-center block truncate">
                {displayName || url}
              </span>
            </div>

            {/* Branding */}
            <div className="flex items-center gap-1.5 opacity-60">
              <DustLogo size={18} color="rgba(255,255,255,0.65)" />
              <span className="text-[14px] font-bold text-[rgba(255,255,255,0.65)] tracking-tight">
                Dust
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
