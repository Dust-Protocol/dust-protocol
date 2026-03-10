"use client";

import React, { useState, useRef, useEffect, KeyboardEvent, ChangeEvent, ClipboardEvent } from "react";
import { AlertCircleIcon } from "@/components/stealth/icons";

interface PinStepProps {
  onNext: (pin: string) => void;
}

function PinInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (value === "") refs.current[0]?.focus();
  }, [value]);

  const handleChange = (index: number, digit: string) => {
    if (!/^\d?$/.test(digit)) return;
    const arr = value.split("");
    arr[index] = digit;
    const newVal = arr.join("").slice(0, 6);
    onChange(newVal);
    if (digit && index < 5) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length > 0) {
      onChange(pasted);
      const focusIdx = Math.min(pasted.length, 5);
      refs.current[focusIdx]?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(i, e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
          className={[
            "w-11 h-[52px] text-center text-[20px] font-semibold rounded-sm font-mono",
            "bg-[rgba(255,255,255,0.03)] text-white",
            "border transition-all focus:outline-none focus:border-[#00FF41]",
            value[i]
              ? "border-[rgba(255,255,255,0.15)]"
              : "border-[rgba(255,255,255,0.1)]",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

export function PinStep({ onNext }: PinStepProps) {
  const [step, setStep] = useState<"create" | "confirm">("create");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Auto-submit when 6 digits entered (create step)
  useEffect(() => {
    if (step === "create" && pin.length === 6) {
      setError(null);
      setStep("confirm");
      setConfirmPin("");
    }
  }, [pin, step]);

  // Auto-submit when 6 digits entered (confirm step)
  useEffect(() => {
    if (step === "confirm" && confirmPin.length === 6) {
      if (confirmPin !== pin) {
        setError("PINs do not match");
        setConfirmPin("");
      } else {
        setError(null);
        onNext(pin);
      }
    }
  }, [confirmPin, step, pin, onNext]);

  const handleCreateNext = () => {
    if (pin.length !== 6) { setError("PIN must be 6 digits"); return; }
    setError(null);
    setStep("confirm");
    setConfirmPin("");
  };

  const handleConfirm = () => {
    if (confirmPin !== pin) {
      setError("PINs do not match");
      setConfirmPin("");
      return;
    }
    setError(null);
    onNext(pin);
  };

  const isReady = step === "create" ? pin.length === 6 : confirmPin.length === 6;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="text-[20px] font-semibold text-white tracking-tight">
          {step === "create" ? "[ CREATE PIN ]" : "[ CONFIRM PIN ]"}
        </p>
        <p className="text-[13px] text-[rgba(255,255,255,0.4)] font-mono">
          {step === "create"
            ? "Your PIN + wallet signature creates your stealth keys"
            : "Enter the same PIN to confirm"}
        </p>
      </div>

      {step === "create" ? (
        <PinInput value={pin} onChange={setPin} />
      ) : (
        <PinInput value={confirmPin} onChange={setConfirmPin} />
      )}

      {error && (
        <div className="flex items-center gap-[6px] pl-[2px]">
          <AlertCircleIcon size={12} color="#ef4444" />
          <span className="text-[12px] text-[#ef4444] font-mono">{error}</span>
        </div>
      )}

      <div className="flex gap-[10px]">
        {step === "confirm" && (
          <button
            onClick={() => { setStep("create"); setPin(""); setConfirmPin(""); setError(null); }}
            className="flex-1 h-11 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.2)] font-medium text-[14px] text-[rgba(255,255,255,0.5)] font-mono tracking-wider transition-all"
          >
            Back
          </button>
        )}
        <button
          onClick={step === "create" ? handleCreateNext : handleConfirm}
          disabled={!isReady}
          className={[
            "h-11 rounded-sm text-[14px] font-bold font-mono tracking-wider transition-all",
            step === "confirm" ? "flex-[2]" : "w-full",
            isReady
              ? "py-3 px-4 bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41] text-[#00FF41]"
              : "bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.3)] cursor-not-allowed",
          ].join(" ")}
        >
          {step === "create" ? "Continue" : "Confirm"}
        </button>
      </div>

      <p className="text-[11px] text-[rgba(255,255,255,0.3)] leading-relaxed font-mono">
        This PIN cannot be recovered. You would need to create a new identity.
      </p>
    </div>
  );
}
