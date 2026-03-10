"use client";

import { useState, useRef, useEffect, useCallback, KeyboardEvent, ChangeEvent } from "react";
import { AlertCircleIcon, ShieldIcon } from "@/components/stealth/icons";
import { useAuth } from "@/contexts/AuthContext";

interface PinGateProps {
  onUnlocked: () => void;
}

export function PinGate({ onUnlocked }: PinGateProps) {
  const { verifyPin, deriveKeysFromWallet, isPinVerified, verifiedPin, pinError } = useAuth();
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (isPinVerified && verifiedPin) {
      onUnlocked();
    }
  }, [isPinVerified, verifiedPin, onUnlocked]);

  const handleChange = (index: number, digit: string) => {
    if (!/^\d?$/.test(digit)) return;
    const arr = pin.split("");
    arr[index] = digit;
    const newVal = arr.join("").slice(0, 6);
    setPin(newVal);
    if (digit && index < 5) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handleUnlock = useCallback(async () => {
    if (pin.length !== 6 || isVerifying) return;
    setIsVerifying(true);
    setError(null);
    try {
      const ok = await verifyPin(pin);
      if (ok) {
        await deriveKeysFromWallet(pin);
        onUnlocked();
      } else {
        setError("Incorrect PIN");
        setPin("");
        refs.current[0]?.focus();
      }
    } catch {
      setError("Verification failed");
      setPin("");
      refs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  }, [pin, isVerifying, verifyPin, deriveKeysFromWallet, onUnlocked]);

  useEffect(() => {
    if (pin.length === 6) handleUnlock();
  }, [pin, handleUnlock]);

  return (
    <div className="fixed inset-0 z-50 bg-[#06080F] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[400px] px-8 py-10 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] rounded-sm">
        <div className="flex flex-col items-center gap-7">

          {/* Icon + Title */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-[rgba(0,255,65,0.06)] border border-[rgba(0,255,65,0.15)] flex items-center justify-center">
              <ShieldIcon size={28} color="#00FF41" />
            </div>
            <p className="text-[11px] font-mono font-bold tracking-[0.25em] text-[#00FF41] uppercase">
              ENTER_PIN
            </p>
            <p className="text-[13px] font-mono text-white/40">
              Enter your PIN to unlock
            </p>
          </div>

          {/* PIN Digit Boxes */}
          <div className="flex gap-2.5 justify-center">
            {Array.from({ length: 6 }).map((_, i) => (
              <input
                key={i}
                ref={(el) => { refs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={1}
                value={pin[i] || ""}
                onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(i, e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => handleKeyDown(i, e)}
                disabled={isVerifying}
                style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
                className="w-12 h-14 rounded-sm border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] text-center text-xl font-bold font-mono text-white focus:border-[#00FF41] focus:outline-none focus:bg-[rgba(0,255,65,0.02)] transition-all caret-[#00FF41] disabled:opacity-40"
              />
            ))}
          </div>

          {/* Verifying spinner */}
          {isVerifying && (
            <div className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4 text-[#00FF41]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-[13px] font-mono text-white/40">Verifying...</span>
            </div>
          )}

          {/* Error message */}
          {(error || pinError) && (
            <div className="flex items-center gap-2 px-4 py-3 bg-[rgba(255,59,48,0.08)] border border-[rgba(255,59,48,0.25)] rounded-sm w-full">
              <AlertCircleIcon size={14} color="#FF3B30" />
              <span className="text-[13px] font-mono text-[#FF3B30]">{error || pinError}</span>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
