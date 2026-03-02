"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "./Navbar";
import { ChainMismatchBanner } from "./ChainMismatchBanner";
import { Toast } from "@/components/ui/Toast";
import { PinGate } from "@/components/auth/PinGate";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isConnected, isOnboarded, isNamesSettled, isHydrated, address, hasPin,
          stealthKeys, autoRestoreFailed, chainSwitchError, clearChainSwitchError } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [pinUnlocked, setPinUnlocked] = useState(false);

  useEffect(() => {
    setPinUnlocked(false);
  }, [address]);

  // Auto-restore succeeded — mark as unlocked
  useEffect(() => {
    if (stealthKeys) {
      setPinUnlocked(true);
    }
  }, [stealthKeys]);

  const handlePinUnlocked = useCallback(() => {
    setPinUnlocked(true);
  }, []);

  useEffect(() => {
    if (pathname === "/" || pathname.startsWith("/pay/") || pathname === "/onboarding" || pathname.startsWith("/docs")) return;
    if (!isHydrated) return;
    if (!isConnected) { router.replace("/"); return; }
    if (!address) return;
    if (!isOnboarded && isNamesSettled) { router.replace("/onboarding"); return; }
  }, [isConnected, isOnboarded, isNamesSettled, isHydrated, address, pathname, router]);

  if (pathname === "/" || pathname === "/onboarding" || pathname.startsWith("/pay/")) {
    return <>{children}</>;
  }

  if (pathname.startsWith("/docs")) {
    return (
      <div className="min-h-screen bg-[#06080F] text-white">
        <Navbar />
        <ChainMismatchBanner />
        <main className="pt-14">
          {children}
        </main>
        {chainSwitchError && <Toast message={chainSwitchError} variant="error" onDismiss={clearChainSwitchError} />}
      </div>
    );
  }

  if (!isHydrated || !isConnected || !address) {
    return (
      <div className="min-h-screen bg-[#06080F] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#00FF41] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // PinGate only shows as fallback when auto-restore fails (e.g. user rejected signature, wallet mismatch)
  const needsPinUnlock = hasPin && !pinUnlocked && !stealthKeys && autoRestoreFailed;
  // Brief spinner while auto-restore is in progress (silent for Privy, one popup for MetaMask)
  const isAutoRestoring = hasPin && !stealthKeys && !autoRestoreFailed && !pinUnlocked;

  return (
    <div className="min-h-screen bg-[#06080F] text-white">
      <Navbar />
      <ChainMismatchBanner />
      <main className="pt-14">
        {isAutoRestoring ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-[#00FF41] border-t-transparent rounded-full animate-spin" />
              <span className="text-[13px] font-mono text-white/40">Restoring keys...</span>
            </div>
          </div>
        ) : needsPinUnlock ? (
          <PinGate onUnlocked={handlePinUnlocked} />
        ) : children}
      </main>
      {chainSwitchError && <Toast message={chainSwitchError} variant="error" onDismiss={clearChainSwitchError} />}
    </div>
  );
}
