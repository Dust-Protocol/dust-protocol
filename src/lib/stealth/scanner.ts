// Announcement scanner (ERC-5564)

import { ethers } from 'ethers';
import { ec as EC } from 'elliptic';
import type { StealthAnnouncement, ScanResult, StealthKeyPair } from './types';
import { SCHEME_ID, CANONICAL_ADDRESSES } from './types';
import { computeViewTag, verifyStealthAddress, computeStealthPrivateKey, getAddressFromPrivateKey, computeStealthWalletAddress, computeStealthAccountAddress, computeLegacyStealthWalletAddress, computeLegacyStealthAccountAddress } from './address';
import { getChainConfig } from '@/config/chains';

const secp256k1 = new EC('secp256k1');

// L2s produce blocks faster — larger ranges are needed and supported by their RPCs
const BLOCK_RANGE_BY_CHAIN: Record<number, number> = {
  11155111: 9_999,     // Eth Sepolia (drpc.org limit)
  111551119090: 9_999, // Thanos Sepolia
  421614: 100_000,     // Arbitrum Sepolia (~0.25s blocks)
  11155420: 50_000,    // OP Sepolia (2s blocks)
  84532: 50_000,       // Base Sepolia (2s blocks)
  545: 50_000,         // Flow EVM Testnet (~1s blocks)
};
const DEFAULT_BLOCK_RANGE = 9_999;

function getMaxBlockRange(chainId?: number): number {
  if (!chainId) return DEFAULT_BLOCK_RANGE;
  return BLOCK_RANGE_BY_CHAIN[chainId] ?? DEFAULT_BLOCK_RANGE;
}

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

async function queryWithRetry(
  contract: ethers.Contract,
  filter: ethers.EventFilter,
  from: number,
  to: number,
): Promise<ethers.Event[]> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await contract.queryFilter(filter, from, to);
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      const delay = BASE_BACKOFF_MS * 2 ** attempt;
      console.warn(`[Scanner] queryFilter failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return []; // unreachable
}

async function chunkedQueryFilter(
  contract: ethers.Contract,
  filter: ethers.EventFilter,
  from: number,
  to: number,
  chainId?: number,
): Promise<ethers.Event[]> {
  const maxRange = getMaxBlockRange(chainId);
  if (to - from <= maxRange) {
    return queryWithRetry(contract, filter, from, to);
  }
  const allEvents: ethers.Event[] = [];
  for (let start = from; start <= to; start += maxRange + 1) {
    const end = Math.min(start + maxRange, to);
    const events = await queryWithRetry(contract, filter, start, end);
    allEvents.push(...events);
  }
  return allEvents;
}

// Constant-time string comparison to prevent timing side-channels on view tags
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

const ANNOUNCER_ABI = [
  'event Announcement(uint256 indexed schemeId, address indexed stealthAddress, address indexed caller, bytes ephemeralPubKey, bytes metadata)',
];

function parseLinkSlugFromMetadata(metadata: string): string | undefined {
  // Metadata format: 0x{viewTag 2 hex chars}{linkSlug hex-encoded UTF-8}
  if (!metadata || metadata.length <= 4) return undefined;
  const slugHex = metadata.slice(4);
  if (!slugHex) return undefined;
  try {
    const bytes: number[] = [];
    for (let i = 0; i < slugHex.length; i += 2) {
      bytes.push(parseInt(slugHex.substring(i, i + 2), 16));
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch {
    return undefined;
  }
}

function parseEvent(event: ethers.Event, schemeId: number): StealthAnnouncement | null {
  if (!event.args) return null;

  const ephemeralPubKey = event.args.ephemeralPubKey as string;
  const metadata = event.args.metadata as string;
  const viewTag = metadata?.length >= 4 ? metadata.slice(2, 4) : '';
  const linkSlug = parseLinkSlugFromMetadata(metadata);

  return {
    schemeId,
    stealthAddress: event.args.stealthAddress,
    ephemeralPublicKey: ephemeralPubKey.replace(/^0x/, ''),
    viewTag,
    metadata,
    linkSlug,
    caller: event.args.caller,
    blockNumber: event.blockNumber,
    txHash: event.transactionHash,
  };
}

/**
 * @param announcerAddress Defaults to Eth Sepolia announcer. Callers MUST pass
 *   the chain-specific announcer from getChainConfig(chainId) for non-Sepolia chains.
 */
export async function scanAnnouncements(
  provider: ethers.providers.Provider,
  keys: StealthKeyPair,
  fromBlock: number,
  toBlock?: number | 'latest',
  announcerAddress = CANONICAL_ADDRESSES.announcer,
  chainId?: number,
): Promise<ScanResult[]> {
  // Guard: default announcer is Eth Sepolia — silently returns 0 results on other chains
  if (chainId && chainId !== 11155111 && announcerAddress === CANONICAL_ADDRESSES.announcer) {
    console.warn(`[scanner] scanAnnouncements: using default Eth Sepolia announcer on chain ${chainId} — pass chain-specific announcer`);
  }
  // Verify key consistency
  const derived = secp256k1.keyFromPrivate(keys.spendingPrivateKey.replace(/^0x/, ''), 'hex');
  if (derived.getPublic(true, 'hex') !== keys.spendingPublicKey) {
    throw new Error('Spending key mismatch - keys may be corrupted');
  }

  const announcer = new ethers.Contract(announcerAddress, ANNOUNCER_ABI, provider);
  const filter = announcer.filters.Announcement(SCHEME_ID.SECP256K1, null, null);
  const resolvedTo = toBlock === 'latest' || toBlock === undefined
    ? await provider.getBlockNumber()
    : toBlock;
  const events = await chunkedQueryFilter(announcer, filter, fromBlock, resolvedTo, chainId);

  const results: ScanResult[] = [];

  if (process.env.NODE_ENV === 'development') console.log(`[Scanner] Found ${events.length} announcements from ${fromBlock}`);

  let viewTagFiltered = 0;
  let ecdhFiltered = 0;

  for (const event of events) {
    const announcement = parseEvent(event, SCHEME_ID.SECP256K1);
    if (!announcement) continue;

    const expectedTag = computeViewTag(keys.viewingPrivateKey, announcement.ephemeralPublicKey);
    if (announcement.viewTag && !constantTimeEqual(announcement.viewTag, expectedTag)) {
      viewTagFiltered++;
      continue;
    }

    // Derive stealth private key and EOA address from ECDH
    const stealthPrivateKey = computeStealthPrivateKey(
      keys.spendingPrivateKey,
      keys.viewingPrivateKey,
      announcement.ephemeralPublicKey
    );
    const derivedEOA = getAddressFromPrivateKey(stealthPrivateKey);

    // Check EOA match (legacy), CREATE2 wallet match, and ERC-4337 account match
    // Must check both current and legacy factory addresses for backward compat
    const announcedAddr = announcement.stealthAddress.toLowerCase();
    const eoaMatch = derivedEOA.toLowerCase() === announcedAddr;
    let create2Match = false;
    let accountMatch = false;
    if (!eoaMatch) {
      const create2Addr = computeStealthWalletAddress(derivedEOA, chainId);
      create2Match = create2Addr.toLowerCase() === announcedAddr;
      if (!create2Match) {
        const legacyCreate2Addr = computeLegacyStealthWalletAddress(derivedEOA, chainId);
        create2Match = legacyCreate2Addr.toLowerCase() === announcedAddr;
      }
    }
    if (!eoaMatch && !create2Match) {
      const accountAddr = computeStealthAccountAddress(derivedEOA, chainId);
      accountMatch = accountAddr.toLowerCase() === announcedAddr;
      if (!accountMatch) {
        const legacyAccountAddr = computeLegacyStealthAccountAddress(derivedEOA, chainId);
        accountMatch = legacyAccountAddr.toLowerCase() === announcedAddr;
      }
    }

    const isMatch = eoaMatch || create2Match || accountMatch;

    if (!isMatch) {
      ecdhFiltered++;
    }

    if (isMatch) {
      // On 7702-capable chains, EOA matches are eip7702 (delegation target exists)
      const is7702Chain = (() => {
        try {
          const cfg = chainId !== undefined ? getChainConfig(chainId) : null;
          return cfg?.supportsEIP7702 && !!cfg.contracts.subAccount7702;
        } catch { return false; }
      })();

      // Decode token metadata from announcement if present
      // Format: viewTag (1 byte) + optional ['T' marker (1 byte) + chainId (4 bytes big-endian) + tokenAddress (20 bytes) + amount (variable)]
      let announcedTokenAddress: string | null = null;
      let announcedTokenAmount: string | null = null;
      let announcedChainId: number | null = null;

      const metadata = announcement.metadata;
      if (metadata && metadata.length > 4) { // more than just '0x' + viewTag
        const metaHex = metadata.slice(2); // remove '0x'
        const viewTagLen = 2; // 1 byte = 2 hex chars
        const rest = metaHex.slice(viewTagLen);

        // Check for 'T' marker (0x54 = 'T' in ASCII)
        if (rest.startsWith('54') && rest.length >= 2 + 8 + 40) { // 'T' + 4-byte chainId + 20-byte address
          // New format with chainId: T + chainId (4 bytes) + tokenAddress (20 bytes) + amount
          announcedChainId = parseInt(rest.slice(2, 10), 16) || null;
          announcedTokenAddress = '0x' + rest.slice(10, 50);
          if (rest.length > 50) {
            announcedTokenAmount = rest.slice(50); // remaining hex is the amount
          }
        } else if (rest.startsWith('54') && rest.length >= 2 + 40) { // Legacy: 'T' + 20-byte address (no chainId)
          announcedTokenAddress = '0x' + rest.slice(2, 42);
          if (rest.length > 42) {
            announcedTokenAmount = rest.slice(42); // remaining hex is the amount
          }
        }
      }

      results.push({
        announcement,
        stealthPrivateKey,
        isMatch: true,
        privateKeyVerified: true,
        walletType: accountMatch ? 'account' : create2Match ? 'create2' : (eoaMatch && is7702Chain) ? 'eip7702' : 'eoa',
        announcedTokenAddress,
        announcedTokenAmount,
        announcedChainId,
      });
    }
  }

  if (process.env.NODE_ENV === 'development') console.log(`[Scanner] ${results.length} matches, ${viewTagFiltered} tag-filtered, ${ecdhFiltered} ECDH-filtered`);
  return results;
}

/**
 * @param announcerAddress Defaults to Eth Sepolia announcer. Callers MUST pass
 *   the chain-specific announcer from getChainConfig(chainId) for non-Sepolia chains.
 */
export async function scanAnnouncementsViewOnly(
  provider: ethers.providers.Provider,
  viewingPrivateKey: string,
  spendingPublicKey: string,
  fromBlock: number,
  toBlock?: number | 'latest',
  announcerAddress = CANONICAL_ADDRESSES.announcer,
  chainId?: number,
): Promise<StealthAnnouncement[]> {
  if (chainId && chainId !== 11155111 && announcerAddress === CANONICAL_ADDRESSES.announcer) {
    console.warn(`[scanner] scanAnnouncementsViewOnly: using default Eth Sepolia announcer on chain ${chainId} — pass chain-specific announcer`);
  }
  const announcer = new ethers.Contract(announcerAddress, ANNOUNCER_ABI, provider);
  const filter = announcer.filters.Announcement(SCHEME_ID.SECP256K1, null, null);
  const resolvedTo = toBlock === 'latest' || toBlock === undefined
    ? await provider.getBlockNumber()
    : toBlock;
  const events = await chunkedQueryFilter(announcer, filter, fromBlock, resolvedTo, chainId);

  const matches: StealthAnnouncement[] = [];

  for (const event of events) {
    const announcement = parseEvent(event, SCHEME_ID.SECP256K1);
    if (!announcement) continue;

    const expectedTag = computeViewTag(viewingPrivateKey, announcement.ephemeralPublicKey);
    if (announcement.viewTag && !constantTimeEqual(announcement.viewTag, expectedTag)) continue;

    // Check EOA match (legacy)
    if (verifyStealthAddress(announcement.ephemeralPublicKey, spendingPublicKey, announcement.stealthAddress, viewingPrivateKey)) {
      matches.push(announcement);
      continue;
    }
    // Check CREATE2 match (new) — derive the EOA, then compute CREATE2 address
    const eoaAddr = (() => {
      try {
        const ec = secp256k1;
        const sharedSecret = (() => {
          const priv = ec.keyFromPrivate(viewingPrivateKey.replace(/^0x/, ''), 'hex');
          const pub = ec.keyFromPublic(announcement.ephemeralPublicKey.replace(/^0x/, ''), 'hex');
          return priv.derive(pub.getPublic()).toString('hex').padStart(64, '0');
        })();
        const secretHash = ethers.utils.keccak256('0x' + sharedSecret);
        const spendKey = ec.keyFromPublic(spendingPublicKey.replace(/^0x/, ''), 'hex');
        const hashKey = ec.keyFromPrivate(secretHash.slice(2), 'hex');
        const stealthPub = spendKey.getPublic().add(hashKey.getPublic());
        const uncompressed = stealthPub.encode('hex', false).slice(2);
        const hash = ethers.utils.keccak256('0x' + uncompressed);
        return ethers.utils.getAddress('0x' + hash.slice(-40));
      } catch { return null; }
    })();
    if (eoaAddr) {
      const addr = announcement.stealthAddress.toLowerCase();
      if (computeStealthWalletAddress(eoaAddr, chainId).toLowerCase() === addr
        || computeLegacyStealthWalletAddress(eoaAddr, chainId).toLowerCase() === addr) {
        matches.push(announcement);
        continue;
      }
      if (computeStealthAccountAddress(eoaAddr, chainId).toLowerCase() === addr
        || computeLegacyStealthAccountAddress(eoaAddr, chainId).toLowerCase() === addr) {
        matches.push(announcement);
      }
    }
  }

  return matches;
}

import { storageKey, migrateKey } from '@/lib/storageKey';

function lastScannedKey(address: string, chainId: number): string {
  return storageKey('scanner', address, chainId);
}

export function getLastScannedBlock(address: string, chainId: number): number | null {
  if (typeof window === 'undefined') return null;
  migrateKey('stealth_last_scanned_' + address.toLowerCase(), lastScannedKey(address, chainId));
  const val = localStorage.getItem(lastScannedKey(address, chainId));
  return val ? parseInt(val, 10) : null;
}

export function setLastScannedBlock(address: string, block: number, chainId: number): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(lastScannedKey(address, chainId), block.toString());
  }
}

/**
 * @param announcerAddress Defaults to Eth Sepolia announcer. Callers MUST pass
 *   the chain-specific announcer from getChainConfig(chainId) for non-Sepolia chains.
 */
export async function getAnnouncementCount(
  provider: ethers.providers.Provider,
  fromBlock: number,
  toBlock?: number | 'latest',
  announcerAddress = CANONICAL_ADDRESSES.announcer,
  chainId?: number,
): Promise<number> {
  const announcer = new ethers.Contract(announcerAddress, ANNOUNCER_ABI, provider);
  const filter = announcer.filters.Announcement(SCHEME_ID.SECP256K1, null, null);
  const resolvedTo = toBlock === 'latest' || toBlock === undefined
    ? await provider.getBlockNumber()
    : toBlock;
  const events = await chunkedQueryFilter(announcer, filter, fromBlock, resolvedTo, chainId);
  return events.length;
}
