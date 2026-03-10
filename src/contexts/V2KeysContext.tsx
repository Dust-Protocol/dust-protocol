"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useV2Keys } from "@/hooks/dustpool/v2/useV2Keys";
import type { V2Keys } from "@/lib/dustpool/v2/types";

interface V2KeysContextValue {
  keysRef: React.RefObject<V2Keys | null>;
  hasKeys: boolean;
  hasPin: boolean;
  isDeriving: boolean;
  error: string | null;
  deriveKeys: (pin: string) => Promise<boolean>;
  clearKeys: () => void;
  isRestoring: boolean;
  restoreMessage: string | null;
}

const V2KeysContext = createContext<V2KeysContextValue | null>(null);

export function V2KeysProvider({ children }: { children: ReactNode }) {
  const keys = useV2Keys();
  const { isPinVerified, verifiedPin, address, activeChainId } = useAuth();
  const autoDerivingRef = useRef(false);
  const restoreTriedRef = useRef(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  // Auto-derive V2 keys when PinGate unlocks (avoids second PIN entry)
  useEffect(() => {
    if (isPinVerified && verifiedPin && !keys.hasKeys && !keys.isDeriving && !autoDerivingRef.current) {
      autoDerivingRef.current = true;
      keys.deriveKeys(verifiedPin).finally(() => {
        autoDerivingRef.current = false;
      });
    }
  }, [isPinVerified, verifiedPin, keys.hasKeys, keys.isDeriving, keys.deriveKeys]);

  // Auto-restore notes from backup when keys are derived on a new device (empty IndexedDB)
  useEffect(() => {
    if (!keys.hasKeys || !address || !activeChainId || restoreTriedRef.current) return;
    restoreTriedRef.current = true;

    (async () => {
      try {
        const { openV2Database, getUnspentNotes } = await import('@/lib/dustpool/v2/storage');
        const { deriveStorageKey } = await import('@/lib/dustpool/v2/storage-crypto');
        const db = await openV2Database();
        const encKey = await deriveStorageKey(keys.keysRef.current!.spendingKey);
        const existing = await getUnspentNotes(db, address, activeChainId, encKey);

        if (existing.length === 0) {
          setIsRestoring(true);
          const { restoreFromBackup } = await import('@/lib/dustpool/v2/restore');
          await restoreFromBackup(
            keys.keysRef.current!,
            address,
            activeChainId,
            (msg) => setRestoreMessage(msg),
          );
        }
      } catch (err) {
        console.warn('[V2KeysContext] Restore check failed:', err);
      } finally {
        setIsRestoring(false);
        setRestoreMessage(null);
      }
    })();
  }, [keys.hasKeys, address, activeChainId]);

  const value: V2KeysContextValue = {
    ...keys,
    isRestoring,
    restoreMessage,
  };

  return (
    <V2KeysContext.Provider value={value}>{children}</V2KeysContext.Provider>
  );
}

export function useSharedV2Keys(): V2KeysContextValue {
  const ctx = useContext(V2KeysContext);
  if (!ctx) throw new Error("useSharedV2Keys must be used within V2KeysProvider");
  return ctx;
}
