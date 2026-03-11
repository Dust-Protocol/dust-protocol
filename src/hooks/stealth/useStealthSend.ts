import { useState, useCallback, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import {
  generateStealthAddress, parseStealthMetaAddress, lookupStealthMetaAddress,
  getRegistryForChain, SCHEME_ID, type GeneratedStealthAddress,
} from '@/lib/stealth';
import type { OutgoingPayment } from '@/lib/design/types';
import { getChainConfig, DEFAULT_CHAIN_ID } from '@/config/chains';
import { getChainProvider } from '@/lib/providers';

// Flow EVM RPC reports ~1.5 gwei but rejects below ~16 gwei
const MIN_GAS_PRICE: Record<number, ethers.BigNumber> = {
  545: ethers.utils.parseUnits('100', 'gwei'),
};
import { useAuth } from '@/contexts/AuthContext';

import { storageKey, migrateKey } from '@/lib/storageKey';

function outgoingKey(senderAddress: string, chainId: number): string {
  return storageKey('sends', senderAddress, chainId);
}

function saveOutgoingPayment(senderAddress: string, chainId: number, payment: OutgoingPayment) {
  if (typeof window === 'undefined') return;
  const key = outgoingKey(senderAddress, chainId);
  const existing: OutgoingPayment[] = JSON.parse(localStorage.getItem(key) || '[]');
  existing.unshift(payment);
  // Keep last 100
  localStorage.setItem(key, JSON.stringify(existing.slice(0, 100)));
}

export function loadOutgoingPayments(senderAddress: string, chainId?: number): OutgoingPayment[] {
  if (typeof window === 'undefined') return [];
  const cid = chainId ?? DEFAULT_CHAIN_ID;
  migrateKey(`dust_outgoing_payments_${cid}_${senderAddress.toLowerCase()}`, outgoingKey(senderAddress, cid));
  const key = outgoingKey(senderAddress, cid);
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

const ANNOUNCER_ABI = [
  'function announce(uint256 schemeId, address stealthAddress, bytes calldata ephemeralPubKey, bytes calldata metadata) external',
];

/** Switch MetaMask to the target chain, adding it if needed */
async function ensureChain(chainId: number): Promise<void> {
  if (typeof window === 'undefined' || !window.ethereum) return;
  const config = getChainConfig(chainId);
  const chainIdHex = '0x' + chainId.toString(16);
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: chainIdHex,
          chainName: config.name,
          nativeCurrency: config.nativeCurrency,
          rpcUrls: [config.rpcUrl],
          blockExplorerUrls: [config.blockExplorerUrl],
        }],
      });
    } else {
      throw err;
    }
  }
}

// Estimate gas cost for ETH transfer only (21k gas)
async function estimateEthTransferGasCost(provider: ethers.providers.Provider, chainId: number): Promise<ethers.BigNumber> {
  const config = getChainConfig(chainId);
  const feeData = await provider.getFeeData();
  const gasLimit = ethers.BigNumber.from(21000);

  if (!config.supportsEIP1559) {
    const rpcGasPrice = feeData.gasPrice || ethers.utils.parseUnits('1', 'gwei');
    const minPrice = MIN_GAS_PRICE[chainId];
    const gasPrice = minPrice && minPrice.gt(rpcGasPrice) ? minPrice : rpcGasPrice;
    const baseCost = gasLimit.mul(gasPrice);
    return baseCost.add(baseCost.mul(5).div(100));
  }

  const block = await provider.getBlock('latest');
  const baseFee = block.baseFeePerGas || feeData.gasPrice || ethers.utils.parseUnits('1', 'gwei');
  const priorityFee = feeData.maxPriorityFeePerGas || ethers.utils.parseUnits('1.5', 'gwei');
  const twoXBaseFee = baseFee.mul(2);
  const basePlusPriority = baseFee.add(priorityFee).mul(12).div(10);
  const maxFeePerGas = twoXBaseFee.gt(basePlusPriority) ? twoXBaseFee : basePlusPriority;

  const baseCost = gasLimit.mul(maxFeePerGas);
  return baseCost.add(baseCost.mul(5).div(100));
}

// Sponsor the announcement via deployer API (sender doesn't pay gas for this)
async function sponsorAnnounce(
  stealthAddress: string,
  ephemeralPubKey: string,
  metadata: string,
  chainId?: number,
): Promise<string> {
  const res = await fetch('/api/sponsor-announce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stealthAddress, ephemeralPubKey, metadata, chainId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Sponsored announcement failed');
  return data.txHash;
}

// Calculate maximum sendable amount (balance - gas for ETH transfer only; announcement is sponsored)
async function calculateMaxSendable(
  provider: ethers.providers.Provider,
  address: string,
  chainId: number,
): Promise<{ maxAmount: ethers.BigNumber; gasCost: ethers.BigNumber; balance: ethers.BigNumber }> {
  const balance = await provider.getBalance(address);
  const gasCost = await estimateEthTransferGasCost(provider, chainId);
  const maxAmount = balance.sub(gasCost);
  return { maxAmount: maxAmount.gt(0) ? maxAmount : ethers.BigNumber.from(0), gasCost, balance };
}

// Validate amount against balance and gas
function validateSendAmount(
  amount: string,
  balance: ethers.BigNumber,
  gasCost: ethers.BigNumber,
  symbol = 'ETH',
): { valid: boolean; error?: string } {
  if (!amount || amount.trim() === '') {
    return { valid: false, error: 'Amount is required' };
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return { valid: false, error: 'Invalid amount' };
  }

  // Check decimals
  const parts = amount.split('.');
  if (parts[1] && parts[1].length > 18) {
    return { valid: false, error: 'Too many decimal places (max 18)' };
  }

  try {
    const amountWei = ethers.utils.parseEther(amount);
    const totalNeeded = amountWei.add(gasCost);

    if (balance.lt(totalNeeded)) {
      const maxSendable = balance.sub(gasCost);
      if (maxSendable.lte(0)) {
        return { valid: false, error: `Insufficient balance for gas (~${ethers.utils.formatEther(gasCost)} ${symbol} needed)` };
      }
      return {
        valid: false,
        error: `Insufficient balance. Max sendable: ${parseFloat(ethers.utils.formatEther(maxSendable)).toFixed(6)} ${symbol}`
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid amount format' };
  }
}


export function useStealthSend(chainId?: number) {
  const { activeChainId: authChainId } = useAuth();
  const activeChainId = chainId ?? authChainId;
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [lastGeneratedAddress, setLastGeneratedAddress] = useState<GeneratedStealthAddress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendingRef = useRef(false);

  const generateAddressFor = useCallback((metaAddress: string): GeneratedStealthAddress | null => {
    setError(null);
    try {
      const parsed = parseStealthMetaAddress(metaAddress);
      const generated = generateStealthAddress(parsed, activeChainId);
      setLastGeneratedAddress(generated);
      return generated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate address');
      return null;
    }
  }, [activeChainId]);

  const generateAddressForAddress = useCallback(async (recipientAddress: string): Promise<GeneratedStealthAddress | null> => {
    setError(null);
    setIsLoading(true);
    try {
      const provider = getChainProvider(activeChainId);
      const metaBytes = await lookupStealthMetaAddress(provider, recipientAddress, SCHEME_ID.SECP256K1, getRegistryForChain(activeChainId));
      if (!metaBytes) throw new Error('Recipient has no registered stealth address');

      const uri = `st:thanos:0x${metaBytes.replace(/^0x/, '')}`;
      const parsed = parseStealthMetaAddress(uri);
      const generated = generateStealthAddress(parsed, activeChainId);
      setLastGeneratedAddress(generated);
      return generated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate address');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [activeChainId]);

  // Get maximum sendable amount (exposed for UI "Max" button)
  const getMaxSendable = useCallback(async (): Promise<string | null> => {
    if (!isConnected || !walletClient) return null;
    try {
      const provider = new ethers.providers.Web3Provider(walletClient.transport);
      const address = await provider.getSigner().getAddress();

      const rpcProvider = getChainProvider(activeChainId);
      const { maxAmount } = await calculateMaxSendable(rpcProvider, address, activeChainId);

      if (maxAmount.lte(0)) return '0';
      return ethers.utils.formatEther(maxAmount);
    } catch {
      return null;
    }
  }, [activeChainId, isConnected, walletClient]);

  const sendEthToStealth = useCallback(async (metaAddress: string, amount: string, linkSlug?: string): Promise<string | null> => {
    if (!isConnected) { setError('Wallet not connected'); return null; }
    if (sendingRef.current) return null;
    sendingRef.current = true;
    setError(null);
    setIsLoading(true);

    const config = getChainConfig(activeChainId);

    try {
      if (!walletClient) throw new Error('Wallet not ready — please try again');
      await ensureChain(activeChainId);
      const provider = new ethers.providers.Web3Provider(walletClient.transport);
      const signer = provider.getSigner();
      const signerAddress = await signer.getAddress();

      // Use direct RPC for reliable balance/gas data
      const rpcProvider = getChainProvider(activeChainId);

      // Validate balance and gas BEFORE generating address
      const { balance, gasCost } = await calculateMaxSendable(rpcProvider, signerAddress, activeChainId);
      const validation = validateSendAmount(amount, balance, gasCost, config.nativeCurrency.symbol);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Generate stealth address
      const generated = generateAddressFor(metaAddress);
      if (!generated) throw new Error('Failed to generate stealth address');

      // Build gas parameters — legacy (type 0) for chains that reject EIP-1559
      const feeData = await rpcProvider.getFeeData();
      let txOverrides: ethers.providers.TransactionRequest;

      if (!config.supportsEIP1559) {
        const rpcGasPrice = feeData.gasPrice || ethers.utils.parseUnits('1', 'gwei');
        const minPrice = MIN_GAS_PRICE[activeChainId];
        const gasPrice = minPrice && minPrice.gt(rpcGasPrice) ? minPrice : rpcGasPrice;
        txOverrides = { gasLimit: 21000, gasPrice, type: 0 };
      } else {
        const block = await rpcProvider.getBlock('latest');
        const baseFee = block.baseFeePerGas || feeData.gasPrice || ethers.utils.parseUnits('1', 'gwei');
        const priorityFee = feeData.maxPriorityFeePerGas || ethers.utils.parseUnits('1', 'gwei');
        const twoXBaseFee = baseFee.mul(2);
        const basePlusPriority = baseFee.add(priorityFee).mul(12).div(10);
        const maxFeePerGas = twoXBaseFee.gt(basePlusPriority) ? twoXBaseFee : basePlusPriority;
        txOverrides = { gasLimit: 21000, maxFeePerGas, maxPriorityFeePerGas: priorityFee, type: 2 };
      }

      const tx = await signer.sendTransaction({
        to: generated.stealthAddress,
        value: ethers.utils.parseEther(amount),
        ...txOverrides,
      });
      const receipt = await tx.wait();
      const sendTxHash = receipt.transactionHash;

      // Announce via sponsored API (deployer pays gas, not sender) — fire-and-forget
      // The ETH is already on-chain; announce is background infrastructure for recipient scanning
      const ephPubKey = '0x' + generated.ephemeralPublicKey.replace(/^0x/, '');
      let metadata = '0x' + generated.viewTag;
      if (linkSlug) {
        const slugBytes = new TextEncoder().encode(linkSlug);
        const slugHex = Array.from(slugBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        metadata += slugHex;
      }
      sponsorAnnounce(generated.stealthAddress, ephPubKey, metadata, activeChainId)
        .catch(err => console.warn('Sponsored announcement failed (non-fatal):', err));

      // Persist outgoing payment for Activities
      saveOutgoingPayment(signerAddress, activeChainId, {
        txHash: sendTxHash,
        to: linkSlug || metaAddress.slice(0, 20),
        amount,
        timestamp: Date.now(),
        stealthAddress: generated.stealthAddress,
      });

      return sendTxHash;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send';
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
      sendingRef.current = false;
    }
  }, [isConnected, activeChainId, walletClient, generateAddressFor]);

  const sendTokenToStealth = useCallback(async (metaAddress: string, tokenAddress: string, amount: string): Promise<string | null> => {
    if (!isConnected) { setError('Wallet not connected'); return null; }
    if (sendingRef.current) return null;
    sendingRef.current = true;
    setError(null);
    setIsLoading(true);

    const config = getChainConfig(activeChainId);

    try {
      if (!walletClient) throw new Error('Wallet not ready — please try again');
      await ensureChain(activeChainId);
      const provider = new ethers.providers.Web3Provider(walletClient.transport);
      const signer = provider.getSigner();
      const signerAddress = await signer.getAddress();

      const rpcProvider = getChainProvider(activeChainId);
      const ethBalance = await rpcProvider.getBalance(signerAddress);
      const gasCost = await estimateEthTransferGasCost(rpcProvider, activeChainId);

      if (ethBalance.lt(gasCost)) {
        throw new Error(`Insufficient balance for gas. Need ~${ethers.utils.formatEther(gasCost)} ${config.nativeCurrency.symbol}`);
      }

      const erc20 = new ethers.Contract(tokenAddress, [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)',
        'function balanceOf(address) view returns (uint256)',
      ], signer);

      // Check token balance
      const decimals = await erc20.decimals();
      const amountWei = ethers.utils.parseUnits(amount, decimals);
      const tokenBalance = await erc20.balanceOf(signerAddress);

      if (tokenBalance.lt(amountWei)) {
        throw new Error(`Insufficient token balance. Have ${ethers.utils.formatUnits(tokenBalance, decimals)}, need ${amount}`);
      }

      const generated = generateAddressFor(metaAddress);
      if (!generated) throw new Error('Failed to generate stealth address');

      const tx = await erc20.transfer(generated.stealthAddress, amountWei);
      const receipt = await tx.wait();
      const sendTxHash = receipt.transactionHash;

      // Announce via sponsored API (deployer pays gas) — fire-and-forget
      // H1: Encode token info in metadata: viewTag + 'T' marker + chainId (4 bytes big-endian) + token address (20 bytes) + amount (32 bytes)
      const ephPubKey2 = '0x' + generated.ephemeralPublicKey.replace(/^0x/, '');
      const tokenAddrHex = tokenAddress.replace(/^0x/, '').toLowerCase();
      const amountHex = amountWei.toHexString().replace(/^0x/, '').padStart(64, '0');
      const chainIdHex = activeChainId.toString(16).padStart(8, '0');
      const tokenMetadata = '0x' + generated.viewTag + '54' + chainIdHex + tokenAddrHex + amountHex; // 0x54 = 'T'
      sponsorAnnounce(generated.stealthAddress, ephPubKey2, tokenMetadata, activeChainId)
        .catch(err => console.warn('Sponsored announcement failed (non-fatal):', err));

      // Persist outgoing payment for Activities
      saveOutgoingPayment(signerAddress, activeChainId, {
        txHash: sendTxHash,
        to: metaAddress.slice(0, 20),
        amount,
        timestamp: Date.now(),
        stealthAddress: generated.stealthAddress,
      });

      return sendTxHash;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send token');
      return null;
    } finally {
      setIsLoading(false);
      sendingRef.current = false;
    }
  }, [isConnected, activeChainId, walletClient, generateAddressFor]);

  const announcePayment = useCallback(async (stealthAddress: string, ephemeralPublicKey: string, viewTag: string): Promise<string | null> => {
    if (!isConnected) { setError('Wallet not connected'); return null; }
    setError(null);
    setIsLoading(true);

    try {
      if (!walletClient) throw new Error('Wallet not ready — please try again');
      const config = getChainConfig(activeChainId);
      const provider = new ethers.providers.Web3Provider(walletClient.transport);
      const signer = provider.getSigner();

      const announcer = new ethers.Contract(config.contracts.announcer, ANNOUNCER_ABI, signer);
      const tx = await announcer.announce(SCHEME_ID.SECP256K1, stealthAddress, '0x' + ephemeralPublicKey.replace(/^0x/, ''), '0x' + viewTag);
      const receipt = await tx.wait();
      return receipt.transactionHash;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to announce');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, activeChainId, walletClient]);

  return {
    generateAddressFor,
    generateAddressForAddress,
    sendEthToStealth,
    sendTokenToStealth,
    announcePayment,
    getMaxSendable,
    lastGeneratedAddress,
    isLoading,
    error
  };
}
