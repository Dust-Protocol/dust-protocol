// HD wallet derivation for claim addresses

import { ethers } from 'ethers';
import { deriveClaimSeed, deriveClaimSeedV0 } from './pin';
import { getKeyVersion } from './keys';

export interface DerivedClaimAddress {
  address: string;
  privateKey: string;
  path: string;
  index: number;
  label?: string;
}

export const CLAIM_ADDRESS_DERIVATION_MESSAGE =
  'Sign this message to derive your stealth claim addresses.\n\n' +
  'This creates fresh addresses that cannot be linked to your main wallet.\n\n' +
  'Domain: Dust Protocol\n' +
  'Purpose: Claim Address Derivation\n' +
  'Version: 1';

export function deriveSeedFromSignature(signature: string): string {
  return ethers.utils.keccak256(signature);
}

export function deriveClaimAddressAtIndex(seed: string, index: number): DerivedClaimAddress {
  const data = ethers.utils.solidityPack(['bytes32', 'string', 'uint256'], [seed, 'stealth/claim/', index]);
  const privateKey = ethers.utils.keccak256(data);
  const wallet = new ethers.Wallet(privateKey);

  return {
    address: wallet.address,
    privateKey: privateKey.slice(2),
    path: `stealth/${index}`,
    index,
  };
}

export function deriveClaimAddresses(signature: string, count: number): DerivedClaimAddress[] {
  const seed = deriveSeedFromSignature(signature);
  return Array.from({ length: count }, (_, i) => deriveClaimAddressAtIndex(seed, i));
}

export async function deriveSeedFromSignatureAndPin(signature: string, pin: string, walletAddress?: string): Promise<string> {
  const version = getKeyVersion(walletAddress);
  if (version === 0) {
    return '0x' + deriveClaimSeedV0(signature, pin);
  }
  return '0x' + await deriveClaimSeed(signature, pin);
}

export async function deriveClaimAddressesWithPin(signature: string, pin: string, count: number, walletAddress?: string): Promise<DerivedClaimAddress[]> {
  const seed = await deriveSeedFromSignatureAndPin(signature, pin, walletAddress);
  return Array.from({ length: count }, (_, i) => deriveClaimAddressAtIndex(seed, i));
}

export function getNextClaimAddress(signature: string, usedAddresses: string[]): DerivedClaimAddress {
  const seed = deriveSeedFromSignature(signature);
  const used = new Set(usedAddresses.map(a => a.toLowerCase()));

  for (let i = 0; i < 1000; i++) {
    const derived = deriveClaimAddressAtIndex(seed, i);
    if (!used.has(derived.address.toLowerCase())) return derived;
  }

  throw new Error('Too many claim addresses derived');
}

export function verifyClaimAddressDerivation(signature: string, address: string, maxIndex = 100): number {
  const seed = deriveSeedFromSignature(signature);
  const normalized = address.toLowerCase();

  for (let i = 0; i < maxIndex; i++) {
    if (deriveClaimAddressAtIndex(seed, i).address.toLowerCase() === normalized) return i;
  }

  return -1;
}

// Storage helpers — keys are hashed to avoid fingerprinting the wallet address
import { storageKey, migrateKey } from '@/lib/storageKey';

function claimAddrsKey(walletAddress: string): string {
  return storageKey('hdwallet', walletAddress);
}

function claimSigKey(walletAddress: string): string {
  return storageKey('hdwalletsig', walletAddress);
}

export function saveClaimAddressesToStorage(walletAddress: string, addresses: DerivedClaimAddress[]): void {
  if (typeof window === 'undefined') return;
  const data = addresses.map(({ address, path, index, label }) => ({ address, path, index, label }));
  localStorage.setItem(claimAddrsKey(walletAddress), JSON.stringify(data));
}

export function loadClaimAddressesFromStorage(walletAddress: string): Array<{ address: string; path: string; index: number; label?: string }> {
  if (typeof window === 'undefined') return [];
  migrateKey('stealth_claim_addresses_' + walletAddress.toLowerCase(), claimAddrsKey(walletAddress));
  try {
    const stored = localStorage.getItem(claimAddrsKey(walletAddress));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveSignatureHash(walletAddress: string, signature: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(claimSigKey(walletAddress), ethers.utils.keccak256(signature));
  }
}

export function verifySignatureHash(walletAddress: string, signature: string): boolean {
  if (typeof window === 'undefined') return false;
  migrateKey('stealth_claim_signature_' + walletAddress.toLowerCase(), claimSigKey(walletAddress));
  const stored = localStorage.getItem(claimSigKey(walletAddress));
  return !stored || stored === ethers.utils.keccak256(signature);
}

export function updateClaimAddressLabel(walletAddress: string, targetAddress: string, newLabel: string): void {
  const addresses = loadClaimAddressesFromStorage(walletAddress);
  const updated = addresses.map(a =>
    a.address.toLowerCase() === targetAddress.toLowerCase() ? { ...a, label: newLabel } : a
  );
  localStorage.setItem(claimAddrsKey(walletAddress), JSON.stringify(updated));
}
