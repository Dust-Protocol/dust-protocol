"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useStealthScanner, useUnifiedBalance } from "@/hooks/stealth";
import { UnifiedBalanceCard } from "@/components/dashboard/UnifiedBalanceCard";
import { PersonalLinkCard } from "@/components/dashboard/PersonalLinkCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { V2PoolCard } from "@/components/dustpool/V2PoolCard";
import { V2KeysProvider, useSharedV2Keys } from "@/contexts/V2KeysContext";
import { useV2NoteSync } from "@/hooks/dustpool/v2/useV2NoteSync";
import { SendModal } from "@/components/send/SendModal";
import { ReceiveModal } from "@/components/dashboard/ReceiveModal";
import { SendIcon, ArrowDownLeftIcon, ShieldIcon } from "@/components/stealth/icons";
import { V2DepositModal } from "@/components/dustpool/V2DepositModal";
import { loadOutgoingPayments } from '@/hooks/stealth/useStealthSend';
import { RestoringBanner } from '@/components/RestoringBanner';
import { BackupWarningBanner } from '@/components/dashboard/BackupWarningBanner';
import { useV2Balance } from '@/hooks/dustpool/v2';
import { formatEther } from 'viem';
import type { OutgoingPayment } from '@/lib/design/types';

export default function DashboardPageClient() {
  return (
    <V2KeysProvider>
      <DashboardInner />
    </V2KeysProvider>
  );
}

function DashboardInner() {
  const { stealthKeys, metaAddress, ownedNames, claimAddresses, refreshClaimBalances, claimAddressesInitialized, activeChainId, address, isNamesSettled } = useAuth();
  const { keysRef: v2KeysRef, hasKeys, hasPin, isDeriving, error: keyError, deriveKeys } = useSharedV2Keys();
  useV2NoteSync(activeChainId);
  const { payments, scan, scanInBackground, stopBackgroundScan, isScanning } = useStealthScanner(stealthKeys, { chainId: activeChainId, v2KeysRef });
  const { totalEthBalance: v2EthBalance } = useV2Balance(v2KeysRef, activeChainId);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

  const [outgoingPayments, setOutgoingPayments] = useState<OutgoingPayment[]>([]);
  useEffect(() => {
    if (address) {
      setOutgoingPayments(loadOutgoingPayments(address, activeChainId));
    }
  }, [address, activeChainId, showSendModal]);

  const dustName = ownedNames.length > 0 ? `${ownedNames[0].name}.dust` : null;
  const payPath = ownedNames.length > 0 ? `/pay/${ownedNames[0].name}` : "";

  const unified = useUnifiedBalance({
    payments,
    claimAddresses,
    refreshClaimBalances,
    claimAddressesInitialized,
    shieldedTotal: parseFloat(formatEther(v2EthBalance)),
  });

  const handleRefresh = useCallback(() => {
    scan();
    refreshClaimBalances();
  }, [scan, refreshClaimBalances]);

  useEffect(() => {
    if (stealthKeys) {
      scanInBackground();
      return () => stopBackgroundScan();
    }
  }, [stealthKeys, scanInBackground, stopBackgroundScan]);

  return (
    <div className="px-3.5 py-7 md:px-6 md:py-7 max-w-[640px] mx-auto">
      <div className="flex flex-col gap-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-widest text-white font-mono mb-1">
            STEALTH_WALLET
          </h1>
          <p className="text-xs text-[rgba(255,255,255,0.4)] font-mono tracking-wide">
            Privacy-first asset management
          </p>
        </div>

        <RestoringBanner isScanning={isScanning && payments.length === 0} />

        {address && <BackupWarningBanner address={address} hasNotes={v2EthBalance > 0n || !!stealthKeys} />}

        <UnifiedBalanceCard
          total={unified.total}
          stealthTotal={unified.stealthTotal}
          claimTotal={unified.claimTotal}
          shieldedTotal={unified.shieldedTotal}
          unclaimedCount={unified.unclaimedCount}
          isScanning={isScanning}
          isLoading={unified.isLoading}
          onRefresh={handleRefresh}
        />

        <div className="flex gap-2.5">
          <button
            onClick={() => setShowSendModal(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-sm bg-[#00FF41] hover:bg-[rgba(0,255,65,0.85)] active:scale-[0.98] transition-all font-mono font-bold text-sm text-black"
          >
            <SendIcon size={17} color="#000" />
            Send
          </button>
          <button
            onClick={() => setShowDepositModal(true)}
            disabled={!v2KeysRef.current}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-sm border border-[rgba(0,255,65,0.3)] bg-[rgba(0,255,65,0.05)] hover:bg-[rgba(0,255,65,0.12)] active:scale-[0.98] transition-all font-mono font-bold text-sm text-[#00FF41] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ShieldIcon size={17} color="#00FF41" />
            Shield
          </button>
          <button
            onClick={() => setShowReceiveModal(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-sm border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.05)] active:scale-[0.98] transition-all font-mono font-bold text-sm text-white"
          >
            <ArrowDownLeftIcon size={17} color="rgba(255,255,255,0.7)" />
            Receive
          </button>
        </div>

        <V2PoolCard chainId={activeChainId} />

        <PersonalLinkCard ownedNames={ownedNames} metaAddress={metaAddress} isNamesSettled={isNamesSettled} />

        <RecentActivityCard payments={payments} outgoingPayments={outgoingPayments} />

        <SendModal isOpen={showSendModal} onClose={() => { setShowSendModal(false); scan(); }} />
        <ReceiveModal isOpen={showReceiveModal} onClose={() => setShowReceiveModal(false)} dustName={dustName} payPath={payPath} metaAddress={metaAddress} />
        <V2DepositModal
          isOpen={showDepositModal}
          onClose={() => { setShowDepositModal(false); }}
          keysRef={v2KeysRef}
          chainId={activeChainId}
          hasKeys={hasKeys}
          hasPin={hasPin}
          onDeriveKeys={deriveKeys}
          isDeriving={isDeriving}
          keyError={keyError}
        />
      </div>
    </div>
  );
}
