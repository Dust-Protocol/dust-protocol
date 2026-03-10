"use client";

import React, { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircleIcon, AlertCircleIcon } from "@/components/stealth/icons";
import { storageKey } from "@/lib/storageKey";

interface ActivateStepProps {
  username: string;
  pin: string;
  onComplete: () => void;
}

type ActivationStatus = "idle" | "signing" | "activating" | "done" | "error";

export function ActivateStep({ username, pin, onComplete }: ActivateStepProps) {
  const { address, deriveKeysFromWallet, setPin: storePinEncrypted, registerMetaAddress, registerName, formatName } = useAuth();
  const [status, setStatus] = useState<ActivationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const activatingRef = useRef(false);

  const handleActivate = async () => {
    if (activatingRef.current) return;
    activatingRef.current = true;
    setStatus("signing");
    setError(null);

    try {
      const result = await deriveKeysFromWallet(pin);
      if (!result) throw new Error("Please approve the signature in your wallet");

      setStatus("activating");

      const pinStored = await storePinEncrypted(pin, result.sig);
      if (!pinStored) throw new Error("Failed to store PIN");

      const [nameTx] = await Promise.all([
        registerName(username, result.metaAddress),
        registerMetaAddress().catch(() => null),
      ]);
      // nameTx is a txHash string (new registration), 'already-registered' (idempotent),
      // or null (failure). Treat any truthy value as success.
      if (!nameTx) throw new Error("Failed to register name");

      if (address) {
        localStorage.setItem(storageKey('onboarded', address), 'true');
      }

      setStatus("done");
      onComplete();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Activation failed";
      setError(msg);
      setStatus("error");
    } finally {
      activatingRef.current = false;
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="text-[20px] font-semibold text-white tracking-tight">
          [ ACTIVATE ]
        </p>
        <p className="text-[13px] text-[rgba(255,255,255,0.4)] font-mono">
          Review and activate your private identity
        </p>
      </div>

      {/* Summary card */}
      <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-sm overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-[9px] uppercase tracking-wider font-mono text-[rgba(255,255,255,0.5)]">
            Username
          </span>
          <span className="text-[13px] font-medium text-[rgba(0,255,65,0.9)] font-mono">
            {formatName(username)}
          </span>
        </div>
        <div className="h-px bg-[rgba(255,255,255,0.06)]" />
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-[9px] uppercase tracking-wider font-mono text-[rgba(255,255,255,0.5)]">
            PIN
          </span>
          <span className="text-[13px] font-medium text-[rgba(255,255,255,0.6)] font-mono tracking-[2px]">
            ••••••
          </span>
        </div>
      </div>

      {/* Status */}
      {(status === "signing" || status === "activating") && (
        <div className="flex items-center gap-2 justify-center py-2">
          <svg
            className="animate-spin w-4 h-4 text-[rgba(0,255,65,0.8)]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-[13px] text-[rgba(255,255,255,0.5)] font-mono">
            {status === "signing" ? "Approve in wallet..." : "Setting up identity..."}
          </span>
        </div>
      )}

      {status === "done" && (
        <div className="flex items-center gap-[6px] justify-center py-2">
          <CheckCircleIcon size={14} color="#22C55E" />
          <span className="text-[13px] text-[#22C55E] font-medium font-mono">Activated</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-[6px] pl-[2px]">
          <AlertCircleIcon size={12} color="#ef4444" />
          <span className="text-[12px] text-[#ef4444] font-mono">{error}</span>
        </div>
      )}

      {/* CTA */}
      {(status === "idle" || status === "error") && (
        <button
          onClick={handleActivate}
          className="w-full h-11 py-3 px-4 rounded-sm bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41] text-sm font-bold text-[#00FF41] font-mono tracking-wider transition-all"
        >
          Activate
        </button>
      )}
    </div>
  );
}
