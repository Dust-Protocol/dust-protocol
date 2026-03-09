import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import {
  resolveStealthName, isNameAvailable, getNamesOwnedBy,
  isNameRegistryConfigured, stripNameSuffix,
  formatNameWithSuffix, isValidName, getNameOwner, discoverNameByMetaAddress,
  discoverNameByWalletHistory, getRegistryForChain,
} from '@/lib/stealth';
import { DEFAULT_CHAIN_ID } from '@/config/chains';
import { useNamesOwnedBy, useNamesByMetaAddress, useNamesByWallet } from '@/hooks/graph/useNameQuery';
import { isGraphAvailable } from '@/lib/graph/client';
import type { OwnedName } from '@/lib/design/types';

// Enabled by default — set NEXT_PUBLIC_USE_GRAPH=false to explicitly disable
const USE_GRAPH = process.env.NEXT_PUBLIC_USE_GRAPH !== 'false';

export function useStealthName(userMetaAddress?: string | null, chainId?: number) {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const [legacyOwnedNames, setLegacyOwnedNames] = useState<OwnedName[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legacyNamesSettled, setLegacyNamesSettled] = useState(false);
  const recoveryAttempted = useRef(false);
  // Keep a ref so loadOwnedNames can always read the latest metaAddress without
  // being recreated every time keys are derived (which would re-trigger the load effect).
  const userMetaAddressRef = useRef(userMetaAddress);
  useEffect(() => { userMetaAddressRef.current = userMetaAddress; }, [userMetaAddress]);
  // Guard against concurrent invocations of the discovery pipeline.
  const loadingRef = useRef(false);
  // Prevents re-running legacy discovery after it has already settled for this address.
  const legacySettledRef = useRef(false);
  // Tracks the current address so stale async results from a previous address are discarded.
  const addressRef = useRef(address);

  const activeChainId = chainId ?? DEFAULT_CHAIN_ID;
  const isConfigured = isNameRegistryConfigured();

  // --- Graph-based name loading (when USE_GRAPH is enabled) ---
  const graphEnabled = USE_GRAPH && isGraphAvailable(activeChainId);

  // Primary Graph lookup: query names by ownerAddress (most reliable — works
  // immediately after auto-transfer, no ERC-6538 or derived keys needed)
  const {
    data: graphOwnerNames,
    isLoading: graphOwnerLoading,
    isError: graphOwnerFailed,
  } = useNamesOwnedBy(
    graphEnabled && isConnected ? address : undefined,
    activeChainId,
  );

  const {
    data: graphNames,
    isLoading: graphLoading,
    isError: graphFailed,
    error: graphError,
    refetch: refetchGraphNames,
  } = useNamesByMetaAddress(
    graphEnabled && isConnected ? userMetaAddress : undefined,
    activeChainId,
  );

  // Wallet-based Graph lookup: when userMetaAddress is null (cleared cache / new browser),
  // chain wallet → ERC-6538 metaAddress → names. This lets us detect existing names
  // even before the user derives keys.
  const needsWalletLookup = graphEnabled && isConnected && !userMetaAddress;
  const {
    data: graphWalletNames,
    isLoading: graphWalletLoading,
    isError: graphWalletFailed,
  } = useNamesByWallet(
    needsWalletLookup ? address : undefined,
    activeChainId,
  );

  // Derive ownedNames from Graph data when enabled
  // Priority: owner-based (most reliable) > metaAddress-based > wallet-chain
  const graphOwnedNames = useMemo<OwnedName[]>(() => {
    if (!graphEnabled) return [];
    const names = graphOwnerNames?.length ? graphOwnerNames
      : graphNames?.length ? graphNames
      : graphWalletNames;
    if (!names?.length) return [];
    return names.map((n) => ({
      name: n.name,
      fullName: formatNameWithSuffix(n.name),
    }));
  }, [graphEnabled, graphOwnerNames, graphNames, graphWalletNames]);

  // Graph→RPC fallback: if Graph is enabled but ALL Graph queries errored, fall back to legacy
  const useGraphData = graphEnabled && !graphOwnerFailed && !graphFailed && !(needsWalletLookup && graphWalletFailed);

  // Detect when all graph queries succeeded but returned NOTHING — triggers legacy fallback.
  const graphReturnedEmpty = graphEnabled
    && !graphOwnerLoading && !graphLoading && !graphWalletLoading
    && !graphOwnerFailed && !graphFailed && !graphWalletFailed
    && graphOwnedNames.length === 0;

  // Unified ownedNames: prefer Graph when it has data, fall back to legacy/discovery
  const ownedNames = graphOwnedNames.length > 0 ? graphOwnedNames : legacyOwnedNames;

  // Reset legacy name state when the wallet address changes (switch wallet, disconnect/reconnect)
  // so stale names from the previous wallet are never used for routing decisions.
  useEffect(() => {
    addressRef.current = address;
    setLegacyOwnedNames([]);
    setIsLoading(false);
    recoveryAttempted.current = false;
    loadingRef.current = false;
    legacySettledRef.current = false;
    setLegacyNamesSettled(!address);
    // Purge stale name cache to prevent one-render data leak across wallet switches
    queryClient.removeQueries({ queryKey: ['names'] });
  }, [address, queryClient]);

  const validateName = useCallback((name: string): { valid: boolean; error?: string } => {
    const stripped = stripNameSuffix(name);
    if (!stripped.length) return { valid: false, error: 'Name cannot be empty' };
    if (stripped.length > 32) return { valid: false, error: 'Name too long (max 32 characters)' };
    if (!isValidName(stripped)) return { valid: false, error: 'Only letters, numbers, dash (-), and underscore (_) allowed' };
    return { valid: true };
  }, []);

  // --- Legacy name loading (when USE_GRAPH is disabled or Graph failed) ---
  // Includes full discovery pipeline:
  //   1. Direct ownership lookup (getNamesOwnedBy - works after tryRecoverName transfers ownership)
  //   2. metaAddress-based discovery (fast, needs derived keys)
  //   3. ERC-6538 history-based discovery (works WITHOUT derived keys — cleared cache / new browser)
  // isNamesSettled is only set TRUE after ALL of these complete, preventing premature routing.

  // Background recovery: transfer name ownership from deployer to user (fire-and-forget)
  const tryRecoverName = useCallback(async (name: string, userAddress: string) => {
    try {
      const owner = await getNameOwner(null, name, activeChainId);
      if (!owner || owner.toLowerCase() === userAddress.toLowerCase()) return;
      const res = await fetch('/api/sponsor-name-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, newOwner: userAddress, chainId: activeChainId }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['names'] });
        queryClient.invalidateQueries({ queryKey: ['name'] });
      }
    } catch {
      // Silent — recovery is best-effort
    }
  }, [activeChainId, queryClient]);

  const registeringNameRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadOwnedNames = useCallback(async () => {
    // If graph already found names (via any method: owner, meta, wallet) — no need for legacy.
    if (graphEnabled && graphOwnedNames.length > 0) {
      refetchGraphNames();
      return;
    }

    if (!isConnected || !address || !isConfigured) {
      setLegacyOwnedNames([]);
      setLegacyNamesSettled(true);
      return;
    }

    // Prevent concurrent scans and duplicate runs after settling.
    if (loadingRef.current || legacySettledRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    // Read the latest metaAddress via ref (not captured in deps) so re-running after
    // key derivation doesn't cause a spurious re-scan when we already have a name.
    const currentMetaAddress = userMetaAddressRef.current;

    // Capture address at scan start — if it changes mid-flight, discard results.
    const scanAddress = address;

    try {
      let found = false;
      const setNameOnce = (name: string) => {
        if (found) return;
        // Stale guard: address changed since this scan started — discard result
        if (addressRef.current !== scanAddress) return;
        found = true;
        setLegacyOwnedNames([{ name, fullName: formatNameWithSuffix(name) }]);
        if (!recoveryAttempted.current) {
          recoveryAttempted.current = true;
          tryRecoverName(name, scanAddress);
        }
      };

      // Server API — most reliable, runs in parallel with RPC chain
      const apiPromise = (async () => {
        try {
          const res = await fetch(`/api/lookup-wallet-name?address=${address}`, {
            signal: abortRef.current?.signal,
          });
          if (res.ok) {
            const data = await res.json();
            if (data.name) setNameOnce(data.name);
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return;
        }
      })();

      // RPC discovery chain (sequential within itself)
      const rpcPromise = (async () => {
        // 1. Direct on-chain ownership lookup (fast when auto-transfer succeeded)
        const names = await getNamesOwnedBy(null, address, activeChainId);
        if (names.length > 0) {
          setNameOnce(names[names.length - 1]);
          return;
        }

        // 2. metaAddress-based discovery (needs derived keys)
        if (currentMetaAddress) {
          const d = await discoverNameByMetaAddress(null, currentMetaAddress, activeChainId);
          if (d) { setNameOnce(d); return; }
        }

        // 3. ERC-6538 history scan (works without derived keys)
        const d = await discoverNameByWalletHistory(
          address,
          currentMetaAddress ?? '',
          getRegistryForChain(activeChainId),
          activeChainId,
        );
        if (d) setNameOnce(d);
      })();

      await Promise.allSettled([rpcPromise, apiPromise]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load names');
    } finally {
      // Only update state if this scan is still for the current address
      if (addressRef.current === scanAddress) {
        setIsLoading(false);
        loadingRef.current = false;
        legacySettledRef.current = true;
        setLegacyNamesSettled(true);
      }
    }
  // userMetaAddress intentionally excluded — read via ref to prevent re-run on key derivation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isConnected, isConfigured, activeChainId, graphEnabled, graphFailed, graphOwnerFailed, refetchGraphNames, tryRecoverName]);

  // Initial load trigger
  // Run legacy discovery when:
  //  a) Graph is disabled (always use RPC), OR
  //  b) Graph is enabled but BOTH metaAddress-based AND wallet-based queries failed
  //     (wallet-based query is the primary fallback for cleared-cache users now), OR
  //  c) Graph returned empty results (e.g. no ERC-6538 data in subgraph, all names deployer-owned)
  //     — we still need to check the legacy/API pipeline
  const needsLegacyDiscovery = !useGraphData
    || (graphEnabled && !userMetaAddress && graphWalletFailed)
    || graphReturnedEmpty;
  useEffect(() => {
    // Abort previous in-flight fetch when deps change or component unmounts
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    if (needsLegacyDiscovery && isConnected && isConfigured) loadOwnedNames();
    else if (needsLegacyDiscovery && isConnected && !isConfigured) setLegacyNamesSettled(true);
    // When !isConnected (Privy still hydrating), do NOT settle — wait for address to resolve.

    return () => { abortRef.current?.abort(); };
  }, [needsLegacyDiscovery, isConnected, isConfigured, loadOwnedNames]);

  // Settled = all relevant queries have finished loading.
  // Owner-based Graph query is the primary signal (fastest, most reliable).
  // If Graph found names via any method, settled immediately.
  // If Graph returned empty, wait for legacy pipeline to also finish.
  const isNamesSettled = useGraphData
    ? (graphOwnedNames.length > 0
        ? true
        : (!graphOwnerLoading && !graphLoading && !graphWalletLoading
            ? legacyNamesSettled
            : false))
    : legacyNamesSettled;
  const registerName = useCallback(async (name: string, metaAddress: string): Promise<string | null> => {
    if (!isConnected || !isConfigured) {
      setError('Not connected or registry not configured');
      return null;
    }
    if (registeringNameRef.current) return null;

    const validation = validateName(name);
    if (!validation.valid) {
      setError(validation.error || 'Invalid name');
      return null;
    }

    registeringNameRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Sponsored: deployer registers name on-chain (user pays no gas)
      // Include registrant address so the API can auto-transfer ownership
      const res = await fetch('/api/sponsor-name-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: stripNameSuffix(name), metaAddress, chainId: activeChainId, registrant: address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Name registration failed');

      const stripped = stripNameSuffix(name);
      const normalizedMeta = (metaAddress.match(/^st:[a-z]+:(0x[0-9a-fA-F]+)$/)?.[1] || metaAddress).toLowerCase();
      const now = String(Math.floor(Date.now() / 1000));
      const optimisticEntry = { id: '', name: stripped, ownerAddress: (address ?? '').toLowerCase(), metaAddress: normalizedMeta, registeredAt: now };
      // Optimistically set in React Query caches (persists across page navigation)
      // queryKey for 'owned' must use raw address (wagmi checksummed) to match useNamesOwnedBy
      queryClient.setQueryData(['names', 'meta', activeChainId, normalizedMeta], [optimisticEntry]);
      queryClient.setQueryData(['names', 'owned', activeChainId, address], [optimisticEntry]);
      setLegacyOwnedNames([{ name: stripped, fullName: formatNameWithSuffix(stripped) }]);

      return data.txHash ?? (data.alreadyRegistered ? 'already-registered' : null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to register name';
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
      registeringNameRef.current = false;
    }
  }, [isConnected, isConfigured, validateName, activeChainId, queryClient, address]);

  const checkAvailability = useCallback(async (name: string): Promise<boolean | null> => {
    if (!isConfigured) return null;
    try {
      return await isNameAvailable(null, name, activeChainId);
    } catch { return null; }
  }, [isConfigured, activeChainId]);

  const resolveName = useCallback(async (name: string): Promise<string | null> => {
    if (!isConfigured) return null;
    try {
      return await resolveStealthName(null, name, activeChainId);
    } catch { return null; }
  }, [isConfigured, activeChainId]);

  const updateMetaAddress = useCallback(async (_name: string, _newMetaAddress: string): Promise<string | null> => {
    // Name meta-address updates are handled by the deployer (name owner)
    // Not exposed to users currently
    setError('Not supported — contact admin');
    return null;
  }, []);

  return {
    ownedNames, loadOwnedNames, registerName, checkAvailability, resolveName, updateMetaAddress,
    isConfigured, formatName: formatNameWithSuffix, validateName,
    isLoading: useGraphData ? graphLoading : isLoading,
    isNamesSettled,
    error: graphFailed ? (graphError instanceof Error ? graphError.message : 'Graph query failed') : error,
    graphFailed,
  };
}
