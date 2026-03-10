"use client";

import React, { useState, useEffect, ChangeEvent } from "react";
import { NAME_SUFFIX } from "@/lib/stealth";
import { useStealthName } from "@/hooks/stealth";
import { CheckCircleIcon, AlertCircleIcon } from "@/components/stealth/icons";

interface UsernameStepProps {
  onNext: (name: string) => void;
  onReclaim?: () => void;
  initialName?: string;
}

export function UsernameStep({ onNext, onReclaim, initialName = "" }: UsernameStepProps) {
  const [nameInput, setNameInput] = useState(initialName);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const { checkAvailability, validateName, formatName, isConfigured } = useStealthName();

  useEffect(() => {
    const check = async () => {
      if (!nameInput || !isConfigured) { setIsAvailable(null); return; }
      if (!validateName(nameInput).valid) { setIsAvailable(null); return; }
      setIsChecking(true);
      const available = await checkAvailability(nameInput);
      setIsAvailable(available);
      setIsChecking(false);
    };
    const timer = setTimeout(check, 500);
    return () => clearTimeout(timer);
  }, [nameInput, isConfigured, validateName, checkAvailability]);

  const validation = nameInput ? validateName(nameInput) : null;
  const canContinue = isAvailable === true && validation?.valid;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="text-[20px] font-semibold text-white tracking-tight">
          [ USERNAME ]
        </p>
        <p className="text-[13px] text-[rgba(255,255,255,0.4)] font-mono">
          How others will find and pay you
        </p>
      </div>

      <div className="flex flex-col gap-[6px]">
        {/* Input row */}
        <div className="relative">
          <input
            type="text"
            placeholder="yourname"
            value={nameInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setNameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
            }
            className="w-full p-3 pr-[65px] rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-white font-mono text-sm focus:outline-none focus:border-[#00FF41] transition-all placeholder-[rgba(255,255,255,0.2)]"
          />
          <span className="absolute right-[14px] top-1/2 -translate-y-1/2 text-[14px] font-medium text-[rgba(255,255,255,0.3)] font-mono pointer-events-none">
            {NAME_SUFFIX}
          </span>
        </div>

        {/* Status row — fixed height to avoid layout shift */}
        <div className="h-[18px] pl-[2px]">
          {isChecking && (
            <div className="flex items-center gap-[5px]">
              <svg
                className="animate-spin w-3 h-3 text-[rgba(0,255,65,0.6)]"
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
              <span className="text-[12px] text-[rgba(255,255,255,0.3)] font-mono">Checking...</span>
            </div>
          )}
          {!isChecking && isAvailable === true && nameInput && (
            <div className="flex items-center gap-[5px]">
              <CheckCircleIcon size={12} color="#22C55E" />
              <span className="text-[12px] text-[rgba(34,197,94,0.8)] font-medium font-mono">
                {formatName(nameInput)} is available
              </span>
            </div>
          )}
          {!isChecking && isAvailable === false && nameInput && (
            <div className="flex items-center gap-[5px]">
              <AlertCircleIcon size={12} color="#ef4444" />
              <span className="text-[12px] text-[#ef4444] font-medium font-mono">
                {formatName(nameInput)} is taken
              </span>
            </div>
          )}
          {!isChecking && validation && !validation.valid && nameInput && (
            <div className="flex items-center gap-[5px]">
              <AlertCircleIcon size={12} color="#FFB000" />
              <span className="text-[12px] text-[#FFB000] font-mono">{validation.error}</span>
            </div>
          )}
          {!isChecking && isAvailable === null && validation?.valid && nameInput && (
            <div className="flex items-center gap-[5px]">
              <AlertCircleIcon size={12} color="#FFB000" />
              <span className="text-[12px] text-[#FFB000] font-mono">Could not check availability — try again</span>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => canContinue && onNext(nameInput)}
        disabled={!canContinue}
        className={[
          "w-full h-11 rounded-sm text-[14px] font-bold font-mono tracking-wider transition-all",
          canContinue
            ? "py-3 px-4 bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41] text-[#00FF41]"
            : "bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.3)] cursor-not-allowed",
        ].join(" ")}
      >
        Continue
      </button>

      {/* Reclaim existing account */}
      {onReclaim && (
        <button
          onClick={onReclaim}
          className="w-full text-center text-[12px] text-[rgba(255,255,255,0.35)] hover:text-[rgba(255,255,255,0.6)] font-mono transition-colors"
        >
          Already have an account? Reclaim it
        </button>
      )}
    </div>
  );
}
