"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { UsernameStep } from "./steps/UsernameStep";
import { PinStep } from "./steps/PinStep";
import { RecoveryCodeStep } from "./steps/RecoveryCodeStep";
import { storageKey } from "@/lib/storageKey";
import { getChainConfig } from "@/config/chains";
import { AlertCircle as AlertCircleIcon } from "lucide-react";
import { generateRecoveryCode, storeRecoveryHash } from "@/lib/stealth/recovery";

type Step = "username" | "pin" | "recovery" | "activating" | "success";
const STEPS_FULL: Step[] = ["username", "pin", "recovery"];
const STEPS_REACTIVATE: Step[] = ["pin", "recovery"];

const STEP_TIME_ESTIMATES: Record<Step, string> = {
  username: "~30 seconds",
  pin: "~30 seconds",
  recovery: "~15 seconds",
  activating: "~1 minute",
  success: "",
};

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
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const pendingPinRef = useRef<string | null>(null);
  const pendingSigRef = useRef<string | null>(null);
  const pendingMetaRef = useRef<string | null>(null);

  // If names load after mount (async) and we haven't moved yet, jump to pin
  useEffect(() => {
    if (ownedNames.length > 0 && step === "username") {
      setUsername(ownedNames[0].name);
      setStep("pin");
    }
  }, [ownedNames, step]);

  const currentIndex = (step === "activating" || step === "success") ? STEPS.length : STEPS.indexOf(step);

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
    setError(null);

    try {
      const result = await deriveKeysFromWallet(pin);
      if (!result) throw new Error("Please approve the signature in your wallet");

      const pinStored = await storePinEncrypted(pin, result.sig);
      if (!pinStored) throw new Error("Failed to store PIN");

      const code = generateRecoveryCode(result.sig, pin);
      if (address) storeRecoveryHash(address, code);
      setRecoveryCode(code);
      pendingPinRef.current = pin;
      pendingSigRef.current = result.sig;
      pendingMetaRef.current = result.metaAddress;
      setStep("recovery");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Activation failed";
      setError(msg);
    }
  };

  const handleRecoveryAcknowledged = async () => {
    if (activatingRef.current) return;
    activatingRef.current = true;
    setStep("activating");
    setError(null);
    setRecoveryCode(null);

    const pin = pendingPinRef.current!;
    const result = { sig: pendingSigRef.current!, metaAddress: pendingMetaRef.current! };

    try {

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

        // Push account metadata backup to relayer (non-blocking)
        try {
          const { deriveSpendingSeed } = await import('@/lib/stealth/pin');
          const spendingSeedHex = await deriveSpendingSeed(result.sig, pin);
          const BN254_ORDER = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
          const spendingKey = BigInt('0x' + spendingSeedHex) % BN254_ORDER;

          const encryptedPin = localStorage.getItem(storageKey('encrypted-pin', address));
          const recoveryHashStored = localStorage.getItem(storageKey('recovery-hash', address));

          if (encryptedPin) {
            const { pushAccountBackup } = await import('@/lib/dustpool/v2/backup-client');
            pushAccountBackup(
              { encryptedPin, recoveryHash: recoveryHashStored || '', keyVersion: 1 },
              spendingKey,
            ).catch(() => {});
          }
        } catch {
          // Backup failure doesn't affect onboarding
        }
      }

      if (hasMetaWarning) {
        setMetaRegWarning("Account created. On-chain registration pending \u2014 your account may not be discoverable from other devices yet.");
        setStep("success");
        await new Promise(r => setTimeout(r, 3000));
      } else {
        setStep("success");
        await new Promise(r => setTimeout(r, 1500));
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
        <div className="flex flex-col items-center pt-5 gap-2">
          <div className="flex gap-[6px] justify-center">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="w-[6px] h-[6px] rounded-full transition-all"
                style={{
                  backgroundColor:
                    i < currentIndex
                      ? "rgba(0,255,65,0.5)"
                      : i === currentIndex
                      ? "rgba(255,255,255,0.8)"
                      : "rgba(255,255,255,0.1)",
                }}
              />
            ))}
          </div>
          {step !== "success" && (
            <p className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono tracking-wide">
              Step {Math.min(currentIndex + 1, STEPS.length)} of {STEPS.length}
              {step !== "activating" && STEP_TIME_ESTIMATES[step] ? ` \u00B7 ${STEP_TIME_ESTIMATES[step]}` : ""}
              {step === "activating" ? ` \u00B7 ${STEP_TIME_ESTIMATES.activating}` : ""}
            </p>
          )}
        </div>

        {/* Re-activation banner */}
        {(isReactivation || isReclaiming) && step !== "activating" && step !== "success" && (
          <div className="mx-7 md:mx-9 mt-5 px-3 py-2.5 rounded-sm bg-[rgba(0,255,65,0.05)] border border-[rgba(0,255,65,0.15)] flex flex-col gap-0.5">
            <p className="text-[11px] font-mono text-[rgba(0,255,65,0.7)] uppercase tracking-widest">Welcome back</p>
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
          {step === "recovery" && recoveryCode && (
            <RecoveryCodeStep code={recoveryCode} onNext={handleRecoveryAcknowledged} />
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
            </div>
          )}
          {step === "success" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1 items-center text-center py-4">
                <div className="w-10 h-10 rounded-full bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] flex items-center justify-center mb-2">
                  <svg className="w-5 h-5 text-[rgba(0,255,65,0.8)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-[20px] font-semibold text-white tracking-tight">
                  Your private wallet is ready!
                </p>
                <p className="text-[13px] text-[rgba(255,255,255,0.4)]">
                  Redirecting to dashboard...
                </p>
              </div>
              {metaRegWarning && (
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
