import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import {
  generateStealthKeyPair, deriveStealthKeyPairFromSignature, deriveStealthKeyPairFromSignatureAndPin,
  formatStealthMetaAddress, parseStealthMetaAddress, lookupStealthMetaAddress,
  isRegistered as checkIsRegistered, getRegistryForChain,
  STEALTH_KEY_DERIVATION_MESSAGE, SCHEME_ID,
  type StealthKeyPair, type StealthMetaAddress,
  deriveClaimAddresses, deriveClaimAddressesWithPin, saveClaimAddressesToStorage, loadClaimAddressesFromStorage,
  type DerivedClaimAddress,
} from '@/lib/stealth';
import { getChainProvider, signMessage as signWithWallet } from '@/lib/providers';
import { hasPinStored, getStoredPin, decryptPin } from '@/lib/stealth/pin';
import { getChainConfig, DEFAULT_CHAIN_ID } from '@/config/chains';

import { storageKey } from '@/lib/storageKey';

const LEGACY_STORAGE_KEY = 'tokamak_stealth_keys_';
function stealthKeysKey(addr: string): string { return storageKey('stealthkeys', addr); }

// Full validation: tries formatStealthMetaAddress + parseStealthMetaAddress round-trip
function areKeysValid(keys: StealthKeyPair): boolean {
  try {
    const meta = formatStealthMetaAddress(keys, 'thanos');
    parseStealthMetaAddress(meta);
    return true;
  } catch {
    return false;
  }
}

interface ClaimAddressWithBalance extends DerivedClaimAddress {
  balance?: string;
}

const LABELS = ['Primary', 'Secondary', 'Tertiary'];
const getLabel = (i: number) => LABELS[i] || `Wallet ${i + 1}`;

export function useStealthAddress(activeChainId?: number) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [isSigningMessage, setIsSigningMessage] = useState(false);

  const stealthKeysRef = useRef<StealthKeyPair | null>(null);
  const [hasStealthKeys, setHasStealthKeys] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Claim addresses state (unified with stealth keys)
  const [claimAddresses, setClaimAddresses] = useState<ClaimAddressWithBalance[]>([]);
  const [selectedClaimIndex, setSelectedClaimIndex] = useState(0);
  const signatureRef = useRef<string | null>(null);

  // Ref-stabilize claimAddresses so refreshClaimBalances doesn't capture stale addresses
  const claimAddressesRef = useRef(claimAddresses);
  useEffect(() => { claimAddressesRef.current = claimAddresses; }, [claimAddresses]);

  // Auto-restore: silently re-derive keys on page load using stored encrypted PIN
  const [autoRestoreFailed, setAutoRestoreFailed] = useState(false);
  const autoRestoringRef = useRef(false);

  // Derived values — safe because stealthKeys are fully validated before being set
  const metaAddress = hasStealthKeys && stealthKeysRef.current ? formatStealthMetaAddress(stealthKeysRef.current, 'thanos') : null;
  const parsedMetaAddress: StealthMetaAddress | null = (() => {
    try { return metaAddress ? parseStealthMetaAddress(metaAddress) : null; }
    catch { return null; }
  })();
  const selectedClaimAddress = claimAddresses[selectedClaimIndex] || null;
  const claimAddressesInitialized = claimAddresses.length > 0;

  // Reset state when switching wallets — keys must be re-derived each session (never persisted)
  useEffect(() => {
    if (!address || typeof window === 'undefined') { setIsHydrated(true); return; }
    setIsHydrated(false);

    // Clear stale state from previous address
    stealthKeysRef.current = null;
    setHasStealthKeys(false);
    setIsRegistered(false);
    setClaimAddresses([]);
    setSelectedClaimIndex(0);
    signatureRef.current = null;
    setAutoRestoreFailed(false);

    // Purge any legacy persisted private keys from localStorage
    localStorage.removeItem(stealthKeysKey(address));
    localStorage.removeItem(LEGACY_STORAGE_KEY + address.toLowerCase());

    // Load claim addresses metadata (public addresses + labels only)
    const savedClaims = loadClaimAddressesFromStorage(address);
    if (savedClaims.length > 0) {
      setClaimAddresses(savedClaims.map(a => ({ ...a, privateKey: '' })) as ClaimAddressWithBalance[]);
    }
    setIsHydrated(true);
  }, [address]);

  const fetchBalance = useCallback(async (addr: string, chainId?: number): Promise<string> => {
    try {
      const provider = getChainProvider(chainId ?? activeChainId);
      const bal = await provider.getBalance(addr);
      return ethers.utils.formatEther(bal);
    } catch {
      return '0';
    }
  }, [activeChainId]);

  const generateKeys = useCallback(() => {
    setError(null);
    const keys = generateStealthKeyPair();
    stealthKeysRef.current = keys;
    setHasStealthKeys(true);
    setIsRegistered(false);
  }, []);

  // Unified derivation — uses wagmi wallet client for signing (proper wallet integration)
  // Accepts optional PIN for PIN-based derivation
  // Returns the wallet signature so callers can reuse it (e.g. for PIN encryption)
  const derivingRef = useRef(false);
  const deriveKeysFromWallet = useCallback(async (pin?: string): Promise<{ sig: string; metaAddress: string } | null> => {
    if (!isConnected || !address) { setError('Wallet not connected'); return null; }
    if (derivingRef.current) return null;
    derivingRef.current = true;
    setError(null);
    setIsLoading(true);
    setIsSigningMessage(true);
    try {
      const sig = await signWithWallet(STEALTH_KEY_DERIVATION_MESSAGE, walletClient);
      signatureRef.current = sig;
      setIsSigningMessage(false);

      // Derive stealth keys — PIN-based if PIN provided, legacy otherwise
      const newKeys = pin
        ? await deriveStealthKeyPairFromSignatureAndPin(sig, pin, address)
        : deriveStealthKeyPairFromSignature(sig);

      // Validate before setting state
      if (!areKeysValid(newKeys)) {
        throw new Error('Derived keys failed validation — please try again');
      }

      stealthKeysRef.current = newKeys;
      setHasStealthKeys(true);
      setIsRegistered(false);

      // Compute metaAddress synchronously (cheap string concat) so callers
      // don't need to wait for a React re-render or re-derive keys
      const derivedMetaAddress = formatStealthMetaAddress(newKeys, 'thanos');

      // Derive claim addresses — PIN-based if PIN provided
      const stored = loadClaimAddressesFromStorage(address);
      const derived = await (pin
        ? deriveClaimAddressesWithPin(sig, pin, 3, address)
        : deriveClaimAddresses(sig, 3));
      const withLabels: ClaimAddressWithBalance[] = derived.map(a => ({
        ...a,
        label: stored.find(s => s.address.toLowerCase() === a.address.toLowerCase())?.label || getLabel(a.index),
      }));

      // Strip private keys before state/storage — keys are re-derived from wallet signature each session
      const withLabelsStripped = withLabels.map(a => ({ ...a, privateKey: '' })) as ClaimAddressWithBalance[];
      setClaimAddresses(withLabelsStripped);
      saveClaimAddressesToStorage(address, withLabelsStripped);

      // Fetch balances in background (don't block)
      Promise.all(withLabels.map(a => fetchBalance(a.address))).then(balances => {
        setClaimAddresses(prev => prev.map((a, i) => ({ ...a, balance: balances[i] })));
      });

      return { sig, metaAddress: derivedMetaAddress };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to derive keys';
      if (
        msg.toLowerCase().includes('rejected') ||
        msg.toLowerCase().includes('denied') ||
        msg.includes('ACTION_REJECTED') ||
        msg.includes('user_rejected')
      ) {
        // User cancelled — show a gentle prompt instead of an error
        setError('Please approve the signature request in your wallet');
      } else {
        console.error('[useStealthAddress] Signature failed:', msg);
        setError(msg);
      }
      return null;
    } finally {
      setIsLoading(false);
      setIsSigningMessage(false);
      derivingRef.current = false;
    }
  }, [isConnected, address, walletClient, fetchBalance]);

  const clearKeys = useCallback(() => {
    stealthKeysRef.current = null;
    setHasStealthKeys(false);
    setIsRegistered(false);
    setError(null);
    setClaimAddresses([]);
    signatureRef.current = null;
    if (address && typeof window !== 'undefined') {
      localStorage.removeItem(stealthKeysKey(address));
    }
  }, [address]);

  const importKeys = useCallback((keys: StealthKeyPair) => {
    if (!areKeysValid(keys)) {
      setError('Imported keys are invalid');
      return;
    }
    stealthKeysRef.current = keys;
    setHasStealthKeys(true);
    setIsRegistered(false);
    setError(null);
  }, []);

  const exportKeys = useCallback(() => stealthKeysRef.current, []);

  const registeringRef = useRef(false);
  const registerMetaAddress = useCallback(async (chainId?: number): Promise<string | null> => {
    if (!metaAddress || !isConnected || !address) { setError('No keys or wallet not connected'); return null; }
    if (!walletClient) { setError('Wallet not ready — please try again'); return null; }
    if (registeringRef.current) return null;
    registeringRef.current = true;
    setError(null);
    setIsLoading(true);
    const cid = chainId ?? DEFAULT_CHAIN_ID;
    try {
      const provider = getChainProvider(cid);
      const config = getChainConfig(cid);
      const registryContract = new ethers.Contract(
        config.contracts.registry,
        ['function nonceOf(address) view returns (uint256)'],
        provider,
      );
      const nonce = await registryContract.nonceOf(address);

      // EIP-712 signature via wagmi walletClient (works with Privy embedded wallets)
      const metaBytes = metaAddress.startsWith('st:')
        ? ('0x' + (metaAddress.match(/st:[a-z]+:0x([0-9a-fA-F]+)/)?.[1] || '')) as `0x${string}`
        : (metaAddress.startsWith('0x') ? metaAddress : '0x' + metaAddress) as `0x${string}`;

      const signature = await walletClient.signTypedData({
        domain: {
          name: 'ERC6538Registry',
          version: '1',
          chainId: cid,
          verifyingContract: config.contracts.registry as `0x${string}`,
        },
        types: {
          Erc6538RegistryEntry: [
            { name: 'schemeId', type: 'uint256' },
            { name: 'stealthMetaAddress', type: 'bytes' },
            { name: 'nonce', type: 'uint256' },
          ],
        },
        primaryType: 'Erc6538RegistryEntry',
        message: {
          schemeId: BigInt(SCHEME_ID.SECP256K1),
          stealthMetaAddress: metaBytes,
          nonce: BigInt(nonce.toString()),
        },
      });

      const res = await fetch('/api/sponsor-register-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrant: address, metaAddress, signature, chainId: cid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sponsored registration failed');

      setIsRegistered(true);
      return data.txHash;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to register');
      return null;
    } finally {
      setIsLoading(false);
      registeringRef.current = false;
    }
  }, [metaAddress, isConnected, address, walletClient]);

  const checkRegistration = useCallback(async (chainId?: number): Promise<boolean> => {
    if (!address || !isConnected) return false;
    setIsLoading(true);
    try {
      const provider = getChainProvider(chainId);
      const registered = await checkIsRegistered(provider, address, SCHEME_ID.SECP256K1, getRegistryForChain(chainId));
      setIsRegistered(registered);
      return registered;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

  const lookupAddress = useCallback(async (addr: string, chainId?: number): Promise<string | null> => {
    setIsLoading(true);
    try {
      const provider = getChainProvider(chainId);
      return await lookupStealthMetaAddress(provider, addr, SCHEME_ID.SECP256K1, getRegistryForChain(chainId));
    } catch {
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectClaimAddress = useCallback((index: number) => {
    if (index >= 0 && index < claimAddresses.length) setSelectedClaimIndex(index);
  }, [claimAddresses.length]);

  const refreshClaimBalances = useCallback(async () => {
    const current = claimAddressesRef.current;
    if (!current.length) return;
    const balances = await Promise.all(current.map(a => fetchBalance(a.address)));
    setClaimAddresses(prev => prev.map((a, i) => ({ ...a, balance: balances[i] })));
  }, [fetchBalance]);

  // Auto-restore: sign message silently → decrypt stored PIN → re-derive keys
  // Privy embedded wallets sign without popup; external wallets show one signature request
  const autoRestoreKeys = useCallback(async (): Promise<boolean> => {
    if (!isConnected || !address || !walletClient) return false;
    if (stealthKeysRef.current) return true;
    if (!hasPinStored(address)) return false;
    if (autoRestoringRef.current || derivingRef.current) return false;
    autoRestoringRef.current = true;

    try {
      const sig = await signWithWallet(STEALTH_KEY_DERIVATION_MESSAGE, walletClient);
      signatureRef.current = sig;

      const stored = getStoredPin(address);
      if (!stored) { setAutoRestoreFailed(true); return false; }
      const pin = await decryptPin(stored, sig);

      const newKeys = await deriveStealthKeyPairFromSignatureAndPin(sig, pin, address);
      if (!areKeysValid(newKeys)) { setAutoRestoreFailed(true); return false; }

      stealthKeysRef.current = newKeys;
      setHasStealthKeys(true);

      const savedClaims = loadClaimAddressesFromStorage(address);
      const derived = await deriveClaimAddressesWithPin(sig, pin, 3, address);
      const withLabels: ClaimAddressWithBalance[] = derived.map(a => ({
        ...a,
        label: savedClaims.find(s => s.address.toLowerCase() === a.address.toLowerCase())?.label || getLabel(a.index),
      }));
      const withLabelsStripped = withLabels.map(a => ({ ...a, privateKey: '' })) as ClaimAddressWithBalance[];
      setClaimAddresses(withLabelsStripped);
      saveClaimAddressesToStorage(address, withLabelsStripped);

      Promise.all(withLabels.map(a => fetchBalance(a.address))).then(balances => {
        setClaimAddresses(prev => prev.map((a, i) => ({ ...a, balance: balances[i] })));
      });

      return true;
    } catch {
      setAutoRestoreFailed(true);
      return false;
    } finally {
      autoRestoringRef.current = false;
    }
  }, [isConnected, address, walletClient, fetchBalance]);

  // Trigger auto-restore after hydration when wallet is ready
  useEffect(() => {
    if (!walletClient || !address || !isConnected || !isHydrated) return;
    if (stealthKeysRef.current) return;
    if (!hasPinStored(address)) return;
    if (autoRestoreFailed) return;
    autoRestoreKeys();
  }, [walletClient, address, isConnected, isHydrated, autoRestoreKeys, autoRestoreFailed]);

  // Clear in-memory keys on wallet disconnect or address change
  // Prevents cross-account key leakage if user switches wallets
  const prevAddressRef = useRef(address);
  useEffect(() => {
    if (prevAddressRef.current && prevAddressRef.current !== address) {
      stealthKeysRef.current = null;
      signatureRef.current = null;
      setHasStealthKeys(false);
      setIsRegistered(false);
      setClaimAddresses([]);
      setError(null);
    }
    prevAddressRef.current = address;
  }, [address]);

  return {
    stealthKeys: stealthKeysRef.current, metaAddress, parsedMetaAddress,
    generateKeys, deriveKeysFromWallet, clearKeys, importKeys, exportKeys,
    registerMetaAddress, isRegistered, checkRegistration, lookupAddress,
    isLoading, isSigningMessage, isHydrated, error, autoRestoreFailed,
    // Claim addresses (unified)
    claimAddresses, selectedClaimAddress, selectedClaimIndex, claimAddressesInitialized,
    selectClaimAddress, refreshClaimBalances,
  };
}
