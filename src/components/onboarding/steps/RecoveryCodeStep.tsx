"use client";

import React, { useState, useCallback } from "react";

interface RecoveryCodeStepProps {
  code: string;
  onNext: () => void;
}

export function RecoveryCodeStep({ code, onNext }: RecoveryCodeStepProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);
  const words = code.split(" ");

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard API unavailable */
    }
  }, [code]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-[20px] font-semibold text-white tracking-tight">
          [ RECOVERY CODE ]
        </p>
        <p className="text-[13px] text-[rgba(255,255,255,0.4)] font-mono">
          Save these 12 words to recover your PIN
        </p>
      </div>

      <div className="p-4 rounded-sm border border-[rgba(255,176,0,0.3)] bg-[rgba(255,176,0,0.06)]">
        <p className="text-xs font-mono font-bold text-[#FFB000] mb-1 tracking-wide">
          WRITE THIS DOWN
        </p>
        <p className="text-[11px] font-mono text-[rgba(255,255,255,0.6)] leading-relaxed">
          If you forget your PIN, this recovery code is the only way to reset it. Store it somewhere safe — it will not be shown again.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 p-4 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)]">
        {words.map((word, i) => (
          <div key={i} className="flex items-center gap-1.5 py-1.5 px-2 rounded-sm bg-[rgba(255,255,255,0.03)]">
            <span className="text-[10px] text-[rgba(255,255,255,0.25)] font-mono w-4 text-right">{i + 1}.</span>
            <span className="text-[13px] text-white font-mono">{word}</span>
          </div>
        ))}
      </div>

      <button
        onClick={handleCopy}
        className="w-full h-9 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.2)] font-mono text-[12px] text-[rgba(255,255,255,0.5)] transition-all"
      >
        {copied ? "Copied" : "Copy to clipboard"}
      </button>

      <label className="flex items-start gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded-sm border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.03)] accent-[#00FF41] cursor-pointer"
        />
        <span className="text-[12px] text-[rgba(255,255,255,0.5)] font-mono leading-relaxed">
          I have saved my recovery code in a safe place
        </span>
      </label>

      <button
        onClick={onNext}
        disabled={!acknowledged}
        className={[
          "w-full h-11 rounded-sm text-[14px] font-bold font-mono tracking-wider transition-all",
          acknowledged
            ? "py-3 px-4 bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41] text-[#00FF41]"
            : "bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.3)] cursor-not-allowed",
        ].join(" ")}
      >
        Continue
      </button>
    </div>
  );
}
