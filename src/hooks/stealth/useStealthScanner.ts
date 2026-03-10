import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import {
  scanAnnouncements, setLastScannedBlock as saveLastScannedBlock,
  getLastScannedBlock, getAnnouncementCount, getAddressFromPrivateKey,
  computeStealthPrivateKey,
  signWalletDrain, signWalletExecute, signUserOp,
  type StealthKeyPair, type ScanResult, type TokenBalance,
  DUST_POOL_ABI, STEALTH_ACCOUNT_FACTORY_ABI,
} from '@/lib/stealth';
import {
  generateDeposit,
  saveDeposits,
  loadDeposits,
  type StoredDeposit,
} from '@/lib/dustpool';
import { getChainConfig, DEFAULT_CHAIN_ID, getMinClaimableBalance } from '@/config/chains';
import { getTokensForChain } from '@/config/tokens';
import { getChainProvider, getChainBatchProvider, rotateBatchProvider } from '@/lib/providers';

const ERC20_BALANCE_ABI = [
  'function balanceOf(address) view returns (uint256)',
];

// L2 public RPCs have stricter rate limits — longer polling intervals
const BG_SCAN_INTERVAL_MS: Record<number, number> = {
  11155111: 3_000,     // Eth Sepolia (generous free-tier)
  111551119090: 3_000, // Thanos Sepolia
  421614: 10_000,      // Arbitrum Sepolia (~0.25s blocks, strict rate limits)
  11155420: 10_000,    // OP Sepolia (2s blocks)
  84532: 10_000,       // Base Sepolia (2s blocks)
  545: 10_000,         // Flow EVM Testnet
};
const DEFAULT_BG_SCAN_INTERVAL_MS = 10_000;

// L2 public RPCs don't support archive queries (getBalance at historical block)
const ARCHIVE_SUPPORTED: Set<number> = new Set([11155111, 111551119090]);

interface StealthPayment extends ScanResult {
  balance?: string;
  originalAmount?: string;
  claimed?: boolean;
  keyMismatch?: boolean;
  autoClaiming?: boolean;
  tokenBalances?: TokenBalance[];
  /** Token address decoded from announcement metadata (C1 fix) */
  announcedTokenAddress?: string | null;
  /** Token amount (raw hex) decoded from announcement metadata (C1 fix) */
  announcedTokenAmount?: string | null;
  /** Chain ID encoded in announcement metadata */
  announcedChainId?: number | null;
}

// localStorage keys — hashed to avoid wallet fingerprinting
import { storageKey, migrateKey } from '@/lib/storageKey';

function paymentsKey(address: string, chainId: number): string {
  return storageKey('payments', address, chainId);
}

function loadPaymentsFromStorage(address: string, chainId: number): StealthPayment[] {
  if (typeof window === 'undefined') return [];
  // Migrate both legacy key formats to hashed key
  migrateKey(`stealth_payments_${chainId}_${address.toLowerCase()}`, paymentsKey(address, chainId));
  migrateKey(`stealth_payments_${address.toLowerCase()}`, paymentsKey(address, chainId));
  try {
    const raw = localStorage.getItem(paymentsKey(address, chainId));
    if (!raw) return [];
    // Strip transient UI state (autoClaiming) on load
    return JSON.parse(raw).map((p: StealthPayment) => ({ ...p, autoClaiming: false }));
  } catch {
    return [];
  }
}

function savePaymentsToStorage(address: string, chainId: number, payments: StealthPayment[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(paymentsKey(address, chainId), JSON.stringify(payments));
  } catch { /* quota exceeded etc */ }
}

// StealthAccount.drain(address to) selector
const DRAIN_SELECTOR = '0xece53132';

// Auto-claim an ERC-4337 account payment via bundle API
async function autoClaimAccount(
  payment: ScanResult,
  recipient: string,
  chainId: number,
): Promise<{ txHash: string } | null> {
  try {
    const config = getChainConfig(chainId);
    const ownerEOA = getAddressFromPrivateKey(payment.stealthPrivateKey);
    const accountAddress = payment.announcement.stealthAddress;

    // Check if account is already deployed
    const provider = getChainProvider(chainId);
    const code = await provider.getCode(accountAddress);
    const isDeployed = code !== '0x';

    // Build initCode if not deployed
    let initCode = '0x';
    if (!isDeployed) {
      const iface = new ethers.utils.Interface(STEALTH_ACCOUNT_FACTORY_ABI);
      const createData = iface.encodeFunctionData('createAccount', [ownerEOA, 0]);
      initCode = ethers.utils.hexConcat([config.contracts.accountFactory, createData]);
    }

    // Build callData: drain(recipient)
    const callData = ethers.utils.hexConcat([
      DRAIN_SELECTOR,
      ethers.utils.defaultAbiCoder.encode(['address'], [recipient]),
    ]);

    // Step 1: Get completed UserOp from server
    const prepRes = await fetch('/api/bundle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: accountAddress,
        initCode,
        callData,
        chainId,
      }),
    });
    const prepData = await prepRes.json();
    if (!prepRes.ok) {
      if (process.env.NODE_ENV === 'development') console.warn('[AutoClaim/Account] Prep failed:', prepData.error);
      return null;
    }

    // Step 2: Sign userOpHash locally (private key never leaves browser)
    const { userOp, userOpHash } = prepData;
    userOp.signature = await signUserOp(userOpHash, payment.stealthPrivateKey);

    // Step 3: Submit signed UserOp
    const submitRes = await fetch('/api/bundle/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userOp, chainId }),
    });
    const submitData = await submitRes.json();
    if (!submitRes.ok) {
      if (process.env.NODE_ENV === 'development') console.warn('[AutoClaim/Account] Submit failed:', submitData.error);
      return null;
    }

    if (process.env.NODE_ENV === 'development') console.log('[AutoClaim/Account] Success:', submitData.txHash);
    return submitData;
  } catch (e) {
    if (process.env.NODE_ENV === 'development') console.warn('[AutoClaim/Account] Error:', e);
    return null;
  }
}

// Auto-claim a single payment via sponsor-claim API (legacy CREATE2 + EOA)
async function autoClaimLegacy(
  payment: ScanResult,
  recipient: string,
  chainId: number,
): Promise<{ txHash: string; amount: string; gasFunded: string } | null> {
  try {
    let body: Record<string, string | number>;

    if (payment.walletType === 'create2') {
      const ownerEOA = getAddressFromPrivateKey(payment.stealthPrivateKey);
      const stealthAddress = payment.announcement.stealthAddress;

      // Read current nonce from deployed wallet (may be >0 if prior drain was attempted)
      const provider = getChainProvider(chainId);
      let walletNonce = 0;
      try {
        const code = await provider.getCode(stealthAddress);
        if (code !== '0x') {
          const walletContract = new ethers.Contract(stealthAddress, ['function nonce() view returns (uint256)'], provider);
          walletNonce = (await walletContract.nonce()).toNumber();
        }
      } catch {
        // Not yet deployed — nonce is 0
      }

      const signature = await signWalletDrain(
        payment.stealthPrivateKey,
        stealthAddress,
        recipient,
        chainId,
        walletNonce,
      );
      body = {
        stealthAddress,
        owner: ownerEOA,
        recipient,
        signature,
        chainId,
      };
    } else {
      // Legacy EOA path no longer supported — private keys must never be sent to server
      if (process.env.NODE_ENV === 'development') console.warn('[AutoClaim] Legacy EOA claim skipped — use CREATE2 or ERC-4337');
      return null;
    }

    const res = await fetch('/api/sponsor-claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      if (process.env.NODE_ENV === 'development') console.warn('[AutoClaim] Failed:', data.error);
      return null;
    }
    if (process.env.NODE_ENV === 'development') console.log('[AutoClaim] Success, type:', payment.walletType);
    return data;
  } catch (e) {
    if (process.env.NODE_ENV === 'development') console.warn('[AutoClaim] Error:', e);
    return null;
  }
}

// Auto-claim an EIP-7702 payment via delegate-7702 API
async function autoClaim7702(
  payment: ScanResult,
  recipient: string,
  chainId: number,
): Promise<{ txHash: string } | null> {
  try {
    // Dynamic import to avoid bundling viem on non-7702 chains
    const { signDrain7702, buildSignedAuthorization } = await import('@/lib/stealth/eip7702');

    const stealthAddress = payment.announcement.stealthAddress;

    // 1. Build signed EIP-7702 authorization (delegates code to implementation)
    const authorization = await buildSignedAuthorization(payment.stealthPrivateKey, chainId);

    // 2. Read current drain nonce from contract (may be >0 if prior drain failed/was replayed)
    const provider = getChainProvider(chainId);
    let drainNonce = 0;
    try {
      const code = await provider.getCode(stealthAddress);
      if (code !== '0x') {
        const contract = new ethers.Contract(stealthAddress, ['function drainNonce() view returns (uint256)'], provider);
        drainNonce = (await contract.drainNonce()).toNumber();
      }
    } catch {
      // If read fails (not yet delegated), nonce is 0
    }

    // 3. Sign drain message with current nonce
    const drainSig = await signDrain7702(
      payment.stealthPrivateKey,
      stealthAddress,
      recipient,
      drainNonce,
      chainId,
    );

    // 3. Submit to server for type-4 tx
    const res = await fetch('/api/delegate-7702', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stealthAddress,
        authorization,
        mode: 'drain',
        drainTo: recipient,
        drainSig,
        chainId,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      if (process.env.NODE_ENV === 'development') console.warn('[AutoClaim/7702] Failed:', data.error);
      return null;
    }

    if (process.env.NODE_ENV === 'development') console.log('[AutoClaim/7702] Success:', data.txHash);
    return data;
  } catch (e) {
    console.error('[AutoClaim/7702] Error:', e);
    return null;
  }
}

// Route claim by wallet type
async function autoClaimPayment(
  payment: ScanResult,
  recipient: string,
  chainId: number,
): Promise<{ txHash: string } | null> {
  if (payment.walletType === 'eip7702') {
    return autoClaim7702(payment, recipient, chainId);
  }
  if (payment.walletType === 'account') {
    return autoClaimAccount(payment, recipient, chainId);
  }
  return autoClaimLegacy(payment, recipient, chainId);
}

// Sweep ERC-20 tokens from a deployed CREATE2 stealth wallet
async function sweepTokensFromWallet(
  payment: ScanResult,
  recipient: string,
  chainId: number,
): Promise<{ swept: { token: string; txHash: string; amount: string }[] } | null> {
  if (payment.walletType !== 'create2') return null;
  if (!payment.tokenBalances || payment.tokenBalances.length === 0) return null;

  try {
    const ownerEOA = getAddressFromPrivateKey(payment.stealthPrivateKey);
    const stealthAddress = payment.announcement.stealthAddress;

    // Read current wallet nonce (wallet is already deployed for token sweeps)
    const provider = getChainProvider(chainId);
    let walletNonce = 0;
    try {
      const walletContract = new ethers.Contract(stealthAddress, ['function nonce() view returns (uint256)'], provider);
      walletNonce = (await walletContract.nonce()).toNumber();
    } catch {
      // Fallback to 0
    }

    // Build signatures for each token sweep via signWalletExecute
    // Each execute() increments the contract nonce, so use sequential nonces
    const tokenSweeps = [];
    for (let i = 0; i < payment.tokenBalances.length; i++) {
      const tb = payment.tokenBalances[i];
      const erc20Iface = new ethers.utils.Interface(ERC20_BALANCE_ABI.concat([
        'function transfer(address to, uint256 amount) returns (bool)',
      ]));
      const tokenContract = new ethers.Contract(tb.token, ERC20_BALANCE_ABI, provider);
      const balance: ethers.BigNumber = await tokenContract.balanceOf(stealthAddress);

      const transferData = erc20Iface.encodeFunctionData('transfer', [recipient, balance]);

      const signature = await signWalletExecute(
        payment.stealthPrivateKey,
        stealthAddress,
        tb.token,
        ethers.BigNumber.from(0),
        transferData,
        chainId,
        walletNonce + i,
      );
      tokenSweeps.push({ tokenAddress: tb.token, signature });
    }

    const res = await fetch('/api/sponsor-claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stealthAddress: payment.announcement.stealthAddress,
        owner: ownerEOA,
        recipient,
        tokenSweeps,
        chainId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (process.env.NODE_ENV === 'development') console.warn('[TokenSweep] Failed:', data.error);
      return null;
    }
    return data;
  } catch (e) {
    if (process.env.NODE_ENV === 'development') console.warn('[TokenSweep] Error:', e);
    return null;
  }
}

// Stealth wallet deposits DIRECTLY into DustPool (privacy-preserving).
// Each deposit comes from the unique stealth address, not the sponsor wallet.
// ERC-4337: UserOp with execute(DustPool, balance, deposit(commitment))
// CREATE2: wallet.execute(DustPool, balance, deposit(commitment), sig) via API
async function claimToPoolDeposit(
  payment: ScanResult,
  userAddress: string,
  chainId: number,
): Promise<{ txHash: string; leafIndex: number; depositData: StoredDeposit } | null> {
  try {
    const config = getChainConfig(chainId);
    const dustPoolAddress = config.contracts.dustPool;
    if (!dustPoolAddress) {
      if (process.env.NODE_ENV === 'development') console.warn('[PoolDeposit] DustPool not available on chain', chainId);
      return null;
    }

    const wt = payment.walletType;
    if (wt !== 'create2' && wt !== 'account' && wt !== 'eip7702') {
      if (process.env.NODE_ENV === 'development') console.warn('[PoolDeposit] Unsupported wallet type:', wt);
      return null;
    }

    const provider = getChainProvider(chainId);
    const balance = await provider.getBalance(payment.announcement.stealthAddress);
    if (balance.isZero()) {
      if (process.env.NODE_ENV === 'development') console.log('[PoolDeposit] Zero balance, skipping');
      return null;
    }

    // Generate deposit preimage using exact balance
    const deposit = await generateDeposit(balance.toBigInt());

    // Encode DustPool.deposit(commitment) calldata
    const poolIface = new ethers.utils.Interface(DUST_POOL_ABI);
    const depositCalldata = poolIface.encodeFunctionData('deposit', [deposit.commitmentHex, balance]);

    let txHash: string;
    let leafIndex: number;

    if (wt === 'eip7702') {
      // EIP-7702: delegate to subAccount7702, initialize with sponsor, execute pool deposit
      if (process.env.NODE_ENV === 'development') console.log('[PoolDeposit/7702] Starting for', payment.announcement.stealthAddress);

      const { signInitialize7702, buildSignedAuthorization } = await import('@/lib/stealth/eip7702');
      const stealthAddress = payment.announcement.stealthAddress;

      // Get sponsor address from API
      const sponsorRes = await fetch('/api/delegate-7702');
      const sponsorData = await sponsorRes.json();
      if (!sponsorRes.ok) {
        if (process.env.NODE_ENV === 'development') console.warn('[PoolDeposit/7702] Failed to get sponsor:', sponsorData.error);
        return null;
      }

      // Build authorization and initialize signature
      const authorization = await buildSignedAuthorization(payment.stealthPrivateKey, chainId);
      const initializeSig = await signInitialize7702(
        payment.stealthPrivateKey,
        stealthAddress,
        sponsorData.address,
        chainId,
      );

      // Call pool-deposit mode on delegate-7702 API
      if (process.env.NODE_ENV === 'development') console.log('[PoolDeposit/7702] Submitting pool-deposit...');
      const res = await fetch('/api/delegate-7702', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stealthAddress,
          authorization,
          mode: 'pool-deposit',
          initializeSig,
          commitment: deposit.commitmentHex,
          chainId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.warn('[PoolDeposit/7702] Failed:', data.error);
        return null;
      }

      txHash = data.txHash;
      leafIndex = data.leafIndex;

    } else if (wt === 'account') {
      // ERC-4337: Build UserOp with execute(DustPool, balance, depositCalldata)
      if (process.env.NODE_ENV === 'development') console.log('[PoolDeposit] ERC-4337 direct pool deposit...');

      const ownerEOA = getAddressFromPrivateKey(payment.stealthPrivateKey);
      const accountAddress = payment.announcement.stealthAddress;

      const code = await provider.getCode(accountAddress);
      const isDeployed = code !== '0x';

      let initCode = '0x';
      if (!isDeployed) {
        const iface = new ethers.utils.Interface(STEALTH_ACCOUNT_FACTORY_ABI);
        const createData = iface.encodeFunctionData('createAccount', [ownerEOA, 0]);
        initCode = ethers.utils.hexConcat([config.contracts.accountFactory, createData]);
      }

      const EXECUTE_SELECTOR = '0xb61d27f6';
      const callData = ethers.utils.hexConcat([
        EXECUTE_SELECTOR,
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'bytes'],
          [dustPoolAddress, balance, depositCalldata]
        ),
      ]);

      const prepRes = await fetch('/api/bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: accountAddress, initCode, callData, chainId }),
      });
      const prepData = await prepRes.json();
      if (!prepRes.ok) {
        if (process.env.NODE_ENV === 'development') console.warn('[PoolDeposit] Bundle prep failed:', prepData.error);
        return null;
      }

      const { userOp, userOpHash } = prepData;
      userOp.signature = await signUserOp(userOpHash, payment.stealthPrivateKey);

      const submitRes = await fetch('/api/bundle/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userOp, chainId }),
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok) {
        if (process.env.NODE_ENV === 'development') console.warn('[PoolDeposit] Bundle submit failed:', submitData.error);
        return null;
      }

      txHash = submitData.txHash;

      const receipt = await provider.getTransactionReceipt(txHash);
      const poolContract = new ethers.Contract(dustPoolAddress, DUST_POOL_ABI, provider);
      const depositEvent = receipt.logs.find((log: ethers.providers.Log) => {
        try { return poolContract.interface.parseLog(log).name === 'Deposit'; }
        catch { return false; }
      });
      leafIndex = depositEvent
        ? poolContract.interface.parseLog(depositEvent).args.leafIndex.toNumber()
        : 0;

    } else {
      // CREATE2: sign execute(DustPool, balance, depositCalldata) → API relays
      if (process.env.NODE_ENV === 'development') console.log('[PoolDeposit] CREATE2 direct pool deposit...');

      const ownerEOA = getAddressFromPrivateKey(payment.stealthPrivateKey);
      const signature = await signWalletExecute(
        payment.stealthPrivateKey,
        payment.announcement.stealthAddress,
        dustPoolAddress,
        balance,
        depositCalldata,
        chainId,
      );

      const res = await fetch('/api/pool-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stealthAddress: payment.announcement.stealthAddress,
          owner: ownerEOA,
          signature,
          commitment: deposit.commitmentHex,
          walletType: 'create2',
          chainId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (process.env.NODE_ENV === 'development') console.warn('[PoolDeposit] Failed:', data.error);
        return null;
      }
      txHash = data.txHash;
      leafIndex = data.leafIndex;
    }

    const storedDeposit: StoredDeposit = {
      nullifier: deposit.nullifier.toString(),
      secret: deposit.secret.toString(),
      amount: deposit.amount.toString(),
      commitment: deposit.commitmentHex,
      nullifierHash: '0x' + deposit.nullifierHash.toString(16).padStart(64, '0'),
      leafIndex,
      txHash,
      timestamp: Date.now(),
      withdrawn: false,
    };

    const existing = loadDeposits(userAddress, chainId);
    existing.push(storedDeposit);
    saveDeposits(userAddress, existing, chainId);

    if (process.env.NODE_ENV === 'development') console.log('[PoolDeposit] Success, leafIndex:', leafIndex);

    return { txHash, leafIndex, depositData: storedDeposit };
  } catch (e) {
    console.error('[PoolDeposit] Error:', e);
    return null;
  }
}

interface UseStealthScannerOptions {
  autoClaimRecipient?: string;
  claimToPool?: boolean;
  chainId?: number;
}

export function useStealthScanner(stealthKeys: StealthKeyPair | null, options?: UseStealthScannerOptions) {
  const chainId = options?.chainId ?? DEFAULT_CHAIN_ID;
  const { address, isConnected } = useAccount();
  const [payments, setPayments] = useState<StealthPayment[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoClaimingRef = useRef<Set<string>>(new Set());
  const autoClaimCooldownRef = useRef<Map<string, number>>(new Map());
  // Private keys stored in ref (NOT in React state) to avoid DevTools exposure
  const privateKeysRef = useRef<Map<string, string>>(new Map());

  const autoClaimRecipientRef = useRef(options?.autoClaimRecipient);
  autoClaimRecipientRef.current = options?.autoClaimRecipient;

  const claimToPoolRef = useRef(options?.claimToPool ?? false);
  claimToPoolRef.current = options?.claimToPool ?? false;

  // Helper: strip private key from payment before putting in state
  function stripKey(p: StealthPayment): StealthPayment {
    const { stealthPrivateKey: _key, ...rest } = p;
    return { ...rest, stealthPrivateKey: '' } as StealthPayment;
  }

  // Helper: get private key for a payment (from ref, fallback to storage)
  function getKeyForPayment(txHash: string): string {
    return privateKeysRef.current.get(txHash) || '';
  }

  // Clear ALL scanner state on address change, then reload for new address
  // Prevents cross-account key leakage when switching wallets
  useEffect(() => {
    privateKeysRef.current.clear();
    autoClaimingRef.current.clear();
    autoClaimCooldownRef.current.clear();
    setPayments([]);
    setError(null);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (address) {
      const stored = loadPaymentsFromStorage(address, chainId);
      if (stored.length > 0) {
        stored.forEach(p => {
          if (p.stealthPrivateKey) {
            privateKeysRef.current.set(p.announcement.txHash, p.stealthPrivateKey);
          }
        });
        setPayments(stored.map(stripKey));
      }
    }
  }, [address, chainId]);

  // Re-derive private keys when stealth keys become available (after page refresh)
  // Keys are not persisted to localStorage (security fix), so they must be re-computed
  // from the user's stealth key pair and each payment's ephemeral public key.
  useEffect(() => {
    if (!stealthKeys || payments.length === 0) return;

    let rederived = 0;
    for (const p of payments) {
      if (privateKeysRef.current.has(p.announcement.txHash)) continue;
      if (p.claimed || p.keyMismatch) continue;
      if (!p.announcement.ephemeralPublicKey) continue;

      try {
        const key = computeStealthPrivateKey(
          stealthKeys.spendingPrivateKey,
          stealthKeys.viewingPrivateKey,
          p.announcement.ephemeralPublicKey,
        );
        if (key) {
          privateKeysRef.current.set(p.announcement.txHash, key);
          rederived++;
        }
      } catch {
        // Skip payments where key derivation fails
      }
    }
    if (rederived > 0 && process.env.NODE_ENV === 'development') {
      console.log(`[Scanner] Re-derived ${rederived} private keys from stealth keys`);
    }
  }, [stealthKeys, payments]);

  // Persist payments whenever they change — keys are NOT persisted (security fix)
  useEffect(() => {
    if (address && payments.length > 0) {
      savePaymentsToStorage(address, chainId, payments);
    }
  }, [address, chainId, payments]);

  // Auto-claim: when new unclaimed payments appear, drain to recipient/wallet or hold for pool
  const tryAutoClaim = useCallback(async (newPayments: StealthPayment[]) => {
    const explicitRecipient = autoClaimRecipientRef.current;
    const poolMode = claimToPoolRef.current;
    // Use explicit recipient, or fall back to connected wallet address
    const recipient = explicitRecipient || address;
    // Need either a claim destination or pool mode enabled
    if (!recipient && !poolMode) return;

    // Snapshot keys at start to prevent race condition if wallet switches mid-claim.
    // Without this, later loop iterations could read keys for a different wallet.
    const keysSnapshot = new Map(privateKeysRef.current);

    const now = Date.now();
    const claimable = newPayments.filter(p => {
      const txHash = p.announcement.txHash;
      const bal = parseFloat(p.balance || '0');
      if (p.claimed || p.keyMismatch || bal <= 0) return false;
      // EOA wallets need enough balance to cover gas; sponsored types just need > 0
      if ((!p.walletType || p.walletType === 'eoa') && bal < getMinClaimableBalance(chainId)) return false;
      if (autoClaimingRef.current.has(txHash)) return false;
      // Pool-eligible payments are NOT auto-claimed — user deposits manually via dashboard button
      if (poolMode && (p.walletType === 'create2' || p.walletType === 'account' || p.walletType === 'eip7702')) return false;
      // 30-second cooldown after a failed attempt
      const lastAttempt = autoClaimCooldownRef.current.get(txHash);
      if (lastAttempt && now - lastAttempt < 30_000) return false;
      return true;
    });

    if (claimable.length === 0) return;

    for (const payment of claimable) {
      const txHash = payment.announcement.txHash;
      autoClaimingRef.current.add(txHash);

      // Mark as auto-claiming in UI
      setPayments(prev => prev.map(p =>
        p.announcement.txHash === txHash ? { ...p, autoClaiming: true } : p
      ));

      // Use snapshot key (not live ref) to avoid race condition with wallet switching
      const key = keysSnapshot.get(txHash) || '';
      if (!key) {
        autoClaimingRef.current.delete(txHash);
        setPayments(prev => prev.map(p =>
          p.announcement.txHash === txHash ? { ...p, autoClaiming: false, keyMismatch: true } : p
        ));
        continue;
      }
      const paymentWithKey = { ...payment, stealthPrivateKey: key };

      // Verify key is valid (for CREATE2, key derives the owner not the wallet address)
      try {
        getAddressFromPrivateKey(key);
      } catch {
        autoClaimingRef.current.delete(txHash);
        setPayments(prev => prev.map(p =>
          p.announcement.txHash === txHash ? { ...p, autoClaiming: false, keyMismatch: true } : p
        ));
        continue;
      }

      let claimResult: { txHash: string } | null;

      if (!recipient) {
        // No recipient and no connected address — skip
        autoClaimingRef.current.delete(txHash);
        setPayments(prev => prev.map(p =>
          p.announcement.txHash === txHash ? { ...p, autoClaiming: false } : p
        ));
        continue;
      }

      claimResult = await autoClaimPayment(paymentWithKey, recipient, chainId);

      if (claimResult) {
        // Zeroize private key — no longer needed after successful drain
        privateKeysRef.current.delete(txHash);
        keysSnapshot.delete(txHash);
        setPayments(prev => prev.map(p =>
          p.announcement.txHash === txHash ? { ...p, claimed: true, balance: '0', autoClaiming: false } : p
        ));
        autoClaimCooldownRef.current.delete(txHash);
      } else {
        setPayments(prev => prev.map(p =>
          p.announcement.txHash === txHash ? { ...p, autoClaiming: false } : p
        ));
        autoClaimCooldownRef.current.set(txHash, Date.now());
      }
      autoClaimingRef.current.delete(txHash);
    }
  }, [address, chainId]);

  const isBgScanningRef = useRef(false);
  // H2: Track current scan ID to detect superseded scans
  const currentScanIdRef = useRef(0);

  const scan = useCallback(async (fromBlock?: number, silent = false) => {
    if (!stealthKeys || !isConnected) {
      if (!silent) setError('No stealth keys or wallet not connected');
      return;
    }

    const config = getChainConfig(chainId);
    // Use direct RPC provider for event scanning — more reliable than MetaMask
    const provider = getChainProvider(chainId);
    // Use batch provider for balance queries — batches 2N calls into fewer HTTP requests
    const batchProvider = getChainBatchProvider(chainId);

    if (!silent) {
      setError(null);
      setIsScanning(true);
      setProgress({ current: 0, total: 0 });
    }

    // H2: Assign a unique scan ID to detect superseded scans.
    // Uses incrementing counter (not Date.now()) to avoid collisions from rapid triggers.
    const scanId = ++currentScanIdRef.current;

    try {
      // Incremental scanning: use lastScannedBlock for silent/background scans
      let startBlock: number;
      if (fromBlock !== undefined) {
        startBlock = fromBlock;
      } else if (silent && address) {
        // Background scan: only scan new blocks since last scan
        // Key includes chainId so scans are per-chain
        startBlock = getLastScannedBlock(address, chainId) ?? config.deploymentBlock;
      } else {
        // Full scan (manual trigger): always from deployment
        startBlock = config.deploymentBlock;
      }

      const latestBlock = await provider.getBlockNumber();

      // Check if this scan was superseded before expensive operations
      if (currentScanIdRef.current !== scanId) return;

      // Skip if we're already up to date (background scan optimization)
      if (silent && startBlock >= latestBlock) return;

      if (process.env.NODE_ENV === 'development') console.log(`[Scanner] from=${startBlock}, latest=${latestBlock}`);

      if (!silent) {
        const total = await getAnnouncementCount(provider, startBlock, latestBlock, config.contracts.announcer);
        setProgress({ current: 0, total });
      }

      const results = await scanAnnouncements(provider, stealthKeys, startBlock, latestBlock, config.contracts.announcer, chainId);

      // H2: Check if this scan was superseded before starting balance queries
      if (currentScanIdRef.current !== scanId) return;

      // Batch all balance queries via JsonRpcBatchProvider
      const tokens = getTokensForChain(chainId);
      const enriched: StealthPayment[] = await Promise.all(
        results.map(async (r) => {
          try {
            const addr = r.announcement.stealthAddress;
            const bal = await batchProvider.getBalance(addr);
            const balance = ethers.utils.formatEther(bal);

            // Historical balance requires archive RPC — only attempt on supported chains
            let originalAmount = balance;
            if (ARCHIVE_SUPPORTED.has(chainId)) {
              try {
                const historicalBal = await batchProvider.getBalance(addr, r.announcement.blockNumber);
                originalAmount = ethers.utils.formatEther(historicalBal);
              } catch {
                // Non-archive RPC: fall back to current balance
              }
            }

            // Fetch ERC-20 token balances
            let tokenBalances: TokenBalance[] | undefined;
            if (tokens.length > 0) {
              const balResults = await Promise.allSettled(
                tokens.map(async (t) => {
                  const erc20 = new ethers.Contract(t.address, ERC20_BALANCE_ABI, batchProvider);
                  const tokenBal: ethers.BigNumber = await erc20.balanceOf(addr);
                  return {
                    token: t.address,
                    symbol: t.symbol,
                    balance: ethers.utils.formatUnits(tokenBal, t.decimals),
                    decimals: t.decimals,
                  };
                })
              );
              // C2: Log rejected token balance queries instead of silently ignoring
              balResults.forEach((result, idx) => {
                if (result.status === 'rejected') {
                  console.warn(`[scanner] Token balance query failed for ${tokens[idx]?.symbol}:`, result.reason);
                }
              });
              const nonZero = balResults
                .filter((r): r is PromiseFulfilledResult<TokenBalance> => r.status === 'fulfilled')
                .map(r => r.value)
                .filter(b => parseFloat(b.balance) > 0);
              if (nonZero.length > 0) tokenBalances = nonZero;
            }

            const hasNativeBalance = parseFloat(balance) > 0;
            const hasTokenBalance = !!tokenBalances && tokenBalances.length > 0;

            return {
              ...r,
              balance,
              originalAmount,
              claimed: !hasNativeBalance && !hasTokenBalance,
              keyMismatch: r.privateKeyVerified === false,
              tokenBalances,
            };
          } catch {
            return {
              ...r,
              balance: '0',
              claimed: false,
              keyMismatch: r.privateKeyVerified === false,
            };
          }
        })
      );

      // H2: Check if this scan was superseded after balance queries completed
      if (currentScanIdRef.current !== scanId) return;

      // If all balance queries failed, rotate batch provider to next RPC
      if (results.length > 0 && enriched.every(p => !p.originalAmount && p.balance === '0')) {
        rotateBatchProvider(chainId);
      }

      // Store keys in ref, strip from state
      enriched.forEach(p => {
        if (p.stealthPrivateKey) {
          privateKeysRef.current.set(p.announcement.txHash, p.stealthPrivateKey);
        }
      });

      setPayments((prev) => {
        const existingMap = new Map(prev.map(p => [p.announcement.txHash, p]));

        enriched.forEach(p => {
          if (existingMap.has(p.announcement.txHash)) {
            const existing = existingMap.get(p.announcement.txHash)!;
            existingMap.set(p.announcement.txHash, {
              ...existing,
              balance: p.balance,
              originalAmount: existing.originalAmount || p.originalAmount,
              claimed: existing.claimed || p.claimed,
              tokenBalances: p.tokenBalances ?? existing.tokenBalances,
            });
          } else {
            existingMap.set(p.announcement.txHash, stripKey(p));
          }
        });

        return Array.from(existingMap.values());
      });

      // Auto-claim any unclaimed payments
      const allUnclaimed = enriched.filter(p =>
        !p.claimed && !p.keyMismatch && parseFloat(p.balance || '0') > 0
      );
      if (allUnclaimed.length > 0) {
        tryAutoClaim(allUnclaimed);
      }

      if (address) {
        saveLastScannedBlock(address, latestBlock, chainId);
      }

      if (!silent) {
        setProgress({ current: results.length, total: results.length });
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.error('[Scanner] Scan error:', e);
      if (!silent) setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      if (!silent) setIsScanning(false);
    }
  }, [stealthKeys, isConnected, address, chainId, tryAutoClaim]);

  const scanRef = useRef(scan);
  scanRef.current = scan;

  const scanInBackground = useCallback(() => {
    if (scanIntervalRef.current) return;
    scanRef.current();
    const interval = BG_SCAN_INTERVAL_MS[chainId] ?? DEFAULT_BG_SCAN_INTERVAL_MS;
    scanIntervalRef.current = setInterval(() => {
      if (!isBgScanningRef.current) {
        isBgScanningRef.current = true;
        scanRef.current(undefined, true).finally(() => { isBgScanningRef.current = false; });
      }
    }, interval);
  }, [chainId]);

  const stopBackgroundScan = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  }, []);

  // Keep claimPayment for manual fallback
  const claimPayment = useCallback(async (payment: StealthPayment, recipient: string): Promise<string | null> => {
    setError(null);

    try {
      // Inject key from ref
      const key = getKeyForPayment(payment.announcement.txHash);
      if (!key) {
        throw new Error('Private key not found for this payment');
      }
      const paymentWithKey = { ...payment, stealthPrivateKey: key };

      const result = await autoClaimPayment(paymentWithKey, recipient, chainId);
      if (!result) {
        throw new Error('Claim failed');
      }

      // Zeroize private key — no longer needed after successful drain
      privateKeysRef.current.delete(payment.announcement.txHash);

      setPayments(prev => prev.map(p =>
        p.announcement.txHash === payment.announcement.txHash ? { ...p, claimed: true, balance: '0' } : p
      ));

      return result.txHash;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Claim failed';
      setError(msg);
      return null;
    }
  }, [chainId]);

  // Directly deposit unclaimed payments to pool with progress reporting
  // Handles both normal deposits (drain + pool) and recovery (already drained, just pool deposit)
  const depositToPool = useCallback(async (
    onProgress: (done: number, total: number, message: string) => void
  ): Promise<{ deposited: number; skipped: number; failed: number }> => {
    if (!address) return { deposited: 0, skipped: 0, failed: 0 };

    // Snapshot keys at start to prevent race condition if wallet switches mid-deposit loop
    const keysSnapshot = new Map(privateKeysRef.current);

    // Include payments with balance > 0 (normal) OR near-zero balance with original amount (recovery)
    const candidates = payments.filter(p => {
      if (p.claimed || p.keyMismatch) return false;
      const bal = parseFloat(p.balance || '0');
      const orig = parseFloat(p.originalAmount || '0');
      return bal > 0.0001 || orig > 0.001;
    });

    const total = candidates.length;
    let deposited = 0;
    let skipped = 0;
    let failed = 0;

    if (total === 0) {
      onProgress(0, 0, 'No payments found for pool deposit');
      return { deposited: 0, skipped: 0, failed: 0 };
    }

    onProgress(0, total, `Preparing ${total} payments for pool deposit...`);

    for (let i = 0; i < candidates.length; i++) {
      const payment = candidates[i];
      const key = keysSnapshot.get(payment.announcement.txHash) || '';

      if (!key) {
        skipped++;
        onProgress(deposited, total, `Skipped ${i + 1}/${total} (no key)`);
        continue;
      }

      if (payment.walletType !== 'create2' && payment.walletType !== 'account' && payment.walletType !== 'eip7702') {
        skipped++;
        onProgress(deposited, total, `Skipped ${i + 1}/${total} (${payment.walletType} type)`);
        continue;
      }

      const currentBal = parseFloat(payment.balance || '0');
      const originalAmt = parseFloat(payment.originalAmount || '0');
      // Recovery: balance is near-zero but original was significant (drained but pool deposit failed)
      const isRecovery = currentBal < originalAmt * 0.1 && originalAmt > 0.001;

      if (isRecovery) {
        // Recovery: balance is near-zero but original was significant
        // These were previously drained to sponsor — skip (already lost privacy)
        skipped++;
        onProgress(deposited, total, `Skipped ${i + 1}/${total} (already drained)`);
        continue;
      }

      // Normal path: drain stealth wallet then deposit to pool
      const paymentWithKey = { ...payment, stealthPrivateKey: key };
      const amt = currentBal.toFixed(4);
      const symbol = getChainConfig(chainId).nativeCurrency.symbol;
      onProgress(deposited, total, `Depositing ${i + 1}/${total} (${amt} ${symbol})...`);

      const result = await claimToPoolDeposit(paymentWithKey, address, chainId);

      if (result) {
        deposited++;
        // Zeroize private key — no longer needed after successful pool deposit
        privateKeysRef.current.delete(payment.announcement.txHash);
        keysSnapshot.delete(payment.announcement.txHash);
        setPayments(prev => prev.map(p =>
          p.announcement.txHash === payment.announcement.txHash
            ? { ...p, claimed: true, balance: '0' }
            : p
        ));
        onProgress(deposited, total, `Deposited ${deposited}/${total}`);
      } else {
        failed++;
        onProgress(deposited, total, `Failed ${i + 1}/${total}, continuing...`);
      }
    }

    const msg = deposited > 0
      ? `Done! ${deposited} deposited${failed > 0 ? `, ${failed} failed` : ''}${skipped > 0 ? `, ${skipped} skipped` : ''}`
      : `No deposits completed (${failed} failed, ${skipped} skipped)`;
    onProgress(deposited, total, msg);

    return { deposited, skipped, failed };
  }, [address, payments, chainId]);

  // Sweep ERC-20 tokens from a stealth payment (CREATE2 wallets only)
  const claimTokens = useCallback(async (payment: StealthPayment, recipient: string): Promise<boolean> => {
    setError(null);
    try {
      const key = getKeyForPayment(payment.announcement.txHash);
      if (!key) throw new Error('Private key not found for this payment');
      const paymentWithKey = { ...payment, stealthPrivateKey: key };
      const result = await sweepTokensFromWallet(paymentWithKey, recipient, chainId);
      if (!result || result.swept.length === 0) return false;

      // Update tokenBalances to remove swept tokens
      const fullyClaimedAfterSweep = parseFloat(payment.balance || '0') === 0 &&
        result.swept.length === (payment.tokenBalances ?? []).length;
      if (fullyClaimedAfterSweep) {
        // Zeroize private key — no tokens or native balance remain
        privateKeysRef.current.delete(payment.announcement.txHash);
      }
      setPayments(prev => prev.map(p => {
        if (p.announcement.txHash !== payment.announcement.txHash) return p;
        const sweptAddrs = new Set(result.swept.map(s => s.token.toLowerCase()));
        const remaining = (p.tokenBalances ?? []).filter(
          tb => !sweptAddrs.has(tb.token.toLowerCase())
        );
        return {
          ...p,
          tokenBalances: remaining.length > 0 ? remaining : undefined,
          claimed: parseFloat(p.balance || '0') === 0 && remaining.length === 0,
        };
      }));

      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Token sweep failed';
      setError(msg);
      return false;
    }
  }, [chainId]);

  const keysAvailable = privateKeysRef.current.size;

  return { payments, scan, scanInBackground, stopBackgroundScan, claimPayment, claimTokens, depositToPool, isScanning, progress, error, keysAvailable };
}
