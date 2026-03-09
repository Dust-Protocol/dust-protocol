'use client';

import { useState, useCallback } from 'react';
import { backupNotes } from '@/lib/filecoin/backup';
import { restoreNotes } from '@/lib/filecoin/restore';

interface BackupState {
  isLoading: boolean;
  error: string | null;
  cid: string | null;
  success: boolean;
}

interface RestoreState {
  isLoading: boolean;
  error: string | null;
  restoredCount: number | null;
  success: boolean;
}

export interface UseFilecoinBackupReturn {
  backup: BackupState;
  restore: RestoreState;
  startBackup: () => Promise<void>;
  startRestore: (cid: string) => Promise<void>;
  resetBackup: () => void;
  resetRestore: () => void;
}

const INITIAL_BACKUP: BackupState = {
  isLoading: false,
  error: null,
  cid: null,
  success: false,
};

const INITIAL_RESTORE: RestoreState = {
  isLoading: false,
  error: null,
  restoredCount: null,
  success: false,
};

export function useFilecoinBackup(chainId: number): UseFilecoinBackupReturn {
  const [backup, setBackup] = useState<BackupState>(INITIAL_BACKUP);
  const [restore, setRestore] = useState<RestoreState>(INITIAL_RESTORE);

  const startBackup = useCallback(async () => {
    setBackup({ isLoading: true, error: null, cid: null, success: false });
    try {
      const cid = await backupNotes(chainId);
      setBackup({ isLoading: false, error: null, cid, success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Backup failed';
      setBackup({ isLoading: false, error: message, cid: null, success: false });
    }
  }, [chainId]);

  const startRestore = useCallback(async (cid: string) => {
    const trimmed = cid.trim();
    if (!trimmed) {
      setRestore({ isLoading: false, error: 'Please enter a CID', restoredCount: null, success: false });
      return;
    }

    setRestore({ isLoading: true, error: null, restoredCount: null, success: false });
    try {
      const count = await restoreNotes(trimmed, chainId);
      setRestore({ isLoading: false, error: null, restoredCount: count, success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Restore failed';
      setRestore({ isLoading: false, error: message, restoredCount: null, success: false });
    }
  }, [chainId]);

  const resetBackup = useCallback(() => setBackup(INITIAL_BACKUP), []);
  const resetRestore = useCallback(() => setRestore(INITIAL_RESTORE), []);

  return { backup, restore, startBackup, startRestore, resetBackup, resetRestore };
}
