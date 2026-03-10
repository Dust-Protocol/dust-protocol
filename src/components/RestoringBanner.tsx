"use client";

/**
 * RestoringBanner — shown in the dashboard when a user reconnected on a new
 * device / cleared their browser cache and a full blockchain re-scan is running
 * to restore their incoming payments history.
 *
 * Props:
 *  isScanning  — true while the scanner hook is actively scanning
 *  progress    — 0–100 percentage, or undefined when indeterminate
 *  onDismiss   — optional: called when user manually closes the banner (after scan completes)
 */
import { useEffect, useState } from "react";

interface Props {
  isScanning: boolean;
  progress?: number;
  onDismiss?: () => void;
}

export function RestoringBanner({ isScanning, progress, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const [justFinished, setJustFinished] = useState(false);

  // Show banner when scan starts; mark finished when it stops
  useEffect(() => {
    if (isScanning) {
      setVisible(true);
      setJustFinished(false);
    } else if (visible) {
      setJustFinished(true);
      // Auto-hide after 4s once scan completes
      const t = setTimeout(() => {
        setVisible(false);
        setJustFinished(false);
        onDismiss?.();
      }, 4000);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning]);

  if (!visible) return null;

  return (
    <div className="w-full mb-4 px-4 py-3 rounded-sm border border-[rgba(0,255,65,0.18)] bg-[rgba(0,255,65,0.04)] flex items-start gap-3">
      {/* Animated dot */}
      <div className="mt-[3px] flex-shrink-0">
        {justFinished ? (
          <div className="w-2 h-2 rounded-full bg-[rgba(0,255,65,0.8)]" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-[rgba(0,255,65,0.6)] animate-pulse" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-mono text-[rgba(0,255,65,0.8)] uppercase tracking-widest leading-none mb-1">
          {justFinished ? "History restored" : "Restoring history"}
        </p>
        <p className="text-[12px] text-[rgba(255,255,255,0.45)]">
          {justFinished
            ? "Your incoming payments have been recovered from the blockchain."
            : "Scanning the blockchain to recover your incoming payments. This runs once and takes a moment."}
        </p>

        {/* Progress bar — only shown while scanning */}
        {isScanning && (
          <div className="mt-2 h-[2px] w-full bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
            {progress !== undefined ? (
              <div
                className="h-full bg-[rgba(0,255,65,0.5)] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            ) : (
              /* Indeterminate pulse */
              <div className="h-full w-1/3 bg-[rgba(0,255,65,0.5)] rounded-full animate-pulse" />
            )}
          </div>
        )}
      </div>

      {/* Dismiss button — only after scan completes */}
      {justFinished && onDismiss && (
        <button
          onClick={() => { setVisible(false); onDismiss(); }}
          className="flex-shrink-0 text-[rgba(255,255,255,0.25)] hover:text-[rgba(255,255,255,0.5)] text-[16px] leading-none transition-colors"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}
