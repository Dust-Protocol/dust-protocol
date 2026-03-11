"use client";

import React, { useState, useRef } from "react";
import { useChainId } from "wagmi";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  exportNotes,
  importNotes,
  downloadBackup,
  validateBackup,
} from "@/lib/dustpool/v2/backup";
import {
  DownloadIcon,
  UploadIcon,
  ShieldCheckIcon,
} from "@/components/stealth/icons";

export function BackupSection() {
  const { address } = useAuth();
  const chainId = useChainId();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    if (!address) return;
    setExporting(true);
    try {
      const backup = await exportNotes(address, chainId);
      if (backup.noteCount === 0) {
        toast("No notes to export on this chain", "warning");
        return;
      }
      downloadBackup(backup);
      toast(`Exported ${backup.noteCount} note${backup.noteCount === 1 ? "" : "s"}`, "success");
    } catch (err) {
      console.error("[Backup] Export failed:", err);
      toast("Failed to export notes", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        toast("Invalid JSON file", "error");
        return;
      }

      if (!validateBackup(data)) {
        toast("Invalid backup file format", "error");
        return;
      }

      if (address && data.walletAddress !== address.toLowerCase()) {
        toast("Backup belongs to a different wallet", "error");
        return;
      }

      const result = await importNotes(data);
      toast(
        `Imported ${result.imported} note${result.imported === 1 ? "" : "s"}${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}`,
        "success"
      );
    } catch (err) {
      console.error("[Backup] Import failed:", err);
      toast("Failed to import notes", "error");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="p-6 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.03)] flex items-center justify-center flex-shrink-0">
            <ShieldCheckIcon size={16} color="rgba(255,255,255,0.5)" />
          </div>
          <span className="text-[15px] text-white font-semibold">Note Backup</span>
        </div>

        <span className="text-[13px] text-[rgba(255,255,255,0.5)] leading-relaxed">
          Export your V2 notes to a file for safekeeping. If your browser data is cleared or you switch devices, import the backup to restore access.
        </span>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || !address}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[rgba(255,255,255,0.03)] rounded-full hover:bg-[rgba(255,255,255,0.06)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <DownloadIcon size={14} color="rgba(255,255,255,0.5)" />
            <span className="text-[13px] font-medium text-[rgba(255,255,255,0.7)]">
              {exporting ? "Exporting..." : "Export Notes"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleImport}
            disabled={importing || !address}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[rgba(255,255,255,0.03)] rounded-full hover:bg-[rgba(255,255,255,0.06)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <UploadIcon size={14} color="rgba(255,255,255,0.5)" />
            <span className="text-[13px] font-medium text-[rgba(255,255,255,0.7)]">
              {importing ? "Importing..." : "Import Notes"}
            </span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}
