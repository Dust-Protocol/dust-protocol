"use client";

import { useState, useCallback, type RefObject } from "react";
import { useV2Disclosure } from "@/hooks/dustpool/v2/useV2Disclosure";
import {
  EyeIcon,
  KeyIcon,
  CopyIcon,
  CheckIcon,
  DownloadIcon,
  FileTextIcon,
  InfoIcon,
  ETHIcon,
} from "@/components/stealth/icons";
import type { V2Keys } from "@/lib/dustpool/v2/types";

interface DisclosureSectionProps {
  keysRef: RefObject<V2Keys | null>;
  chainId?: number;
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DisclosureSection({ keysRef, chainId }: DisclosureSectionProps) {
  const {
    viewKey,
    viewKeyString,
    report,
    isGenerating,
    error,
    deriveAndSetViewKey,
    generateReport,
    exportReport,
    clearDisclosure,
  } = useV2Disclosure(keysRef, chainId);

  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!viewKeyString) return;
    await navigator.clipboard.writeText(viewKeyString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [viewKeyString]);

  const handleExport = useCallback((format: "csv" | "json") => {
    const content = exportReport(format);
    if (!content) return;
    const ext = format === "csv" ? "csv" : "json";
    const mime = format === "csv" ? "text/csv" : "application/json";
    const timestamp = new Date().toISOString().slice(0, 10);
    triggerDownload(content, `dust-disclosure-${timestamp}.${ext}`, mime);
  }, [exportReport]);

  // Group note amounts by asset to avoid mixing ETH (18 dec) and USDC (6 dec)
  const ethNotes = report ? report.notes.filter(n => !n.asset || n.asset === 'ETH' || n.asset === '0x0000000000000000000000000000000000000000') : [];
  const usdcNotes = report ? report.notes.filter(n => n.asset && n.asset !== 'ETH' && n.asset !== '0x0000000000000000000000000000000000000000') : [];

  const totalEthAmount = ethNotes.reduce((sum, n) => sum + BigInt(n.amount), 0n);
  const totalEthSpent = ethNotes.filter(n => n.spent).reduce((sum, n) => sum + BigInt(n.amount), 0n);
  const totalEthUnspent = ethNotes.filter(n => !n.spent).reduce((sum, n) => sum + BigInt(n.amount), 0n);

  const totalUsdcAmount = usdcNotes.reduce((sum, n) => sum + BigInt(n.amount), 0n);
  const totalUsdcUnspent = usdcNotes.filter(n => !n.spent).reduce((sum, n) => sum + BigInt(n.amount), 0n);

  const formatAmount = (wei: bigint, decimals: number): string => {
    const val = Number(wei) / Math.pow(10, decimals);
    return val.toFixed(4);
  };

  return (
    <div className="p-6 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-sm">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.03)] flex items-center justify-center flex-shrink-0">
            <EyeIcon size={16} color="rgba(255,255,255,0.5)" />
          </div>
          <span className="text-[15px] text-white font-semibold">Disclosure</span>
        </div>

        {/* View Key Section */}
        {!viewKey ? (
          <button
            type="button"
            onClick={deriveAndSetViewKey}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[rgba(255,255,255,0.03)] rounded-full hover:bg-[rgba(255,255,255,0.06)] transition-colors cursor-pointer"
          >
            <KeyIcon size={14} color="rgba(255,255,255,0.5)" />
            <span className="text-[13px] font-medium text-[rgba(255,255,255,0.7)]">
              Derive View Key
            </span>
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <span className="text-[13px] text-[rgba(255,255,255,0.5)] font-medium">View Key</span>
            <div className="px-4 py-3.5 bg-[rgba(255,255,255,0.03)] rounded-sm">
              <span className="text-[11px] text-[rgba(255,255,255,0.35)] font-mono break-all leading-relaxed">
                {viewKeyString}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[rgba(255,255,255,0.03)] rounded-full hover:bg-[rgba(255,255,255,0.06)] transition-colors cursor-pointer"
            >
              {copied
                ? <CheckIcon size={14} color="#7C3AED" />
                : <CopyIcon size={14} color="rgba(255,255,255,0.5)" />}
              <span className={`text-[13px] font-medium ${copied ? "text-[#7C3AED]" : "text-[rgba(255,255,255,0.7)]"}`}>
                {copied ? "Copied" : "Copy View Key"}
              </span>
            </button>
          </div>
        )}

        {/* Generate Report */}
        {viewKey && !report && !isGenerating && (
          <button
            type="button"
            onClick={() => generateReport()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[rgba(255,255,255,0.03)] rounded-full hover:bg-[rgba(255,255,255,0.06)] transition-colors cursor-pointer"
          >
            <FileTextIcon size={14} color="rgba(255,255,255,0.5)" />
            <span className="text-[13px] font-medium text-[rgba(255,255,255,0.7)]">
              Generate Report
            </span>
          </button>
        )}

        {/* Generating spinner */}
        {isGenerating && (
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="w-5 h-5 border-2 border-[rgba(255,255,255,0.3)] border-t-white rounded-full animate-spin" />
            <span className="text-[13px] text-[rgba(255,255,255,0.5)] font-mono">
              Generating disclosure report...
            </span>
          </div>
        )}

        {/* Report Summary */}
        {report && (
          <div className="flex flex-col gap-3">
            <span className="text-[13px] text-[rgba(255,255,255,0.5)] font-medium">Report Summary</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="px-3 py-2.5 bg-[rgba(255,255,255,0.03)] rounded-sm">
                <p className="text-[10px] text-[rgba(255,255,255,0.4)] font-mono uppercase tracking-wider">Notes</p>
                <p className="text-sm text-white font-mono font-semibold mt-0.5">{report.notes.length}</p>
              </div>
              <div className="px-3 py-2.5 bg-[rgba(255,255,255,0.03)] rounded-sm">
                <p className="text-[10px] text-[rgba(255,255,255,0.4)] font-mono uppercase tracking-wider">Total</p>
                <p className="text-sm text-white font-mono font-semibold mt-0.5 flex items-center gap-1">
                  <ETHIcon size={14} />{formatAmount(totalEthAmount, 18)} ETH
                </p>
                {totalUsdcAmount > 0n && (
                  <p className="text-sm text-white font-mono font-semibold mt-0.5">
                    {formatAmount(totalUsdcAmount, 6)} USDC
                  </p>
                )}
              </div>
              <div className="px-3 py-2.5 bg-[rgba(255,255,255,0.03)] rounded-sm">
                <p className="text-[10px] text-[rgba(255,255,255,0.4)] font-mono uppercase tracking-wider">Spent</p>
                <p className="text-sm text-[rgba(255,255,255,0.6)] font-mono font-semibold mt-0.5 flex items-center gap-1">
                  <ETHIcon size={14} />{formatAmount(totalEthSpent, 18)} ETH
                </p>
              </div>
              <div className="px-3 py-2.5 bg-[rgba(255,255,255,0.03)] rounded-sm">
                <p className="text-[10px] text-[rgba(255,255,255,0.4)] font-mono uppercase tracking-wider">Unspent</p>
                <p className="text-sm text-[#00FF41] font-mono font-semibold mt-0.5 flex items-center gap-1">
                  <ETHIcon size={14} />{formatAmount(totalEthUnspent, 18)} ETH
                </p>
                {totalUsdcUnspent > 0n && (
                  <p className="text-sm text-[#00FF41] font-mono font-semibold mt-0.5">
                    {formatAmount(totalUsdcUnspent, 6)} USDC
                  </p>
                )}
              </div>
            </div>

            {/* Export buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleExport("csv")}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[rgba(255,255,255,0.03)] rounded-full hover:bg-[rgba(255,255,255,0.06)] transition-colors cursor-pointer"
              >
                <DownloadIcon size={14} color="rgba(255,255,255,0.5)" />
                <span className="text-[13px] font-medium text-[rgba(255,255,255,0.7)]">CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport("json")}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[rgba(255,255,255,0.03)] rounded-full hover:bg-[rgba(255,255,255,0.06)] transition-colors cursor-pointer"
              >
                <DownloadIcon size={14} color="rgba(255,255,255,0.5)" />
                <span className="text-[13px] font-medium text-[rgba(255,255,255,0.7)]">JSON</span>
              </button>
            </div>

            {/* Clear */}
            <button
              type="button"
              onClick={clearDisclosure}
              className="text-[12px] text-[rgba(255,255,255,0.3)] hover:text-[rgba(255,255,255,0.5)] transition-colors font-mono text-center"
            >
              Clear disclosure data
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-[12px] text-red-400 font-mono">{error}</p>
        )}

        {/* Warning */}
        <div className="flex items-start gap-2.5 p-3.5 bg-[rgba(217,119,6,0.04)] rounded-sm">
          <div className="flex-shrink-0 mt-px">
            <InfoIcon size={14} color="#FFB000" />
          </div>
          <span className="text-[12px] text-[#FFB000] leading-relaxed">
            Your view key reveals transaction history to anyone who receives it. Only share with authorized auditors.
          </span>
        </div>
      </div>
    </div>
  );
}
