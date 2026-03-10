"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { useStealthAddress, useStealthName, usePin } from "@/hooks/stealth";
import { DEFAULT_CHAIN_ID, isChainSupported, isChainVisible } from "@/config/chains";
import type { StealthKeyPair } from "@/lib/stealth";
import type { OwnedName } from "@/lib/design/types";

import { storageKey, migrateKey } from '@/lib/storageKey';

const CHAIN_STORAGE_KEY = 'dust_active_chain';

function onboardedKey(address: string): string {
  return storageKey('onboarded', address);
}

interface AuthState {
  // Connection
  isConnected: boolean;
  address: string | undefined;
  // Chain
  activeChainId: number;
  setActiveChain: (chainId: number) => void;
  walletChainId: number | undefined;
  isChainMismatch: boolean;
  switchWalletToActiveChain: () => void;
  chainSwitchError: string | null;
  clearChainSwitchError: () => void;
  // Hydration — true once localStorage has been read
  isHydrated: boolean;
  // PIN
  hasPin: boolean;
  isPinVerified: boolean;
  verifiedPin: string | null;
  setPin: (pin: string, signature: string) => Promise<boolean>;
  verifyPin: (pin: string) => Promise<boolean>;
  clearPin: () => void;
  pinLoading: boolean;
  pinError: string | null;
  // Stealth keys
  stealthKeys: StealthKeyPair | null;
  metaAddress: string | null;
  deriveKeysFromWallet: (pin?: string) => Promise<{ sig: string; metaAddress: string } | null>;
  clearKeys: () => void;
  isRegistered: boolean;
  registerMetaAddress: (chainId?: number) => Promise<string | null>;
  isKeyLoading: boolean;
  isSigningMessage: boolean;
  keyError: string | null;
  autoRestoreFailed: boolean;
  // Claim addresses
  claimAddresses: Array<{ address: string; label?: string; balance?: string; privateKey: string; path: string; index: number }>;
  selectedClaimAddress: { address: string; label?: string; balance?: string; privateKey: string; path: string; index: number } | null;
  selectedClaimIndex: number;
  claimAddressesInitialized: boolean;
  selectClaimAddress: (idx: number) => void;
  refreshClaimBalances: () => Promise<void>;
  // Names
  ownedNames: OwnedName[];
  registerName: (name: string, metaAddress: string) => Promise<string | null>;
  formatName: (name: string) => string;
  isOnboarded: boolean;
  /** True once the on-chain name query has settled (graph or legacy RPC). Use to gate routing. */
  isNamesSettled: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { switchChain } = useSwitchChain();

  // Active chain state — persisted in localStorage (must be declared before hooks that use it)
  const [activeChainId, setActiveChainIdState] = useState(DEFAULT_CHAIN_ID);

  const stealthAddr = useStealthAddress(activeChainId);
  const nameHook = useStealthName(stealthAddr.metaAddress, activeChainId);
  const pinHook = usePin();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(CHAIN_STORAGE_KEY);
    if (stored) {
      const id = parseInt(stored, 10);
      if (isChainVisible(id)) setActiveChainIdState(id);
    }
  }, []);

  // Auto-switch wallet to active chain if connected on an unsupported chain
  useEffect(() => {
    if (!isConnected || !walletChainId || !switchChain) return;
    if (!isChainVisible(walletChainId)) {
      try {
        switchChain({ chainId: activeChainId });
      } catch {
        // User rejected the switch — no action needed
      }
    }
  }, [isConnected, walletChainId, activeChainId, switchChain]);

  const setActiveChain = useCallback((chainId: number) => {
    if (!isChainVisible(chainId)) return;
    setActiveChainIdState(chainId);
    if (typeof window !== 'undefined') {
      localStorage.setItem(CHAIN_STORAGE_KEY, chainId.toString());
    }
    // Also switch the wallet to match
    if (isConnected && switchChain && walletChainId !== chainId) {
      try {
        switchChain({ chainId });
      } catch {
        // User rejected — wallet stays on old chain, mismatch banner will show
      }
    }
  }, [isConnected, switchChain, walletChainId]);

  const isChainMismatch = isConnected
    && walletChainId !== undefined
    && walletChainId !== activeChainId;

  const [chainSwitchError, setChainSwitchError] = useState<string | null>(null);

  // Auto-clear error when mismatch resolves
  useEffect(() => {
    if (!isChainMismatch) setChainSwitchError(null);
  }, [isChainMismatch]);

  const switchWalletToActiveChain = useCallback(() => {
    if (!switchChain) return;
    try {
      switchChain(
        { chainId: activeChainId },
        { onError: (err) => setChainSwitchError(err.message || 'Failed to switch chain') },
      );
    } catch (err) {
      setChainSwitchError(err instanceof Error ? err.message : 'Failed to switch chain');
    }
  }, [switchChain, activeChainId]);

  const clearChainSwitchError = useCallback(() => setChainSwitchError(null), []);

  // Migrate legacy onboarded key once when address changes
  useEffect(() => {
    if (!address || typeof window === 'undefined') return;
    migrateKey('dust_onboarded_' + address.toLowerCase(), onboardedKey(address));
  }, [address]);

  // Explicit onboarded flag — localStorage optimization, not required for correctness
  const hasOnboardedFlag = address
    ? typeof window !== 'undefined' && !!localStorage.getItem(onboardedKey(address))
    : false;

  // User is onboarded if:
  //  1. They have an on-chain name registered to their wallet (universal, works across browsers/devices)
  //     — only counted once isNamesSettled=true so we don't flash false negatives
  //  2. While names are still loading, trust localStorage signals (PIN, flag) to avoid flash
  //  3. Once names settle with NO on-chain name, user must re-onboard (handles chain migration)
  const hasOnChainName = nameHook.isNamesSettled && nameHook.ownedNames.length > 0;
  const namesStillLoading = !nameHook.isNamesSettled;
  const isOnboarded = hasOnChainName || (namesStillLoading && (
    pinHook.hasPin ||
    (stealthAddr.isHydrated && !!stealthAddr.stealthKeys && stealthAddr.claimAddressesInitialized) ||
    hasOnboardedFlag
  ));

  const value: AuthState = {
    isConnected,
    address,
    activeChainId,
    setActiveChain,
    walletChainId,
    isChainMismatch,
    switchWalletToActiveChain,
    chainSwitchError,
    clearChainSwitchError,
    isHydrated: stealthAddr.isHydrated,
    hasPin: pinHook.hasPin,
    isPinVerified: pinHook.isPinVerified,
    verifiedPin: pinHook.verifiedPin,
    setPin: pinHook.setPin,
    verifyPin: pinHook.verifyPin,
    clearPin: pinHook.clearPin,
    pinLoading: pinHook.isLoading,
    pinError: pinHook.error,
    stealthKeys: stealthAddr.stealthKeys,
    metaAddress: stealthAddr.metaAddress,
    deriveKeysFromWallet: stealthAddr.deriveKeysFromWallet,
    clearKeys: stealthAddr.clearKeys,
    isRegistered: stealthAddr.isRegistered,
    registerMetaAddress: stealthAddr.registerMetaAddress,
    isKeyLoading: stealthAddr.isLoading,
    isSigningMessage: stealthAddr.isSigningMessage,
    keyError: stealthAddr.error,
    autoRestoreFailed: stealthAddr.autoRestoreFailed,
    claimAddresses: stealthAddr.claimAddresses,
    selectedClaimAddress: stealthAddr.selectedClaimAddress,
    selectedClaimIndex: stealthAddr.selectedClaimIndex,
    claimAddressesInitialized: stealthAddr.claimAddressesInitialized,
    selectClaimAddress: stealthAddr.selectClaimAddress,
    refreshClaimBalances: stealthAddr.refreshClaimBalances,
    ownedNames: nameHook.ownedNames,
    registerName: nameHook.registerName,
    formatName: nameHook.formatName,
    isOnboarded,
    isNamesSettled: nameHook.isNamesSettled,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
