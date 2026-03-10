"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowDownLeftIcon, ArrowUpRightIcon, ExternalLinkIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getChainConfig } from "@/config/chains";
import { getExplorerBase } from "@/lib/design/tokens";
import type { StealthPayment, OutgoingPayment } from "@/lib/design/types";

interface RecentActivityCardProps {
  payments: StealthPayment[];
  outgoingPayments?: OutgoingPayment[];
}

type Filter = "all" | "incoming" | "outgoing";

export function RecentActivityCard({ payments, outgoingPayments = [] }: RecentActivityCardProps) {
  const { activeChainId } = useAuth();
  const explorerBase = getExplorerBase(activeChainId);
  const symbol = getChainConfig(activeChainId).nativeCurrency.symbol;
  const [filter, setFilter] = useState<Filter>("all");

  const combined = useMemo(() => {
    const incomingItems = payments.map((p) => ({
      type: "incoming" as const,
      data: p,
    }));
    const outgoingItems = outgoingPayments.map((p) => ({
      type: "outgoing" as const,
      data: p,
    }));

    // Sort incoming descending by block number
    incomingItems.sort(
      (a, b) => b.data.announcement.blockNumber - a.data.announcement.blockNumber
    );
    // Sort outgoing descending by timestamp
    outgoingItems.sort((a, b) => b.data.timestamp - a.data.timestamp);

    return { incoming: incomingItems, outgoing: outgoingItems };
  }, [payments, outgoingPayments]);

  const displayed = useMemo(() => {
    if (filter === "outgoing") return combined.outgoing;
    if (filter === "incoming") return combined.incoming;
    return [...combined.outgoing, ...combined.incoming];
  }, [filter, combined]);

  const recent = displayed.slice(0, 5);
  const totalCount = payments.length + outgoingPayments.length;

  const filterLabels: Filter[] = ["all", "incoming", "outgoing"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="w-full p-6 rounded-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm relative overflow-hidden"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
            RECENT_ACTIVITY
          </span>
          <span className="text-[9px] text-[rgba(255,255,255,0.3)] font-mono">
            {totalCount} total
          </span>
        </div>
        <Link
          href="/activities"
          className="flex items-center gap-1 text-[9px] text-[rgba(255,255,255,0.4)] hover:text-[#00FF41] transition-colors font-mono"
        >
          View All <ExternalLinkIcon className="w-2.5 h-2.5" />
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        {filterLabels.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-wide border transition-colors ${
              filter === f
                ? "bg-[rgba(0,255,65,0.1)] border-[rgba(0,255,65,0.2)] text-[#00FF41]"
                : "bg-transparent border-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.6)] hover:border-[rgba(255,255,255,0.1)]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Activity list */}
      {recent.length === 0 ? (
        <div className="py-10 flex flex-col items-center justify-center gap-2">
          <span className="text-sm font-mono text-[rgba(255,255,255,0.3)]">No activity yet</span>
          <span className="text-[9px] font-mono text-[rgba(255,255,255,0.2)] uppercase tracking-wide">
            {filter === "outgoing"
              ? "Sent payments will appear here"
              : "Received payments will appear here"}
          </span>
        </div>
      ) : (
        <div className="flex flex-col">
          {recent.map((item, i) => {
            const isIncoming = item.type === "incoming";

            const txHash = isIncoming
              ? (item.data as StealthPayment).announcement.txHash
              : (item.data as OutgoingPayment).txHash;

            const amount = isIncoming
              ? (item.data as StealthPayment).originalAmount ||
                (item.data as StealthPayment).balance ||
                "0"
              : (item.data as OutgoingPayment).amount;

            const addressLabel = isIncoming
              ? `from ${(item.data as StealthPayment).announcement.caller?.slice(0, 6)}...${(item.data as StealthPayment).announcement.caller?.slice(-4)}`
              : `to ${(item.data as OutgoingPayment).to.slice(0, 6)}...${(item.data as OutgoingPayment).to.slice(-4)}`;

            const timeLabel = isIncoming
              ? `Block #${(item.data as StealthPayment).announcement.blockNumber}`
              : new Date((item.data as OutgoingPayment).timestamp).toLocaleDateString();

            // Determine status
            const isClaimed =
              isIncoming && (item.data as StealthPayment).claimed === true;
            const isUnclaimed =
              isIncoming && (item.data as StealthPayment).claimed !== true;
            // outgoing are always "completed"
            const statusLabel = isIncoming
              ? isClaimed
                ? "claimed"
                : "unclaimed"
              : "completed";
            const statusClass =
              statusLabel === "claimed" || statusLabel === "completed"
                ? "bg-[rgba(0,255,65,0.05)] border-[rgba(0,255,65,0.1)] text-[#00FF41]"
                : statusLabel === "unclaimed"
                ? "bg-[rgba(255,176,0,0.05)] border-[rgba(255,176,0,0.1)] text-[#FFB000]"
                : "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.4)]";

            return (
              <div
                key={`${txHash}-${i}`}
                className="flex items-center justify-between py-3 border-b border-[rgba(255,255,255,0.03)] last:border-0 hover:bg-[rgba(255,255,255,0.02)] -mx-2 px-2 rounded-sm transition-colors cursor-pointer"
                onClick={() => window.open(`${explorerBase}/tx/${txHash}`, "_blank")}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-1.5 rounded-full ${
                      isIncoming
                        ? "bg-[rgba(0,255,65,0.1)] text-[#00FF41]"
                        : "bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.6)]"
                    }`}
                  >
                    {isIncoming ? (
                      <ArrowDownLeftIcon className="w-3 h-3" />
                    ) : (
                      <ArrowUpRightIcon className="w-3 h-3" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white font-mono">
                      {parseFloat(amount).toFixed(4)} {symbol}
                    </span>
                    <span className="text-[9px] text-[rgba(255,255,255,0.4)] font-mono">
                      {addressLabel}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[9px] text-[rgba(255,255,255,0.3)] font-mono">
                    {timeLabel}
                  </span>
                  <div
                    className={`px-1.5 py-0.5 rounded-full text-[8px] font-mono uppercase tracking-wide border ${statusClass}`}
                  >
                    {statusLabel}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[rgba(255,255,255,0.1)] rounded-tl-sm" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[rgba(255,255,255,0.1)] rounded-tr-sm" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[rgba(255,255,255,0.1)] rounded-bl-sm" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[rgba(255,255,255,0.1)] rounded-br-sm" />
    </motion.div>
  );
}
