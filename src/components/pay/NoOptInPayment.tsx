"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { getChainConfig } from "@/config/chains";
import { useAuth } from "@/contexts/AuthContext";
import { useBalancePoller } from "@/hooks/stealth/useBalancePoller";
import { AddressDisplay } from "./AddressDisplay";
import {
  CheckCircleIcon,
  AlertCircleIcon,
  ShieldIcon,
} from "@/components/stealth/icons";

type Status = "resolving" | "ready" | "deposit_detected" | "error";

interface NoOptInPaymentProps {
  recipientName: string;
  displayName: string;
  linkSlug?: string;
  externalPaymentSent?: boolean;
  externalPaymentAmount?: string;
}

export function NoOptInPayment({
  recipientName,
  displayName,
  linkSlug,
  externalPaymentSent,
  externalPaymentAmount,
}: NoOptInPaymentProps) {
  const { activeChainId } = useAuth();
  const symbol = getChainConfig(activeChainId).nativeCurrency.symbol;
  const [status, setStatus] = useState<Status>("resolving");
  const [stealthAddress, setStealthAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Prevent double-fire in React StrictMode (two mounts → rate limit on second call)
  const hasFiredRef = useRef(false);

  const { hasDeposit, depositAmount } = useBalancePoller(
    status === "ready" ? stealthAddress : null
  );

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (linkSlug) params.set("link", linkSlug);
    const qs = params.toString();
    return `/api/resolve/${encodeURIComponent(recipientName)}${qs ? `?${qs}` : ""}`;
  }, [recipientName, linkSlug]);

  const doResolve = useCallback(async (signal?: AbortSignal) => {
    setStatus("resolving");
    setError(null);

    try {
      const res = await fetch(buildUrl(), { signal });
      const data = await res.json();

      if (signal?.aborted) return;

      if (!res.ok) {
        const friendlyError = res.status === 429
          ? "Address was just generated — please wait a moment and retry"
          : (data.error || "Failed to resolve address");
        setError(friendlyError);
        setStatus("error");
        return;
      }

      setStealthAddress(data.stealthAddress);
      setStatus("ready");
    } catch (e) {
      if (signal?.aborted) return;
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to resolve address");
      setStatus("error");
    }
  }, [buildUrl]);

  // Resolve on mount — AbortController cancels on cleanup (handles React StrictMode)
  useEffect(() => {
    // Guard: only fire once across StrictMode double-mount
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    doResolve(controller.signal);
    return () => { controller.abort(); };
  }, [doResolve]);

  // Retry handler (user-initiated, no abort needed)
  const handleRetry = useCallback(() => {
    hasFiredRef.current = false; // allow re-resolve
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    doResolve(controller.signal);
  }, [doResolve]);

  // Transition to deposit_detected when balance appears or wallet flow succeeds
  useEffect(() => {
    if (hasDeposit && status === "ready") {
      setStatus("deposit_detected");
    }
  }, [hasDeposit, status]);

  useEffect(() => {
    if (externalPaymentSent && (status === "ready" || status === "resolving")) {
      setStatus("deposit_detected");
    }
  }, [externalPaymentSent, status]);

  if (status === "resolving") {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="w-8 h-8 border-2 border-[#7c7fff] border-t-transparent rounded-full animate-spin" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm text-[rgba(255,255,255,0.6)]">
            Generating your private address...
          </span>
          <span className="text-xs text-[rgba(255,255,255,0.3)]">
            Creating a one-time stealth address for this payment
          </span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <AlertCircleIcon size={32} color="#ff6b6b" />
        <p className="text-sm text-[#ff6b6b] text-center px-2">
          {error || "Something went wrong"}
        </p>
        <button
          className="px-6 py-2.5 bg-[#7c7fff] text-white rounded-sm text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity"
          onClick={handleRetry}
        >
          Retry
        </button>
      </div>
    );
  }

  if (status === "deposit_detected") {
    return (
      <div className="flex flex-col items-center gap-5 py-6">
        <div className="p-4 bg-[rgba(0,255,65,0.08)] rounded-full">
          <CheckCircleIcon size={36} color="#7c7fff" />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[20px] font-bold text-white">
            Payment Received!
          </span>
          <span className="text-[15px] text-[rgba(255,255,255,0.7)] font-mono">
            {depositAmount !== "0" ? depositAmount : externalPaymentAmount || ""} {symbol}
          </span>
          <span className="text-[13px] text-[rgba(255,255,255,0.4)]">
            Sent to {displayName}
          </span>
        </div>
      </div>
    );
  }

  // status === "ready"
  return (
    <div className="flex flex-col items-center gap-5">
      <style>{`@keyframes dust-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      {/* Status pill */}
      <div
        className="flex items-center gap-2 px-3.5 py-2 rounded-full"
        style={{
          background: "rgba(0,255,65,0.06)",
          border: "1px solid rgba(0,255,65,0.12)",
        }}
      >
        <div
          className="w-2 h-2 rounded-full bg-[#7c7fff]"
          style={{ animation: "dust-pulse 2s ease-in-out infinite" }}
        />
        <span className="text-[13px] text-[#7c7fff] font-semibold">
          Waiting for payment...
        </span>
      </div>

      {/* Address + QR */}
      {stealthAddress && (
        <AddressDisplay
          address={stealthAddress}
          label={`Send ${symbol} to this address`}
        />
      )}

      {/* Instructions */}
      <div className="flex flex-col gap-2 w-full">
        <div
          className="flex items-center gap-2 p-3 rounded-sm w-full"
          style={{
            background: "rgba(0,255,65,0.04)",
            border: "1px solid rgba(0,255,65,0.1)",
          }}
        >
          <div className="shrink-0">
            <ShieldIcon size={14} color="#7c7fff" />
          </div>
          <span className="text-[12px] text-[rgba(255,255,255,0.4)]">
            This is a one-time stealth address. Send any amount of {symbol} from any wallet.
          </span>
        </div>

        <span className="text-[11px] text-[rgba(255,255,255,0.3)] text-center">
          You can close this page — the address is ready to receive
        </span>
      </div>
    </div>
  );
}
