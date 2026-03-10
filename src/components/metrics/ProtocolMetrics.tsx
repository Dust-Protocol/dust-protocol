"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { getChainConfig, isChainSupported } from "@/config/chains";

interface ChainMetrics {
  name: string;
  announcements: number;
  deposits: number;
  withdrawals: number;
  uniqueAddresses: number;
  tvlWei: string;
}

interface MetricsAPIResponse {
  chains: Record<string, ChainMetrics>;
  updatedAt: string;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function formatTVL(weiStr: string): string {
  const eth = parseFloat(ethers.utils.formatEther(weiStr));
  if (eth === 0) return "0";
  if (eth < 0.001) return "<0.001";
  return eth.toFixed(3);
}

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-2 p-4 bg-[rgba(0,239,139,0.03)] border border-[rgba(0,239,139,0.1)] rounded-sm animate-pulse">
      <div className="h-3 w-20 bg-white/5 rounded-sm" />
      <div className="h-6 w-14 bg-white/10 rounded-sm" />
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1 p-4 bg-[rgba(0,239,139,0.03)] border border-[rgba(0,239,139,0.1)] rounded-sm">
      <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
        {label}
      </span>
      <span className="text-[22px] font-mono font-bold text-white tracking-tight">
        {value}
        {suffix && (
          <span className="text-[13px] text-white/40 ml-1">{suffix}</span>
        )}
      </span>
    </div>
  );
}

export function ProtocolMetrics() {
  const [data, setData] = useState<MetricsAPIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/metrics");
      if (!res.ok) throw new Error("Failed");
      const json: MetricsAPIResponse = await res.json();
      setData(json);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#00EF8B]/30 animate-pulse" />
          <span className="text-[11px] font-mono text-white/30">
            Loading protocol metrics...
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-[13px] font-mono font-bold text-white/70 uppercase tracking-wider">
          Protocol Stats
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Stealth Payments" value="--" />
          <StatCard label="Pool Deposits" value="--" />
          <StatCard label="Pool Withdrawals" value="--" />
          <StatCard label="TVL" value="--" />
        </div>
      </div>
    );
  }

  const chains = Object.entries(data.chains).map(([id, m]) => ({
    chainId: Number(id),
    ...m,
  }));

  const totals = chains.reduce(
    (acc, c) => ({
      announcements: acc.announcements + c.announcements,
      deposits: acc.deposits + c.deposits,
      withdrawals: acc.withdrawals + c.withdrawals,
      uniqueAddresses: acc.uniqueAddresses + c.uniqueAddresses,
    }),
    { announcements: 0, deposits: 0, withdrawals: 0, uniqueAddresses: 0 },
  );

  // Aggregate TVL across chains with potentially different native currencies (ETH, TON, FLOW).
  // Only meaningful when all chains share the same native token; displayed without a suffix
  // to avoid misrepresenting a cross-currency sum.
  const totalTVL = chains.reduce(
    (acc, c) => acc.add(ethers.BigNumber.from(c.tvlWei || "0")),
    ethers.BigNumber.from(0),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-mono font-bold text-white/70 uppercase tracking-wider">
          Protocol Stats
        </h3>
        {data.updatedAt && (
          <span className="text-[9px] font-mono text-white/20">
            updated {new Date(data.updatedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Stealth Payments"
          value={totals.announcements.toLocaleString()}
        />
        <StatCard
          label="Pool Deposits"
          value={totals.deposits.toLocaleString()}
        />
        <StatCard
          label="Pool Withdrawals"
          value={totals.withdrawals.toLocaleString()}
        />
        <StatCard
          label="TVL (native)"
          value={formatTVL(totalTVL.toString())}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          label="Unique Addresses"
          value={totals.uniqueAddresses.toLocaleString()}
        />
        <StatCard label="Active Chains" value={chains.length} />
      </div>

      {chains.length > 1 && (
        <div className="mt-2">
          <p className="text-[10px] font-mono text-white/25 uppercase tracking-wider mb-2">
            Per Chain
          </p>
          <div className="flex flex-col gap-1">
            {chains
              .filter((c) => c.announcements > 0 || c.deposits > 0)
              .map((c) => (
                <div
                  key={c.chainId}
                  className="flex items-center justify-between px-3 py-2 bg-white/[0.02] rounded-sm"
                >
                  <span className="text-[11px] font-mono text-white/50">
                    {c.name}
                  </span>
                  <div className="flex items-center gap-4 text-[11px] font-mono text-white/35">
                    <span>{c.announcements} sends</span>
                    <span>{c.deposits} deposits</span>
                    {c.tvlWei !== "0" && (
                      <span>{formatTVL(c.tvlWei)} {isChainSupported(c.chainId) ? getChainConfig(c.chainId).nativeCurrency.symbol : "ETH"}</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
