"use client";

import React from "react";
import type { SwapToken } from "@/lib/swap/constants";
import { TokenIcon } from "@/components/stealth/icons";

interface TokenInputProps {
  label: string;
  amount: string;
  onAmountChange: (amount: string) => void;
  token: SwapToken | null;
  onTokenSelect?: () => void;
  balance?: string;
  disabled?: boolean;
}

export function TokenInput({
  label,
  amount,
  onAmountChange,
  token,
  onTokenSelect,
  balance,
  disabled,
}: TokenInputProps) {
  const handlePercentage = (percent: number) => {
    if (!balance) return;
    const bal = parseFloat(balance.replace(/,/g, ""));
    if (isNaN(bal)) return;
    onAmountChange(((bal * percent) / 100).toString());
  };

  return (
    <div
      className="rounded-sm p-4 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] transition-all focus-within:border-[rgba(0,255,65,0.5)]"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-[10px]">
        <span className="text-[12px] text-[rgba(255,255,255,0.30)] font-semibold font-mono">
          {label}
        </span>
        {balance && (
          <span className="text-[12px] text-[rgba(255,255,255,0.30)] font-mono">
            Balance:{" "}
            <span className="font-mono text-[rgba(255,255,255,0.65)]">{balance}</span>
          </span>
        )}
      </div>

      {/* Input row */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            const value = e.target.value.replace(/[^0-9.]/g, "");
            onAmountChange(value);
          }}
          placeholder="0.0"
          disabled={disabled}
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-[24px] font-mono font-medium text-[rgba(255,255,255,0.92)] p-0 placeholder-[rgba(255,255,255,0.30)] focus:outline-none focus:ring-0 disabled:opacity-60 disabled:cursor-not-allowed"
        />

        <button
          type="button"
          onClick={onTokenSelect}
          disabled={!onTokenSelect}
          className={[
            "flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-sm",
            "bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)]",
            "transition-all",
            onTokenSelect
              ? "cursor-pointer hover:border-[rgba(0,255,65,0.35)]"
              : "cursor-default",
          ].join(" ")}
        >
          {token ? (
            <>
              <TokenIcon symbol={token.symbol} size={24} />
              <span className="font-semibold text-[rgba(255,255,255,0.92)] whitespace-nowrap text-[14px] font-mono">
                {token.symbol}
              </span>
            </>
          ) : (
            <span className="font-semibold text-[rgba(255,255,255,0.92)] whitespace-nowrap text-[14px] font-mono">
              Select
            </span>
          )}
          {onTokenSelect && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.30)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </button>
      </div>

      {/* Percentage buttons */}
      {balance && !disabled && (
        <div className="flex gap-2 mt-3">
          {[25, 50, 75, 100].map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => handlePercentage(percent)}
              className="flex-1 px-2 py-[6px] rounded-sm text-[11px] font-semibold font-mono bg-[rgba(0,255,65,0.08)] text-[#00FF41] border border-[rgba(0,255,65,0.15)] cursor-pointer transition-all text-center hover:bg-[rgba(0,255,65,0.15)] hover:border-[rgba(0,255,65,0.3)]"
            >
              {percent === 100 ? "MAX" : `${percent}%`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
