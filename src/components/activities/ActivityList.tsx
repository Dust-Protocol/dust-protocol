"use client";

import React, { useState } from "react";
import { getExplorerBase } from "@/lib/design/tokens";
import { getChainConfig } from "@/config/chains";
import { useAuth } from "@/contexts/AuthContext";
import type { StealthPayment, ClaimAddress, OutgoingPayment } from "@/lib/design/types";
import {
  ArrowDownLeftIcon, CheckCircleIcon, AlertCircleIcon,
  RefreshIcon, ZapIcon, ArrowUpRightIcon, FileTextIcon, SendIcon, TokenIcon,
} from "@/components/stealth/icons";

type Filter = "all" | "incoming" | "outgoing";

type ActivityItem =
  | { type: "incoming"; payment: StealthPayment; index: number; timestamp: number }
  | { type: "outgoing"; payment: OutgoingPayment; timestamp: number };

interface ActivityListProps {
  payments: StealthPayment[];
  outgoingPayments?: OutgoingPayment[];
  isScanning: boolean;
  scan: () => void;
  claimAddressesInitialized: boolean;
  claimAddresses: ClaimAddress[];
  selectedIndex: number;
  selectAddress: (idx: number) => void;
  handleClaim: (idx: number) => Promise<void>;
  claimingIndex: number | null;
  claimedTx: string | null;
  scanError: string | null;
}

export function ActivityList({
  payments, outgoingPayments, isScanning, scan,
  claimAddressesInitialized, claimAddresses, selectedIndex, selectAddress,
  handleClaim, claimingIndex, claimedTx, scanError,
}: ActivityListProps) {
  const { activeChainId } = useAuth();
  const explorerBase = getExplorerBase(activeChainId);
  const symbol = getChainConfig(activeChainId).nativeCurrency.symbol;
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  // Build unified activity list sorted by time (newest first)
  const allActivities: ActivityItem[] = [];

  payments.forEach((p, i) => {
    allActivities.push({
      type: "incoming",
      payment: p,
      index: i,
      // Use block number as rough timestamp proxy (higher = newer)
      timestamp: p.announcement.blockNumber,
    });
  });

  (outgoingPayments || []).forEach((p) => {
    allActivities.push({
      type: "outgoing",
      payment: p,
      timestamp: p.timestamp,
    });
  });

  // Sort: outgoing by timestamp (ms), incoming by blockNumber — normalize to comparable values
  // For display, just interleave with outgoing on top if recent
  allActivities.sort((a, b) => {
    const tA = a.type === "outgoing" ? a.timestamp : a.timestamp * 1000000; // block numbers are ~6M range
    const tB = b.type === "outgoing" ? b.timestamp : b.timestamp * 1000000;
    return tB - tA;
  });

  const filtered = allActivities.filter((item) => {
    if (filter === "all") return true;
    return item.type === filter;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Page heading */}
      <h1 className="text-2xl font-bold text-center text-[rgba(255,255,255,0.92)] font-mono">
        Activities
      </h1>

      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Pill tabs */}
        <div className="flex gap-2">
          {(["all", "incoming", "outgoing"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                "px-4 py-2 rounded-sm text-[11px] font-mono capitalize tracking-wider transition-all duration-150",
                filter === f
                  ? "bg-[#00FF41] text-black font-bold"
                  : "border border-white/[0.08] text-white/30 hover:text-white/60 hover:bg-white/[0.04]",
              ].join(" ")}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {/* Export CSV button */}
          <button
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-white/[0.08] text-[11px] font-mono text-white/50 hover:text-white/70 hover:bg-white/[0.04] transition-all duration-150"
            onClick={() => {
              if (filtered.length === 0) return;
              const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
              const header = `Type,Status,From/To,Amount (${symbol}),Tx Hash\n`;
              const rows = filtered.map(item => {
                if (item.type === "incoming") {
                  const p = item.payment;
                  const status = p.keyMismatch ? "Key Mismatch" : "Received";
                  const from = p.announcement.caller || "unknown";
                  const amount = parseFloat(p.originalAmount || p.balance || "0").toFixed(6);
                  const tx = p.announcement.txHash;
                  return ["Incoming", status, from, amount, tx].map(esc).join(",");
                } else {
                  const p = item.payment;
                  return ["Outgoing", "Sent", p.to, p.amount, p.txHash].map(esc).join(",");
                }
              }).join("\n");
              const blob = new Blob([header + rows], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `dust-activities-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <FileTextIcon size={14} color="rgba(255,255,255,0.30)" />
            Export CSV
          </button>

          {/* Scan button */}
          <button
            className="p-2 rounded-sm border border-white/[0.08] hover:bg-white/[0.04] transition-all duration-150"
            onClick={() => scan()}
          >
            {isScanning ? (
              <svg className="animate-spin w-4 h-4 text-[rgba(255,255,255,0.30)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <RefreshIcon size={16} color="rgba(255,255,255,0.30)" />
            )}
          </button>
        </div>
      </div>

      {/* Sponsored gas banner */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[rgba(0,255,65,0.04)] rounded-sm border border-[rgba(0,255,65,0.1)]">
        <div className="w-8 h-8 rounded-sm bg-[rgba(0,255,65,0.08)] flex items-center justify-center shrink-0">
          <ZapIcon size={16} color="#00FF41" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-[rgba(255,255,255,0.92)]">Auto-Claim Enabled</span>
          <span className="text-[11px] text-[rgba(255,255,255,0.30)]">
            Payments are automatically claimed to your wallet. Gas is sponsored by Dust.
          </span>
        </div>
      </div>

      {/* Claim address selector */}
      {claimAddressesInitialized && claimAddresses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium text-[rgba(255,255,255,0.30)] font-mono">Claim to:</span>
          {claimAddresses.slice(0, 3).map((addr, idx) => (
            <button
              key={addr.address}
              onClick={() => selectAddress(idx)}
              className={[
                "px-3 py-1.5 rounded-sm text-[11px] font-mono font-medium transition-all duration-150",
                selectedIndex === idx
                  ? "bg-[#00FF41] border border-[#00FF41] text-black"
                  : "border border-white/[0.08] text-white/30 hover:text-white/50",
              ].join(" ")}
            >
              {addr.label || `Wallet ${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Claimed tx success */}
      {claimedTx && (
        <div className="flex items-center gap-3.5 p-4 px-5 bg-white/[0.03] rounded-sm border border-[#00FF41]/30">
          <div className="w-10 h-10 rounded-sm bg-[rgba(0,255,65,0.08)] flex items-center justify-center shrink-0">
            <CheckCircleIcon size={20} color="#00FF41" />
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <span className="text-[14px] font-semibold text-[rgba(255,255,255,0.92)]">
              Payment Received!
            </span>
            <span className="text-[11px] text-[rgba(255,255,255,0.30)] font-mono overflow-hidden text-ellipsis whitespace-nowrap max-w-full">
              {claimedTx}
            </span>
          </div>
          <a href={`${explorerBase}/tx/${claimedTx}`} target="_blank" rel="noopener noreferrer">
            <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm border border-[rgba(255,255,255,0.08)] hover:border-[#00FF41] transition-all duration-150 cursor-pointer">
              <ArrowUpRightIcon size={12} color="#00FF41" />
              <span className="text-[12px] text-[#00FF41] font-medium font-mono">Explorer</span>
            </button>
          </a>
        </div>
      )}

      {/* Activity list */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-[rgba(255,255,255,0.02)] backdrop-blur-sm rounded-sm border border-[rgba(255,255,255,0.06)]">
          <div className="flex flex-col items-center gap-3">
            <span className="text-[15px] font-medium text-[rgba(255,255,255,0.92)]">No transactions yet</span>
            <span className="text-[13px] text-[rgba(255,255,255,0.30)] font-mono">
              {filter === "outgoing"
                ? "Sent payments will appear here"
                : filter === "incoming"
                ? "Received payments will appear here"
                : "Your payment history will appear here"}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((item) => {
            if (item.type === "incoming") {
              return (
                <IncomingRow
                  key={item.payment.announcement.txHash}
                  item={item}
                  payments={payments}
                  expandedTx={expandedTx}
                  setExpandedTx={setExpandedTx}
                  handleClaim={handleClaim}
                  claimingIndex={claimingIndex}
                />
              );
            } else {
              return (
                <OutgoingRow
                  key={item.payment.txHash}
                  item={item}
                  expandedTx={expandedTx}
                  setExpandedTx={setExpandedTx}
                />
              );
            }
          })}
        </div>
      )}

      {scanError && (
        <div className="flex items-center gap-2 p-3 px-4 bg-[rgba(229,62,62,0.04)] rounded-sm border border-[#EF4444]/10">
          <AlertCircleIcon size={14} color="#EF4444" />
          <span className="text-[11px] text-[#EF4444]/70 font-mono truncate">
            {scanError.length > 120 ? `${scanError.slice(0, 120)}...` : scanError}
          </span>
        </div>
      )}
    </div>
  );
}

function IncomingRow({ item, payments, expandedTx, setExpandedTx, handleClaim, claimingIndex }: {
  item: ActivityItem & { type: "incoming" };
  payments: StealthPayment[];
  expandedTx: string | null;
  setExpandedTx: (tx: string | null) => void;
  handleClaim: (idx: number) => Promise<void>;
  claimingIndex: number | null;
}) {
  const { activeChainId } = useAuth();
  const explorerBase = getExplorerBase(activeChainId);
  const symbol = getChainConfig(activeChainId).nativeCurrency.symbol;
  const payment = item.payment;
  const index = item.index;
  const displayAmount = parseFloat(payment.originalAmount || payment.balance || "0");
  const isExpanded = expandedTx === payment.announcement.txHash;

  return (
    <div>
      <div
        className={[
          "flex items-center justify-between px-5 py-4 bg-[rgba(255,255,255,0.03)] backdrop-blur-md border border-[rgba(255,255,255,0.06)] cursor-pointer transition-all duration-150",
          "hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)]",
          isExpanded ? "rounded-tl-2xl rounded-tr-2xl border-b-0" : "rounded-sm",
        ].join(" ")}
        onClick={() => setExpandedTx(isExpanded ? null : payment.announcement.txHash)}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-[42px] h-[42px] rounded-sm bg-[rgba(0,255,65,0.08)] flex items-center justify-center shrink-0">
            <ArrowDownLeftIcon size={20} color="#00FF41" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-medium text-[rgba(255,255,255,0.92)]">
              Received from {payment.announcement.caller?.slice(0, 6)}...{payment.announcement.caller?.slice(-4) || "unknown"}
            </span>
            <span className="text-[12px] text-[rgba(255,255,255,0.30)] font-mono">
              {symbol} &middot; Block #{payment.announcement.blockNumber.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[15px] font-semibold text-[#00FF41] font-mono flex items-center gap-1">
            +{displayAmount.toFixed(4)} <TokenIcon symbol={symbol} size={14} /> {symbol}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="px-5 py-4 bg-[rgba(255,255,255,0.03)] backdrop-blur-md rounded-bl-2xl rounded-br-2xl border border-[rgba(255,255,255,0.06)] border-t-0">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[rgba(255,255,255,0.30)] font-mono">Tx Hash</span>
              <span className="text-[12px] text-[rgba(255,255,255,0.45)] font-mono">
                {payment.announcement.txHash.slice(0, 18)}...{payment.announcement.txHash.slice(-10)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[rgba(255,255,255,0.30)] font-mono">Stealth Address</span>
              <span className="text-[12px] text-[rgba(255,255,255,0.45)] font-mono">
                {payment.announcement.stealthAddress.slice(0, 10)}...{payment.announcement.stealthAddress.slice(-8)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[rgba(255,255,255,0.30)] font-mono">Gas</span>
              <div className="flex items-center gap-1">
                <ZapIcon size={11} color="#00FF41" />
                <span className="text-[12px] text-[#00FF41] font-medium font-mono">Sponsored</span>
              </div>
            </div>
            <a href={`${explorerBase}/tx/${payment.announcement.txHash}`} target="_blank" rel="noopener noreferrer">
              <div className="flex items-center gap-1.5 mt-1">
                <ArrowUpRightIcon size={12} color="#00FF41" />
                <span className="text-[12px] text-[#00FF41] font-medium font-mono">View on Explorer</span>
              </div>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function OutgoingRow({ item, expandedTx, setExpandedTx }: {
  item: ActivityItem & { type: "outgoing" };
  expandedTx: string | null;
  setExpandedTx: (tx: string | null) => void;
}) {
  const { activeChainId } = useAuth();
  const explorerBase = getExplorerBase(activeChainId);
  const symbol = getChainConfig(activeChainId).nativeCurrency.symbol;
  const payment = item.payment;
  const isExpanded = expandedTx === payment.txHash;
  const displayAmount = parseFloat(payment.amount);
  const timeStr = new Date(payment.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <div
        className={[
          "flex items-center justify-between px-5 py-4 bg-[rgba(255,255,255,0.03)] backdrop-blur-md border border-[rgba(255,255,255,0.06)] cursor-pointer transition-all duration-150",
          "hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)]",
          isExpanded ? "rounded-tl-2xl rounded-tr-2xl border-b-0" : "rounded-sm",
        ].join(" ")}
        onClick={() => setExpandedTx(isExpanded ? null : payment.txHash)}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-[42px] h-[42px] rounded-sm bg-[rgba(229,62,62,0.08)] flex items-center justify-center shrink-0">
            <SendIcon size={20} color="#EF4444" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-medium text-[rgba(255,255,255,0.92)]">
              Sent to {payment.to.includes(".dust") ? payment.to : `${payment.to.slice(0, 10)}...`}
            </span>
            <span className="text-[12px] text-[rgba(255,255,255,0.30)] font-mono">
              {symbol} &middot; {timeStr}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[15px] font-semibold text-[#EF4444] font-mono flex items-center gap-1">
            -{displayAmount.toFixed(4)} <TokenIcon symbol={symbol} size={14} /> {symbol}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="px-5 py-4 bg-[rgba(255,255,255,0.03)] backdrop-blur-md rounded-bl-2xl rounded-br-2xl border border-[rgba(255,255,255,0.06)] border-t-0">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[rgba(255,255,255,0.30)] font-mono">Tx Hash</span>
              <span className="text-[12px] text-[rgba(255,255,255,0.45)] font-mono">
                {payment.txHash.slice(0, 18)}...{payment.txHash.slice(-10)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[rgba(255,255,255,0.30)] font-mono">Stealth Address</span>
              <span className="text-[12px] text-[rgba(255,255,255,0.45)] font-mono">
                {payment.stealthAddress.slice(0, 10)}...{payment.stealthAddress.slice(-8)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[rgba(255,255,255,0.30)] font-mono">Gas</span>
              <div className="flex items-center gap-1">
                <ZapIcon size={11} color="#00FF41" />
                <span className="text-[12px] text-[#00FF41] font-medium font-mono">Sponsored announcement</span>
              </div>
            </div>
            <a href={`${explorerBase}/tx/${payment.txHash}`} target="_blank" rel="noopener noreferrer">
              <div className="flex items-center gap-1.5 mt-1">
                <ArrowUpRightIcon size={12} color="#00FF41" />
                <span className="text-[12px] text-[#00FF41] font-medium font-mono">View on Explorer</span>
              </div>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
