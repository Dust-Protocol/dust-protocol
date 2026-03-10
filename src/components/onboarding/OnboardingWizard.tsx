"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { UsernameStep } from "./steps/UsernameStep";
import { PinStep } from "./steps/PinStep";
import { storageKey } from "@/lib/storageKey";
import { getChainConfig } from "@/config/chains";
import { AlertCircle as AlertCircleIcon } from "lucide-react";

type Step = "username" | "pin" | "activating";
const STEPS_FULL: Step[] = ["username", "pin"];
const STEPS_REACTIVATE: Step[] = ["pin"];

export function OnboardingWizard() {
  const router = useRouter();
  const { address, activeChainId, ownedNames, deriveKeysFromWallet, setPin: storePinEncrypted, registerMetaAddress, registerName } = useAuth();

  // Re-activation: user has an on-chain name but localStorage was cleared (new browser / cleared cache)
  const isReactivation = ownedNames.length > 0;
  const existingName = ownedNames[0]?.fullName ?? "";

  // Reclaim flow: user says "I already have an account" — go to PIN first, then look up name by metaAddress
  const [isReclaiming, setIsReclaiming] = useState(false);

  const STEPS = (isReactivation || isReclaiming) ? STEPS_REACTIVATE : STEPS_FULL;

  const [step, setStep] = useState<Step>((isReactivation || isReclaiming) ? "pin" : "username");
  const [username, setUsername] = useState(isReactivation ? (ownedNames[0]?.name ?? "") : "");
  const [error, setError] = useState<string | null>(null);
  const [metaRegWarning, setMetaRegWarning] = useState<string | null>(null);
  const activatingRef = useRef(false);

  // If names load after mount (async) and we haven't moved yet, jump to pin
  useEffect(() => {
    if (ownedNames.length > 0 && step === "username") {
      setUsername(ownedNames[0].name);
      setStep("pin");
    }
  }, [ownedNames, step]);

  const currentIndex = step === "activating" ? STEPS.length : STEPS.indexOf(step);

  const handleReclaim = () => {
    setIsReclaiming(true);
    setStep("pin");
  };

  // Retry ERC-6538 registration up to 3 times with backoff.
  // Returns true if registration succeeded, false otherwise.
  const tryRegisterMeta = async (chainId: number, attempts = 3): Promise<boolean> => {
    for (let i = 0; i < attempts; i++) {
      const txHash = await registerMetaAddress(chainId);
      if (txHash) return true;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
    console.error('[OnboardingWizard] ERC-6538 registration failed after', attempts, 'attempts on chain', chainId);
    return false;
  };

  const handlePinComplete = async (pin: string) => {
    if (activatingRef.current) return;
    activatingRef.current = true;
    setStep("activating");
    setError(null);

    try {
      const result = await deriveKeysFromWallet(pin);
      if (!result) throw new Error("Please approve the signature in your wallet");

      const pinStored = await storePinEncrypted(pin, result.sig);
      if (!pinStored) throw new Error("Failed to store PIN");

      // Re-check ownedNames at activation time — names may have loaded asynchronously
      // after the wizard first rendered (cleared cache / new browser). In that case
      // isReactivation (captured at render) could be stale.
      const alreadyHasName = ownedNames.length > 0;

      // Track locally — setMetaRegWarning won't update the closure variable
      let hasMetaWarning = false;

      if (alreadyHasName) {
        // Wallet already has a name — just re-derive keys and re-register ERC-6538 meta-address.
        // Skip registerName to avoid an unnecessary API call.
        const metaOk = await tryRegisterMeta(activeChainId);
        if (!metaOk) {
          hasMetaWarning = true;
          setMetaRegWarning("Account restored, but stealth keys couldn't be registered on-chain. Your account may not be discoverable from other devices.");
        }
      } else if (isReclaiming) {
        // Reclaim flow: user says they already have an account.
        // Use derived metaAddress to find their name via server-side lookup.
        const normalizedMeta = (result.metaAddress.match(/^st:[a-z]+:(0x[0-9a-fA-F]+)$/)?.[1] || result.metaAddress).toLowerCase();
        const reclaimRes = await fetch(`/api/reclaim-name?metaAddress=${normalizedMeta}&registrant=${address}`);
        if (reclaimRes.ok) {
          const reclaimData = await reclaimRes.json();
          if (reclaimData.name) {
            setUsername(reclaimData.name);
            // Re-register ERC-6538 meta-address in background with retry
            tryRegisterMeta(activeChainId);
          } else {
            // No name found — this wallet hasn't registered a name before
            throw new Error("No existing account found — please go back and create a new username");
          }
        } else {
          throw new Error("Failed to look up existing account");
        }
      } else {
        // Fresh onboarding — register the chosen name on-chain.
        // registerName returns the txHash string, or 'already-registered' for idempotent re-reg.
        const [nameTx, metaOk] = await Promise.all([
          registerName(username, result.metaAddress),
          tryRegisterMeta(activeChainId),
        ]);
        if (!nameTx) throw new Error("Failed to register name");
        if (!metaOk) {
          hasMetaWarning = true;
          setMetaRegWarning("Account created, but stealth keys couldn't be registered on-chain. Your account may not be discoverable from other devices.");
        }
      }

      if (address) {
        localStorage.setItem(storageKey('onboarded', address), 'true');
      }

      // If meta registration failed, briefly show warning before navigating
      if (hasMetaWarning) {
        await new Promise(r => setTimeout(r, 3000));
      }

      router.replace("/dashboard");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Activation failed";
      setError(msg);
      setStep(isReclaiming ? "pin" : "pin");
      activatingRef.current = false;
    }
  };

  return (
    <div className="w-full max-w-[420px] mx-auto">
      <div className="bg-[rgba(6,8,15,0.85)] backdrop-blur-md border border-[rgba(255,255,255,0.12)] rounded-sm overflow-hidden shadow-[0_8px_48px_rgba(0,0,0,0.6)]">
        {/* Progress dots */}
        <div className="flex gap-[6px] justify-center pt-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="w-[6px] h-[6px] rounded-full transition-all"
              style={{
                backgroundColor:
                  i < currentIndex
                    ? "rgba(0,239,139,0.5)"
                    : i === currentIndex
                    ? "rgba(255,255,255,0.8)"
                    : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>

        {/* Re-activation banner */}
        {(isReactivation || isReclaiming) && step !== "activating" && (
          <div className="mx-7 md:mx-9 mt-5 px-3 py-2.5 rounded-sm bg-[rgba(0,239,139,0.05)] border border-[rgba(0,239,139,0.15)] flex flex-col gap-0.5">
            <p className="text-[11px] font-mono text-[rgba(0,239,139,0.7)] uppercase tracking-widest">Welcome back</p>
            {existingName && <p className="text-[13px] text-white font-semibold">{existingName}</p>}
            <p className="text-[11px] text-[rgba(255,255,255,0.4)] font-mono mt-0.5">
              Enter your PIN to re-activate your private wallet.
            </p>
          </div>
        )}

        {/* Content */}
        <div className="px-7 md:px-9 pt-6 pb-8">
          {step === "username" && (
            <UsernameStep
              onNext={(name) => { setUsername(name); setStep("pin"); }}
              onReclaim={handleReclaim}
              initialName={username}
            />
          )}
          {step === "pin" && (
            <PinStep onNext={handlePinComplete} />
          )}
          {step === "activating" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <p className="text-[20px] font-semibold text-white tracking-tight">
                  {isReactivation ? "Re-activating wallet" : "Setting up your wallet"}
                </p>
                <p className="text-[13px] text-[rgba(255,255,255,0.4)]">
                  {error ? "Activation failed" : isReactivation ? "Restoring your private identity..." : "Creating your private identity..."}
                </p>
                {!error && (
                  <p className="text-[11px] text-[rgba(255,255,255,0.25)]">
                    Registering on {getChainConfig(activeChainId).name}
                  </p>
                )}
              </div>

              {!error && (
                <div className="flex items-center gap-2 justify-center py-8">
                  {/* Spinner */}
                  <svg
                    className="animate-spin w-4 h-4 text-[rgba(0,239,139,0.8)]"
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
                    Please wait...
                  </span>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-[6px] pl-[2px]">
                  <AlertCircleIcon size={12} color="#ef4444" />
                  <span className="text-[12px] text-[#ef4444] font-mono">{error}</span>
                </div>
              )}

              {metaRegWarning && !error && (
                <div className="flex items-start gap-[6px] pl-[2px] px-1 py-2 bg-[rgba(255,200,0,0.05)] border border-[rgba(255,200,0,0.15)] rounded-sm">
                  <AlertCircleIcon size={12} color="#eab308" className="mt-0.5 shrink-0" />
                  <span className="text-[11px] text-[#eab308] font-mono">{metaRegWarning}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
