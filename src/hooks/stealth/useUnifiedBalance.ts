import { useState, useEffect, useRef, useMemo } from 'react';
import type { StealthPayment } from '@/lib/design/types';

interface ClaimAddressInfo {
  address: string;
  label?: string;
  balance?: string;
}

export interface UnifiedBalance {
  total: number;
  stealthTotal: number;
  claimTotal: number;
  shieldedTotal: number;
  unclaimedCount: number;
  claimAddresses: ClaimAddressInfo[];
  unclaimedPayments: StealthPayment[];
  isLoading: boolean;
}

interface UseUnifiedBalanceArgs {
  payments: StealthPayment[];
  claimAddresses: ClaimAddressInfo[];
  refreshClaimBalances: () => Promise<void>;
  claimAddressesInitialized: boolean;
  shieldedTotal?: number;
}

export function useUnifiedBalance({
  payments,
  claimAddresses,
  refreshClaimBalances,
  claimAddressesInitialized,
  shieldedTotal = 0,
}: UseUnifiedBalanceArgs): UnifiedBalance {
  const [isLoading, setIsLoading] = useState(true);

  // Ref-stabilize refreshClaimBalances to avoid infinite loops
  // (its reference changes on every refresh because it depends on claimAddresses array)
  const refreshRef = useRef(refreshClaimBalances);
  useEffect(() => {
    refreshRef.current = refreshClaimBalances;
  }, [refreshClaimBalances]);

  // Initial fetch + periodic refresh of claim balances
  useEffect(() => {
    if (!claimAddressesInitialized) return;

    let mounted = true;
    refreshRef.current().finally(() => {
      if (mounted) setIsLoading(false);
    });

    const interval = setInterval(() => {
      refreshRef.current();
    }, 30_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [claimAddressesInitialized]);

  // Unclaimed stealth payments (balance > 0, not claimed, not key mismatch)
  const unclaimedPayments = useMemo(
    () => payments.filter(p => !p.keyMismatch && !p.claimed && parseFloat(p.balance || '0') > 0),
    [payments]
  );

  const stealthTotal = useMemo(
    () => unclaimedPayments.reduce((sum, p) => sum + parseFloat(p.balance || '0'), 0),
    [unclaimedPayments]
  );

  // Claimed total = sum of originalAmount for auto-claimed payments
  // (auto-claim sends to connected wallet, not to derived claim addresses)
  const claimTotal = useMemo(
    () => payments
      .filter(p => p.claimed && !p.keyMismatch)
      .reduce((sum, p) => sum + parseFloat(p.originalAmount || p.balance || '0'), 0),
    [payments]
  );

  return {
    total: stealthTotal + claimTotal + shieldedTotal,
    stealthTotal,
    claimTotal,
    shieldedTotal,
    unclaimedCount: unclaimedPayments.length,
    claimAddresses,
    unclaimedPayments,
    isLoading: isLoading && claimAddressesInitialized,
  };
}
