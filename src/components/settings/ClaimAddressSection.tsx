"use client";

import React from "react";
import { getChainConfig } from "@/config/chains";
import { useAuth } from "@/contexts/AuthContext";
import type { ClaimAddress } from "@/lib/design/types";
import { WalletIcon } from "@/components/stealth/icons";

interface ClaimAddressSectionProps {
  claimAddresses: ClaimAddress[];
  claimAddressesInitialized: boolean;
}

export function ClaimAddressSection({ claimAddresses, claimAddressesInitialized }: ClaimAddressSectionProps) {
  const { activeChainId } = useAuth();
  const symbol = getChainConfig(activeChainId).nativeCurrency.symbol;
  if (!claimAddressesInitialized) return null;

  return (
    <div className="p-6 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.03)] flex items-center justify-center flex-shrink-0">
            <WalletIcon size={16} color="rgba(255,255,255,0.5)" />
          </div>
          <span className="text-[15px] text-white font-semibold">Recovery Wallets</span>
        </div>

        <div className="flex flex-col">
          {claimAddresses.map((addr, idx) => (
            <div
              key={addr.address}
              className={`flex items-center justify-between py-3.5 ${
                idx < claimAddresses.length - 1 ? "border-b border-[rgba(255,255,255,0.06)]" : ""
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[14px] font-medium text-white">{addr.label || `Wallet ${idx + 1}`}</span>
                <span className="text-[11px] text-[rgba(255,255,255,0.5)] font-mono">
                  {addr.address.slice(0, 14)}...{addr.address.slice(-10)}
                </span>
              </div>
              <span className="text-[14px] font-medium text-[#7C3AED] font-mono">
                {parseFloat(addr.balance || "0").toFixed(4)} {symbol}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
