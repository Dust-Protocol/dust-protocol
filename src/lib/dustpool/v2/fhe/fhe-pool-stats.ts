import {
  type Address,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  http,
  zeroAddress,
} from 'viem'

import type {
  FHEDecryptedPoolStats,
  FHEInstance,
  FHEPoolStatsSnapshot,
} from './types'
import { FHE_POOL_STATS_ABI } from './types'
import { getFHEConfig, isFHEComplianceEnabled } from './fhe-compliance'

const DEFAULT_SNAPSHOT: FHEPoolStatsSnapshot = {
  asset: zeroAddress,
  depositCount: 0,
  withdrawalCount: 0,
  swapCount: 0,
  hasAuditAccess: false,
}

function getPoolStatsClient(publicClient?: PublicClient): PublicClient {
  if (publicClient) return publicClient
  const config = getFHEConfig()
  return createPublicClient({ transport: http(config.rpcUrl) }) as PublicClient
}

/**
 * Reads plaintext transaction counts for an asset from the FHEPoolStats contract.
 * Returns graceful defaults when FHE is not enabled.
 */
export async function getPoolStatsSnapshot(
  asset: Address,
  publicClient?: PublicClient,
): Promise<FHEPoolStatsSnapshot> {
  if (!isFHEComplianceEnabled()) {
    return { ...DEFAULT_SNAPSHOT, asset }
  }

  const config = getFHEConfig()
  if (config.poolStatsAddress === zeroAddress) {
    return { ...DEFAULT_SNAPSHOT, asset }
  }

  const client = getPoolStatsClient(publicClient)

  const [txCounts, swapCount] = await Promise.all([
    client.readContract({
      address: config.poolStatsAddress,
      abi: FHE_POOL_STATS_ABI,
      functionName: 'getTransactionCounts',
      args: [asset],
    }) as Promise<[bigint, bigint]>,
    client.readContract({
      address: config.poolStatsAddress,
      abi: FHE_POOL_STATS_ABI,
      functionName: 'totalSwapCount',
    }) as Promise<bigint>,
  ])

  return {
    asset,
    depositCount: Number(txCounts[0]),
    withdrawalCount: Number(txCounts[1]),
    swapCount: Number(swapCount),
    hasAuditAccess: false,
  }
}

/**
 * Checks whether an address has auditor role on the FHEPoolStats contract.
 */
export async function isAuditor(
  address: Address,
  publicClient?: PublicClient,
): Promise<boolean> {
  if (!isFHEComplianceEnabled()) {
    return false
  }

  const config = getFHEConfig()
  if (config.poolStatsAddress === zeroAddress) {
    return false
  }

  const client = getPoolStatsClient(publicClient)

  return client.readContract({
    address: config.poolStatsAddress,
    abi: FHE_POOL_STATS_ABI,
    functionName: 'isAuditor',
    args: [address],
  }) as Promise<boolean>
}

/**
 * For auditors: requests ACL access on-chain, then uses fhevmjs to re-encrypt
 * the encrypted totals for local decryption. The wallet must hold the auditor role.
 */
export async function requestAuditDecryption(
  asset: Address,
  walletClient: WalletClient,
): Promise<FHEDecryptedPoolStats> {
  if (!isFHEComplianceEnabled()) {
    return {
      ...DEFAULT_SNAPSHOT,
      asset,
      totalDeposits: 0n,
      totalWithdrawals: 0n,
      netBalance: 0n,
    }
  }

  const config = getFHEConfig()
  if (config.poolStatsAddress === zeroAddress) {
    return {
      ...DEFAULT_SNAPSHOT,
      asset,
      totalDeposits: 0n,
      totalWithdrawals: 0n,
      netBalance: 0n,
    }
  }

  const account = walletClient.account
  if (!account) {
    throw new Error('WalletClient must have an account connected')
  }

  const auditorAddress = account.address
  const hasAccess = await isAuditor(auditorAddress)
  if (!hasAccess) {
    throw new Error(`Address ${auditorAddress} is not an auditor`)
  }

  const client = getPoolStatsClient()

  const txHash = await walletClient.writeContract({
    address: config.poolStatsAddress,
    abi: FHE_POOL_STATS_ABI,
    functionName: 'requestAuditAccess',
    args: [asset],
    chain: walletClient.chain,
    account,
  })

  const receipt = await client.waitForTransactionReceipt({ hash: txHash })
  if (receipt.status === 'reverted') {
    throw new Error('requestAuditAccess transaction reverted')
  }

  // Dynamic import — fhevmjs (~2MB) only loaded for auditor decryption path
  const { createInstance } = await import(/* webpackIgnore: true */ 'fhevmjs' as string) as {
    createInstance: (opts: { chainId: number; networkUrl: string }) => Promise<FHEInstance>
  }
  const fheInstance: FHEInstance = await createInstance({
    chainId: config.chainId,
    networkUrl: config.rpcUrl,
  })

  const { publicKey, privateKey } = fheInstance.generateKeypair()

  const signature = await walletClient.signMessage({
    account,
    message: { raw: publicKey },
  })

  // Only totalDeposits (handle 0) and totalWithdrawals (handle 1) exist on-chain.
  // netBalance is computed client-side to avoid a non-existent handle.
  const HANDLE_TOTAL_DEPOSITS = 0n
  const HANDLE_TOTAL_WITHDRAWALS = 1n

  const [totalDeposits, totalWithdrawals] = await Promise.all([
    fheInstance.reencrypt(
      HANDLE_TOTAL_DEPOSITS,
      privateKey,
      publicKey,
      signature,
      config.poolStatsAddress,
      auditorAddress,
    ),
    fheInstance.reencrypt(
      HANDLE_TOTAL_WITHDRAWALS,
      privateKey,
      publicKey,
      signature,
      config.poolStatsAddress,
      auditorAddress,
    ),
  ])

  const netBalance = totalDeposits - totalWithdrawals

  const snapshot = await getPoolStatsSnapshot(asset)

  return {
    ...snapshot,
    hasAuditAccess: true,
    totalDeposits,
    totalWithdrawals,
    netBalance,
  }
}
