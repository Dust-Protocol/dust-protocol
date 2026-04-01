import { type Address } from 'viem'

// ── FHE Chain Configuration ──

export interface FHEChainConfig {
  chainId: number
  rpcUrl: string
  oracleAddress: Address
  bridgeAddress: Address
  poolStatsAddress: Address
  confidentialDustPoolAddress: Address
  enabled: boolean
}

// ── Compliance Oracle Types ──

export interface FHEComplianceCheckRequest {
  address: Address
  /** First byte of keccak256(address) — determines sanctions list bucket */
  bucketHint: number
  encryptedAddress: Uint8Array
  inputProof: Uint8Array
}

export interface FHEComplianceCheckResult {
  requestId: bigint
  resolved: boolean
  /** Only valid when resolved=true */
  isBlocked: boolean
  txHash: string
  /** The ebool handle for KMS decryption (bytes32). Null for empty-bucket fast path. */
  resultHandle: string | null
}

export type FHEComplianceStatus =
  | { status: 'idle' }
  | { status: 'encrypting' }
  | { status: 'submitting' }
  | { status: 'waiting-gateway'; requestId: bigint }
  | { status: 'resolved'; isBlocked: boolean }
  | { status: 'error'; reason: string }

// ── Pool Stats Types ──

export interface FHEPoolStatsSnapshot {
  asset: Address
  depositCount: number
  withdrawalCount: number
  swapCount: number
  hasAuditAccess: boolean
}

export interface FHEDecryptedPoolStats extends FHEPoolStatsSnapshot {
  totalDeposits: bigint
  totalWithdrawals: bigint
  netBalance: bigint
}

// ── Bridge Types ──

export interface BridgeCacheEntry {
  address: Address
  isBlocked: boolean
  isScreened: boolean
  updatedAt: number
}

// ── FHE Instance Type (minimal interface to avoid fhevmjs dep) ──

export interface FHEInstance {
  createEncryptedInput(contractAddress: Address, userAddress: Address): FHEEncryptedInput
  generateKeypair(): { publicKey: Uint8Array; privateKey: Uint8Array }
  reencrypt(
    handle: bigint,
    privateKey: Uint8Array,
    publicKey: Uint8Array,
    signature: string,
    contractAddress: Address,
    userAddress: Address
  ): Promise<bigint>
}

export interface FHEEncryptedInput {
  addAddress(address: Address): FHEEncryptedInput
  add256(value: bigint): FHEEncryptedInput
  add64(value: bigint): FHEEncryptedInput
  encrypt(): { handles: Uint8Array[]; inputProof: Uint8Array }
}

// ── Constants ──

/** 2^8 hash buckets for the sanctions list */
export const FHE_BUCKET_COUNT = 256

export const FHE_MAX_BUCKET_SIZE = 100

/** Gateway decryption timeout (ms) */
export const FHE_GATEWAY_TIMEOUT_MS = 60_000

export const FHE_POLL_INTERVAL_MS = 3_000

export const FHE_MAX_POLL_ATTEMPTS = 20

// ── ABI Fragments ──

export const FHE_COMPLIANCE_ORACLE_ABI = [
  {
    name: 'checkCompliance',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'encryptedAddr', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
      { name: 'bucketHint', type: 'uint8' },
    ],
    outputs: [{ name: 'requestId', type: 'uint256' }],
  },
  {
    name: 'resolveCompliance',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'requestId', type: 'uint256' },
      { name: 'decryptedResult', type: 'bool' },
      { name: 'decryptionProof', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'getComplianceResult',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [
      { name: 'resolved', type: 'bool' },
      { name: 'isBlocked', type: 'bool' },
    ],
  },
  {
    name: 'getResultHandle',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [{ name: 'handle', type: 'bytes32' }],
  },
  {
    name: 'getBucketSize',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'bucket', type: 'uint8' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalSanctioned',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

export const FHE_COMPLIANCE_BRIDGE_ABI = [
  {
    name: 'isBlocked',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'isScreened',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'updateCache',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'blocked', type: 'bool' },
    ],
    outputs: [],
  },
  {
    name: 'updateCacheBatch',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'accounts', type: 'address[]' },
      { name: 'blockedStatuses', type: 'bool[]' },
    ],
    outputs: [],
  },
] as const

export const FHE_POOL_STATS_ABI = [
  {
    name: 'recordDeposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'recordWithdrawal',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'recordSwap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assetIn', type: 'address' },
      { name: 'assetOut', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'getTransactionCounts',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [
      { name: 'deposits', type: 'uint256' },
      { name: 'withdrawals', type: 'uint256' },
    ],
  },
  {
    name: 'isAuditor',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'requestAuditAccess',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [],
  },
  {
    name: 'totalSwapCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const
