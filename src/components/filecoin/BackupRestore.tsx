'use client';

import { useState } from 'react';
import { useFilecoinBackup } from '@/hooks/useFilecoinBackup';

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-[#00FF41]"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function CheckmarkIcon() {
  return (
    <svg className="h-4 w-4 text-[#00FF41]" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
      <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
    </svg>
  );
}

interface BackupRestoreProps {
  chainId: number;
}

export function BackupRestore({ chainId }: BackupRestoreProps) {
  const {
    backup,
    restore,
    startBackup,
    startRestore,
    resetBackup,
    resetRestore,
  } = useFilecoinBackup(chainId);

  const [restoreCid, setRestoreCid] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopyCid = async () => {
    if (!backup.cid) return;
    try {
      await navigator.clipboard.writeText(backup.cid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail in non-secure contexts
    }
  };

  const handleRestore = () => {
    startRestore(restoreCid);
  };

  return (
    <div className="w-full max-w-md space-y-4">
      {/* Backup Section */}
      <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md p-4">
        <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-white/60 mb-3">
          Backup Notes
        </h3>

        <button
          onClick={startBackup}
          disabled={backup.isLoading}
          className="w-full h-10 bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] font-mono text-sm font-bold tracking-wider uppercase transition-all hover:bg-[#00FF41]/20 hover:border-[#00FF41]/50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {backup.isLoading ? (
            <>
              <Spinner />
              <span>Backing up...</span>
            </>
          ) : (
            'Backup Notes to Filecoin'
          )}
        </button>

        {backup.success && backup.cid && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <CheckmarkIcon />
              <span className="text-xs font-mono text-[#00FF41]">Backup complete</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] font-mono text-white/70 bg-black/40 border border-white/10 px-2.5 py-1.5 truncate">
                {backup.cid}
              </code>
              <button
                onClick={handleCopyCid}
                className="shrink-0 h-8 w-8 flex items-center justify-center border border-white/10 text-white/50 hover:text-[#00FF41] hover:border-[#00FF41]/30 transition-all"
                title="Copy CID"
              >
                {copied ? (
                  <CheckmarkIcon />
                ) : (
                  <CopyIcon />
                )}
              </button>
            </div>
            <p className="text-[10px] font-mono text-white/30">
              Save this CID -- you will need it to restore your notes.
            </p>
          </div>
        )}

        {backup.error && (
          <div className="mt-3 flex items-start gap-2">
            <span className="text-[#ff6b6b] text-sm shrink-0 leading-none mt-px">!</span>
            <p className="text-xs font-mono text-[#ff6b6b]">{backup.error}</p>
          </div>
        )}
      </div>

      {/* Restore Section */}
      <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md p-4">
        <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-white/60 mb-3">
          Restore Notes
        </h3>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={restoreCid}
            onChange={(e) => {
              setRestoreCid(e.target.value);
              if (restore.error || restore.success) resetRestore();
            }}
            placeholder="Paste CID here"
            disabled={restore.isLoading}
            className="flex-1 h-10 bg-black/40 border border-white/10 text-white text-sm font-mono px-3 placeholder:text-white/25 focus:border-[#00FF41]/50 focus:outline-none disabled:opacity-40 transition-all"
          />
          <button
            onClick={handleRestore}
            disabled={restore.isLoading || !restoreCid.trim()}
            className="shrink-0 h-10 px-4 bg-white/5 border border-white/10 text-white/70 font-mono text-sm font-bold tracking-wider uppercase transition-all hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {restore.isLoading ? (
              <>
                <Spinner />
                <span>Restoring...</span>
              </>
            ) : (
              'Restore'
            )}
          </button>
        </div>

        {restore.success && restore.restoredCount !== null && (
          <div className="mt-3 flex items-center gap-1.5">
            <CheckmarkIcon />
            <span className="text-xs font-mono text-[#00FF41]">
              Restored {restore.restoredCount} note{restore.restoredCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {restore.error && (
          <div className="mt-3 flex items-start gap-2">
            <span className="text-[#ff6b6b] text-sm shrink-0 leading-none mt-px">!</span>
            <p className="text-xs font-mono text-[#ff6b6b]">{restore.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
