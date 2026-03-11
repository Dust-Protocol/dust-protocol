"use client";

import { useState } from "react";
import { AlertCircleIcon, XIcon } from "@/components/stealth/icons";
import { storageKey } from "@/lib/storageKey";

function backupDismissedKey(address: string): string {
  return storageKey("backup-dismissed", address);
}

interface BackupWarningBannerProps {
  address: string;
  hasNotes: boolean;
}

export function BackupWarningBanner({ address, hasNotes }: BackupWarningBannerProps) {
  const dismissed = typeof window !== "undefined" && !!localStorage.getItem(backupDismissedKey(address));
  const [visible, setVisible] = useState(!dismissed);

  if (!hasNotes || !visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(backupDismissedKey(address), "1");
    }
  };

  return (
    <div className="p-3 rounded-sm bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.15)] flex items-start gap-2.5">
      <AlertCircleIcon size={14} color="#ef4444" className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-[11px] text-red-400 font-mono font-bold mb-1">
          Your private funds are stored locally
        </p>
        <p className="text-[10px] text-[rgba(255,255,255,0.4)] font-mono leading-relaxed">
          Clearing browser data will permanently delete your shielded notes. Export a backup in Settings to protect your funds.
        </p>
      </div>
      <button onClick={handleDismiss} className="shrink-0 text-[rgba(255,255,255,0.3)] hover:text-white transition-colors">
        <XIcon size={14} />
      </button>
    </div>
  );
}
