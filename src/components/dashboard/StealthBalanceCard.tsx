"use client";

import React, { useEffect, useRef } from "react";
import { getChainConfig } from "@/config/chains";
import { useAuth } from "@/contexts/AuthContext";
import type { StealthPayment } from "@/lib/design/types";
import { RefreshIcon, InfoIcon, ChainIcon } from "@/components/stealth/icons";

interface StealthBalanceCardProps {
  payments: StealthPayment[];
  isScanning: boolean;
  scan: () => void;
}

export function StealthBalanceCard({ payments, isScanning, scan }: StealthBalanceCardProps) {
  const { activeChainId } = useAuth();
  const chainConfig = getChainConfig(activeChainId);
  const symbol = chainConfig.nativeCurrency.symbol;
  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; scan(); }
  }, [scan]);

  const validPayments = payments.filter(p => !p.keyMismatch);
  const totalBalance = validPayments.reduce((sum, p) => sum + parseFloat(p.originalAmount || p.balance || "0"), 0);

  return (
    <div
      className="p-[3px] rounded-[18px]"
      style={{
        background: "linear-gradient(135deg, #00FF41 0%, #00FF41 50%, #00FF41 100%)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}
    >
      <div className="p-7 bg-[#0d0f1a] rounded-[17px]">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[17px] font-bold text-white">Your Stealth Balances</span>
              <InfoIcon size={16} color="rgba(255,255,255,0.3)" />
            </div>
            <button
              className="p-2 rounded-full cursor-pointer hover:bg-[rgba(255,255,255,0.06)] transition-colors duration-150"
              onClick={() => scan()}
            >
              {isScanning ? (
                <div className="w-[18px] h-[18px] border-2 border-[#7c7fff] border-t-transparent rounded-full animate-spin" />
              ) : (
                <RefreshIcon size={18} color="rgba(255,255,255,0.3)" />
              )}
            </button>
          </div>

          {/* Big balance */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[42px] font-extrabold text-white leading-none tracking-tight">
                {totalBalance.toFixed(4)}
              </span>
              <span className="text-[18px] font-medium text-[rgba(255,255,255,0.4)]">{symbol}</span>
            </div>
          </div>

          {/* Token summary */}
          {validPayments.length > 0 && (
            <div className="border-t border-[rgba(255,255,255,0.06)] pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, rgba(42,114,229,0.08) 0%, rgba(42,114,229,0.15) 100%)",
                      border: "1.5px solid rgba(42,114,229,0.2)",
                    }}
                  >
                    <ChainIcon size={28} chainId={activeChainId} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-base font-bold text-white">{symbol}</span>
                    <span className="text-[13px] text-[rgba(255,255,255,0.4)]">{chainConfig.name}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[17px] font-bold text-white">
                    {totalBalance.toFixed(4)}
                  </span>
                  <span className="text-[12px] text-[rgba(255,255,255,0.4)]">
                    {validPayments.length} payment{validPayments.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-3 bg-[rgba(0,255,65,0.04)] rounded-sm text-center">
            <span className="text-sm text-[#7c7fff] font-semibold">
              {validPayments.length === 0
                ? "No payments yet"
                : "Payments received privately through Dust"
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
