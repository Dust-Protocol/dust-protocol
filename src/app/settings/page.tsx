"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useV2Keys } from "@/hooks/dustpool/v2";
import { useChainId } from "wagmi";
import { AccountSection } from "@/components/settings/AccountSection";
import { SecuritySection } from "@/components/settings/SecuritySection";
import { DisclosureSection } from "@/components/settings/DisclosureSection";
import { ClaimAddressSection } from "@/components/settings/ClaimAddressSection";
import { DangerZoneSection } from "@/components/settings/DangerZoneSection";
import { BackupSection } from "@/components/settings/BackupSection";
import { AddressBreakdownCard } from "@/components/dashboard/AddressBreakdownCard";

export default function SettingsPage() {
  const {
    address, ownedNames, isRegistered, metaAddress, stealthKeys,
    claimAddresses, claimAddressesInitialized,
    clearKeys, clearPin,
  } = useAuth();
  const { keysRef, hasKeys } = useV2Keys();
  const chainId = useChainId();

  const viewingPublicKey = stealthKeys?.viewingPublicKey
    ? (stealthKeys.viewingPublicKey.startsWith("0x") ? stealthKeys.viewingPublicKey : `0x${stealthKeys.viewingPublicKey}`)
    : undefined;

  return (
    <div className="px-4 md:px-10 py-5 md:py-10 max-w-[780px] mx-auto">
      <div className="flex flex-col gap-7">
        <h1 className="text-2xl font-bold tracking-widest text-white font-mono mb-1 text-center">Settings</h1>

        <AccountSection address={address} ownedNames={ownedNames} isRegistered={isRegistered} />
        <SecuritySection metaAddress={metaAddress} viewingPublicKey={viewingPublicKey} />
        <BackupSection />
        {hasKeys && <DisclosureSection keysRef={keysRef} chainId={chainId} />}
        <ClaimAddressSection claimAddresses={claimAddresses} claimAddressesInitialized={claimAddressesInitialized} />
        <AddressBreakdownCard claimAddresses={claimAddresses} unclaimedPayments={[]} />
        <DangerZoneSection clearKeys={clearKeys} clearPin={clearPin} />
      </div>
    </div>
  );
}
