"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { XIcon } from "lucide-react";

type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (message: string, variant?: ToastVariant, duration?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; text: string }> = {
  success: {
    bg: "bg-[rgba(0,255,65,0.1)]",
    border: "border-[rgba(0,255,65,0.3)]",
    text: "text-[#00FF41]",
  },
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

function ToastItemComponent({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }): JSX.Element {
  const [visible, setVisible] = useState(false);
  const styles = VARIANT_STYLES[item.variant];

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (item.duration <= 0) return;
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 200);
    }, item.duration);
    return () => clearTimeout(timer);
  }, [item.duration, onDismiss]);

  function handleDismiss(): void {
    setVisible(false);
    setTimeout(onDismiss, 200);
  }

  return (
    <div
      className={`${styles.bg} ${styles.border} border rounded-sm px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-all duration-200 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`text-[11px] font-mono ${styles.text} flex-1 leading-relaxed`}>
          {item.message}
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

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback(function dismiss(id: string): void {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback(function toast(message: string, variant: ToastVariant = "info", duration = 5000): void {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev.slice(-2), { id, message, variant, duration }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-auto">
        {toasts.map(t => (
          <ToastItemComponent key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
