"use client";

import { useEffect, useState } from "react";
import { XIcon } from "lucide-react";

type ToastVariant = "warning" | "error" | "info";

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onDismiss: () => void;
}

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; text: string }> = {
  warning: {
    bg: "bg-[rgba(255,176,0,0.1)]",
    border: "border-[rgba(255,176,0,0.3)]",
    text: "text-[#FFB000]",
  },
  error: {
    bg: "bg-[rgba(239,68,68,0.1)]",
    border: "border-[rgba(239,68,68,0.3)]",
    text: "text-[#ef4444]",
  },
  info: {
    bg: "bg-[rgba(0,255,65,0.06)]",
    border: "border-[rgba(0,255,65,0.2)]",
    text: "text-[#00FF41]",
  },
};

export function Toast({ message, variant = "error", duration = 5000, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-in on next frame
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 200);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const styles = VARIANT_STYLES[variant];

  function handleDismiss() {
    setVisible(false);
    setTimeout(onDismiss, 200);
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 max-w-sm ${styles.bg} ${styles.border} border rounded-sm px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-all duration-200 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`text-[11px] font-mono ${styles.text} flex-1 leading-relaxed`}>
          {message}
        </span>
        <button
          onClick={handleDismiss}
          className={`shrink-0 ${styles.text} opacity-60 hover:opacity-100 transition-opacity`}
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
