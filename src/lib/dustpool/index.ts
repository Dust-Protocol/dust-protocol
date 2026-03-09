// DustPool client library — deposit generation, proof generation, contract interaction

import { ethers } from 'ethers';
import {
  poseidon2,
  computeCommitment,
  computeNullifierHash,
  toBytes32Hex,
  fromBytes32Hex,
} from './poseidon';
import { MerkleTree, type MerkleProof } from './merkle';
import { RPC_LOG_BATCH_SIZE } from '@/lib/swap/constants';

export { poseidon2, computeCommitment, computeNullifierHash, toBytes32Hex, fromBytes32Hex } from './poseidon';
export { MerkleTree, type MerkleProof } from './merkle';

// ============ Types ============

export interface DepositData {
  nullifier: bigint;
  secret: bigint;
  amount: bigint;
  commitment: bigint;
  nullifierHash: bigint;
  commitmentHex: string;
  leafIndex?: number;
}

export interface StoredDeposit {
  nullifier: string;
  secret: string;
  amount: string;
  commitment: string;
  nullifierHash: string;
  leafIndex: number;
  txHash: string;
  timestamp: number;
  withdrawn: boolean;
}

export interface WithdrawProof {
  proof: string;  // bytes for contract call
  root: string;
  nullifierHash: string;
  recipient: string;
  amount: string;
}

// ============ Deposit Generation ============

/// Generate a fresh deposit (random secret + nullifier)
export async function generateDeposit(amount: bigint): Promise<DepositData> {
  // Generate cryptographically random nullifier and secret
  const randomBytes = new Uint8Array(64);
  crypto.getRandomValues(randomBytes);

  // Use first 31 bytes for nullifier, next 31 for secret (< field size)
  const nullifier = BigInt('0x' + Array.from(randomBytes.slice(0, 31))
    .map(b => b.toString(16).padStart(2, '0')).join(''));
  const secret = BigInt('0x' + Array.from(randomBytes.slice(32, 63))
    .map(b => b.toString(16).padStart(2, '0')).join(''));

  const commitment = await computeCommitment(nullifier, secret, amount);
  const nullifierHash = await computeNullifierHash(nullifier);

  return {
    nullifier,
    secret,
    amount,
    commitment,
    nullifierHash,
    commitmentHex: toBytes32Hex(commitment),
  };
}

// ============ Proof Generation ============

/// Generate a withdrawal proof using snarkjs (lazy-loaded)
export async function generateWithdrawProof(
  deposit: DepositData,
  merkleProof: MerkleProof,
  recipient: string,
): Promise<WithdrawProof> {
  // Lazy-load snarkjs
  const snarkjs = await import('snarkjs');

  // Load circuit artifacts from /public/zk/
  const wasmPath = '/zk/DustPoolWithdraw.wasm';
  const zkeyPath = '/zk/DustPoolWithdraw_final.zkey';

  const input = {
    // Public
    root: merkleProof.root.toString(),
    nullifierHash: deposit.nullifierHash.toString(),
    recipient: BigInt(recipient).toString(),
    amount: deposit.amount.toString(),
    // Private
    nullifier: deposit.nullifier.toString(),
    secret: deposit.secret.toString(),
    depositAmount: deposit.amount.toString(),
    pathElements: merkleProof.pathElements.map(e => e.toString()),
    pathIndices: merkleProof.pathIndices.map(i => i.toString()),
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath,
  );

  // Format proof for Solidity verifier (256 bytes)
  const proofBytes = formatProofForContract(proof);

  return {
    proof: proofBytes,
    root: toBytes32Hex(merkleProof.root),
    nullifierHash: toBytes32Hex(deposit.nullifierHash),
    recipient,
    amount: deposit.amount.toString(),
  };
}

/// Format snarkjs proof into Solidity-compatible bytes (8 uint256 = 256 bytes)
function formatProofForContract(proof: {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
}): string {
  const abiCoder = ethers.utils.defaultAbiCoder;
  return abiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
    [
      proof.pi_a[0], proof.pi_a[1],
      proof.pi_b[0][1], proof.pi_b[0][0],  // Note: snarkjs has reversed order for B
      proof.pi_b[1][1], proof.pi_b[1][0],
      proof.pi_c[0], proof.pi_c[1],
    ]
  );
}

// ============ Storage ============
import { storageKey, migrateKey } from '@/lib/storageKey';

function depositsKey(address: string, chainId?: number): string {
  const cid = chainId ?? 0;
  return storageKey('pool', address, cid);
}

export function saveDeposits(address: string, deposits: StoredDeposit[], chainId?: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(depositsKey(address, chainId), JSON.stringify(deposits));
  } catch { /* quota exceeded */ }
}

export function loadDeposits(address: string, chainId?: number): StoredDeposit[] {
  if (typeof window === 'undefined') return [];
  // Migrate both legacy key formats
  const cid = chainId ?? 0;
  migrateKey(`dustpool_deposits_${address.toLowerCase()}`, depositsKey(address, chainId));
  migrateKey(`dustpool_deposits_${cid}_${address.toLowerCase()}`, depositsKey(address, chainId));
  try {
    const raw = localStorage.getItem(depositsKey(address, chainId));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/// Convert StoredDeposit back to DepositData for proof generation
export function storedToDepositData(stored: StoredDeposit): DepositData {
  return {
    nullifier: BigInt(stored.nullifier),
    secret: BigInt(stored.secret),
    amount: BigInt(stored.amount),
    commitment: BigInt(stored.commitment),
    nullifierHash: BigInt(stored.nullifierHash),
    commitmentHex: stored.commitment,
    leafIndex: stored.leafIndex,
  };
}

// ============ Merkle Tree Reconstruction ============

/// Rebuild Merkle tree from on-chain Deposit events
export async function buildTreeFromEvents(
  provider: ethers.providers.Provider,
  poolAddress: string,
  fromBlock: number,
): Promise<{ tree: MerkleTree; deposits: Array<{ commitment: bigint; leafIndex: number; amount: bigint; txHash: string; timestamp: number }> }> {
  const iface = new ethers.utils.Interface([
    'event Deposit(bytes32 indexed commitment, uint256 leafIndex, uint256 amount, uint256 timestamp)',
  ]);

  const filter = {
    address: poolAddress,
    topics: [iface.getEventTopic('Deposit')],
    fromBlock,
    toBlock: 'latest',
  };

  // Fetch in chunks to avoid RPC block range limits
  const currentBlock = await provider.getBlockNumber();
  const MAX_RANGE = Number(RPC_LOG_BATCH_SIZE);
  let allLogs: ethers.providers.Log[] = [];

  for (let start = fromBlock; start <= currentBlock; start += MAX_RANGE) {
    const end = Math.min(start + MAX_RANGE - 1, currentBlock);
    const chunkLogs = await provider.getLogs({
      ...filter,
      fromBlock: start,
      toBlock: end,
    });
    allLogs = allLogs.concat(chunkLogs);
  }

  if (process.env.NODE_ENV === 'development') console.log(`[DustPool] Fetched ${allLogs.length} Deposit events from blocks ${fromBlock}–${currentBlock}`);

  const tree = await MerkleTree.create();
  const deposits: Array<{ commitment: bigint; leafIndex: number; amount: bigint; txHash: string; timestamp: number }> = [];

  // Sort by leafIndex to ensure correct order
  const parsed = allLogs.map(log => {
    const decoded = iface.parseLog(log);
    return {
      commitment: BigInt(decoded.args.commitment),
      leafIndex: decoded.args.leafIndex.toNumber(),
      amount: BigInt(decoded.args.amount.toString()),
      txHash: log.transactionHash,
      timestamp: decoded.args.timestamp.toNumber(),
    };
  }).sort((a, b) => a.leafIndex - b.leafIndex);

  // Verify no gaps in leaf indices
  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].leafIndex !== i) {
      console.error(`[DustPool] Gap in leaf indices! Expected ${i}, got ${parsed[i].leafIndex}`);
    }
  }

  for (const d of parsed) {
    await tree.insert(d.commitment);
    deposits.push(d);
  }

  return { tree, deposits };
}
