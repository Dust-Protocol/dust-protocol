"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ConnectButton } from "@/components/ConnectButton";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { DustLogo } from "@/components/DustLogo";


export default function OnboardingPage() {
  const { isConnected, isOnboarded, isHydrated, isNamesSettled, address } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isHydrated) return;
    if (!isConnected) router.replace("/");
    // Wait for address before checking isOnboarded — avoids flash of onboarding wizard
    // when wallet is connected but address hasn't populated yet
    if (isConnected && !address) return;
    // Wait for on-chain name query to settle before allowing onboarding to proceed.
    // If a name is found on-chain (cleared cache / new browser), isOnboarded flips true
    // and we redirect to dashboard instead of showing the onboarding wizard.
    if (!isNamesSettled) return;
    if (isOnboarded) router.replace("/dashboard");
  }, [isConnected, isOnboarded, isHydrated, isNamesSettled, address, router]);

  // Also gate on isOnboarded so the wizard never renders for users who are already onboarded
  // (e.g. cleared cache / new browser — names settled and found → isOnboarded is true, redirect pending)
  if (!isConnected || !isHydrated || !isNamesSettled || isOnboarded) return null;

  return (
    <>
      <style>{`
        @keyframes wizard-enter {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .wizard-enter {
          animation: wizard-enter 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Container with background */}
      <div className="min-h-screen bg-[#06080F] text-white flex flex-col relative overflow-hidden">

        {/* Background video layer */}
        <div className="absolute top-0 left-0 w-full h-full z-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover brightness-75"
          >
            <source src="/bg.webm" type="video/webm" />
          </video>
        </div>

        {/* Header — transparent overlay */}
        <header className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(6,8,15,0.2)] backdrop-blur-md relative z-[100] px-6 py-4">
          <div className="flex items-center justify-between max-w-[1200px] mx-auto">
            <div className="flex items-center gap-3">
              <DustLogo size={26} color="#00FF41" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-bold tracking-widest text-white font-mono">DUST</span>
                <span className="text-[10px] font-mono tracking-[0.25em] text-[rgba(0,255,65,0.35)] uppercase">PROTOCOL</span>
              </div>
            </div>
            <ConnectButton />
          </div>
        </header>

        {/* Wizard — centered in remaining space */}
        <div className="flex-1 flex items-center justify-center px-5 py-8 relative z-10 wizard-enter">
          <OnboardingWizard />
        </div>
      </div>
    </>
  );
}
