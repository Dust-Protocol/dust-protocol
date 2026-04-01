// V2 DustPool proof input builders
//
// Each builder assembles the public and private signals for the V2 UTXO circuit.
// The circuit enforces:
//   sum(input amounts) + publicAmount == sum(output amounts)
//   each input nullifier is correctly derived
//   each output commitment is correctly derived
//   Merkle proofs are valid for input notes

import { BN254_FIELD_SIZE, TREE_DEPTH } from './constants'
import { computeNoteCommitment } from './commitment'
import { computeNullifier } from './nullifier'
import { createDummyNote, createNote } from './note'
import type { NoteCommitmentV2, NoteV2, ProofInputs, SplitProofInputs, V2Keys } from './types'

// ── Split types ──────────────────────────────────────────────────────────────

export interface SplitOutputNote {
  commitment: bigint
  owner: bigint
  amount: bigint
  asset: bigint
  blinding: bigint
}

export interface SplitBuildResult {
  circuitInputs: Record<string, string | string[] | string[][]>
  outputNotes: SplitOutputNote[]
}

// ── Constants ────────────────────────────────────────────────────────────────

// Non-zero burn address for internal operations (splits, transfers) where
// publicAmount = 0 and no ETH leaves the pool. The contract requires a
// non-zero recipient even when nothing is sent.
const INTERNAL_RECIPIENT = BigInt('0x000000000000000000000000000000000000dEaD')

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Dummy Merkle proof (all zeros, depth = TREE_DEPTH) */
function dummyMerkleProof(): { pathElements: bigint[]; pathIndices: number[] } {
  return {
    pathElements: new Array<bigint>(TREE_DEPTH).fill(0n),
    pathIndices: new Array<number>(TREE_DEPTH).fill(0),
  }
}

/** Convert an Ethereum address to bigint (for the recipient public signal) */
function addressToBigInt(address: string): bigint {
  return BigInt(address)
}

// ── Deposit ──────────────────────────────────────────────────────────────────

/**
 * Build circuit inputs for a deposit operation.
 *
 * - Both input notes are dummy (no notes consumed).
 * - Output 0 is the real note being created; output 1 is dummy.
 * - publicAmount = deposit amount (positive, added to the pool).
 * - No Merkle proof needed (inputs are dummy).
 */
export async function buildDepositInputs(
  note: NoteV2,
  keys: V2Keys,
  chainId: number
): Promise<ProofInputs> {
  const dummy = createDummyNote()
  const dummyProof = dummyMerkleProof()

  // Circuit constraint: isDummy * nullifier === 0, so dummy nullifiers must be 0
  const nullifier0 = 0n
  const nullifier1 = 0n

  // Output commitments
  const outputCommitment0 = await computeNoteCommitment(note)
  const dummyOutputCommitment = await computeNoteCommitment(dummy)

  return {
    // Public
    merkleRoot: 0n, // No tree state needed for deposit
    nullifier0,
    nullifier1,
    outputCommitment0,
    outputCommitment1: dummyOutputCommitment,
    publicAmount: note.amount,
    publicAsset: note.asset,
    recipient: 0n, // No recipient for deposits
    chainId: BigInt(chainId),

    // Private — input notes (both dummy)
    inOwner: [dummy.owner, dummy.owner],
    inAmount: [dummy.amount, dummy.amount],
    inAsset: [dummy.asset, dummy.asset],
    inChainId: [BigInt(dummy.chainId), BigInt(dummy.chainId)],
    inBlinding: [dummy.blinding, dummy.blinding],
    pathElements: [dummyProof.pathElements, dummyProof.pathElements],
    pathIndices: [dummyProof.pathIndices, dummyProof.pathIndices],
    leafIndex: [0n, 0n],

    // Private — output notes
    outOwner: [note.owner, dummy.owner],
    outAmount: [note.amount, dummy.amount],
    outAsset: [note.asset, dummy.asset],
    outChainId: [BigInt(note.chainId), BigInt(dummy.chainId)],
    outBlinding: [note.blinding, dummy.blinding],

    // Keys
    spendingKey: keys.spendingKey,
    nullifierKey: keys.nullifierKey,
  }
}

// ── Withdraw ─────────────────────────────────────────────────────────────────

/**
 * Build circuit inputs for a withdrawal operation.
 *
 * - Input 0 is the note being consumed; input 1 is dummy.
 * - Output 0 is the change note (if any); output 1 is dummy.
 * - publicAmount = field-negative withdrawal amount (FIELD_SIZE - amount).
 * - recipient = Ethereum address of the withdrawal target.
 */
export async function buildWithdrawInputs(
  inputNote: NoteCommitmentV2,
  amount: bigint,
  recipient: string,
  keys: V2Keys,
  merkleProof: { pathElements: bigint[]; pathIndices: number[] },
  chainId: number,
  changeNote?: NoteV2
): Promise<ProofInputs> {
  if (amount > inputNote.note.amount) {
    throw new Error(
      `Withdrawal amount (${amount}) exceeds note balance (${inputNote.note.amount})`
    )
  }

  const dummy = createDummyNote()
  const dummyProof = dummyMerkleProof()

  // Compute change
  const changeAmount = inputNote.note.amount - amount
  const resolvedChange =
    changeNote ??
    (changeAmount > 0n
      ? createNote(
          inputNote.note.owner,
          changeAmount,
          inputNote.note.asset,
          inputNote.note.chainId
        )
      : createDummyNote())

  // Nullifiers
  const nullifier0 = await computeNullifier(
    keys.nullifierKey,
    inputNote.commitment,
    inputNote.leafIndex
  )
  // Circuit constraint: isDummy * nullifier === 0, so dummy nullifier must be 0
  const nullifier1 = 0n

  // Output commitments
  const outputCommitment0 = await computeNoteCommitment(resolvedChange)
  const dummyOutputCommitment = await computeNoteCommitment(dummy)

  // Negative amount in field arithmetic: FIELD_SIZE - amount represents -amount
  const negativeAmount = BN254_FIELD_SIZE - amount

  // Recompute Merkle root from proof path
  const { poseidonHash } = await import('./commitment')
  let currentHash = inputNote.commitment
  for (let i = 0; i < TREE_DEPTH; i++) {
    if (merkleProof.pathIndices[i] === 0) {
      currentHash = await poseidonHash([currentHash, merkleProof.pathElements[i]])
    } else {
      currentHash = await poseidonHash([merkleProof.pathElements[i], currentHash])
    }
  }
  const merkleRoot = currentHash

  return {
    // Public
    merkleRoot,
    nullifier0,
    nullifier1,
    outputCommitment0,
    outputCommitment1: dummyOutputCommitment,
    publicAmount: negativeAmount,
    publicAsset: inputNote.note.asset,
    recipient: addressToBigInt(recipient),
    chainId: BigInt(chainId),

    // Private — input notes
    inOwner: [inputNote.note.owner, dummy.owner],
    inAmount: [inputNote.note.amount, dummy.amount],
    inAsset: [inputNote.note.asset, dummy.asset],
    inChainId: [BigInt(inputNote.note.chainId), BigInt(dummy.chainId)],
    inBlinding: [inputNote.note.blinding, dummy.blinding],
    pathElements: [merkleProof.pathElements, dummyProof.pathElements],
    pathIndices: [merkleProof.pathIndices, dummyProof.pathIndices],
    leafIndex: [BigInt(inputNote.leafIndex), 0n],

    // Private — output notes
    outOwner: [resolvedChange.owner, dummy.owner],
    outAmount: [resolvedChange.amount, dummy.amount],
    outAsset: [resolvedChange.asset, dummy.asset],
    outChainId: [BigInt(resolvedChange.chainId), BigInt(dummy.chainId)],
    outBlinding: [resolvedChange.blinding, dummy.blinding],

    // Keys
    spendingKey: keys.spendingKey,
    nullifierKey: keys.nullifierKey,
  }
}

// ── Swap ─────────────────────────────────────────────────────────────────────

/**
 * Build proof inputs for a V2 private swap.
 * Identical to withdraw inputs except recipient = DustSwapAdapterV2 address.
 */
export async function buildSwapInputs(
  inputNote: NoteCommitmentV2,
  amount: bigint,
  adapterAddress: string,
  keys: V2Keys,
  merkleProof: { pathElements: bigint[]; pathIndices: number[] },
  chainId: number,
  changeNote?: NoteV2
): Promise<ProofInputs> {
  return buildWithdrawInputs(inputNote, amount, adapterAddress, keys, merkleProof, chainId, changeNote)
}

// ── Transfer ─────────────────────────────────────────────────────────────────

/**
 * Build circuit inputs for an off-chain transfer.
 *
 * - Input 0 is the note being consumed; input 1 is dummy.
 * - Output 0 goes to the recipient; output 1 is change back to sender.
 * - publicAmount = 0 (no value enters or leaves the pool).
 */
export async function buildTransferInputs(
  inputNote: NoteCommitmentV2,
  recipientOwner: bigint,
  amount: bigint,
  keys: V2Keys,
  merkleProof: { pathElements: bigint[]; pathIndices: number[] },
  chainId: number
): Promise<ProofInputs> {
  if (amount > inputNote.note.amount) {
    throw new Error(
      `Transfer amount (${amount}) exceeds note balance (${inputNote.note.amount})`
    )
  }

  const dummy = createDummyNote()
  const dummyProof = dummyMerkleProof()

  // Output to recipient
  const recipientNote = createNote(
    recipientOwner,
    amount,
    inputNote.note.asset,
    inputNote.note.chainId
  )

  // Change back to sender
  const changeAmount = inputNote.note.amount - amount
  const changeNote =
    changeAmount > 0n
      ? createNote(
          inputNote.note.owner,
          changeAmount,
          inputNote.note.asset,
          inputNote.note.chainId
        )
      : createDummyNote()

  // Nullifiers
  const nullifier0 = await computeNullifier(
    keys.nullifierKey,
    inputNote.commitment,
    inputNote.leafIndex
  )
  // Circuit constraint: isDummy * nullifier === 0, so dummy nullifier must be 0
  const nullifier1 = 0n

  // Output commitments
  const outputCommitment0 = await computeNoteCommitment(recipientNote)
  const outputCommitment1 = await computeNoteCommitment(changeNote)

  // Recompute Merkle root from proof path
  const { poseidonHash } = await import('./commitment')
  let currentHash = inputNote.commitment
  for (let i = 0; i < TREE_DEPTH; i++) {
    if (merkleProof.pathIndices[i] === 0) {
      currentHash = await poseidonHash([currentHash, merkleProof.pathElements[i]])
    } else {
      currentHash = await poseidonHash([merkleProof.pathElements[i], currentHash])
    }
  }
  const merkleRoot = currentHash

  return {
    // Public
    merkleRoot,
    nullifier0,
    nullifier1,
    outputCommitment0,
    outputCommitment1,
    publicAmount: 0n,
    publicAsset: inputNote.note.asset,
    recipient: 0n, // No external recipient for transfers (stays in pool)
    chainId: BigInt(chainId),

    // Private — input notes
    inOwner: [inputNote.note.owner, dummy.owner],
    inAmount: [inputNote.note.amount, dummy.amount],
    inAsset: [inputNote.note.asset, dummy.asset],
    inChainId: [BigInt(inputNote.note.chainId), BigInt(dummy.chainId)],
    inBlinding: [inputNote.note.blinding, dummy.blinding],
    pathElements: [merkleProof.pathElements, dummyProof.pathElements],
    pathIndices: [merkleProof.pathIndices, dummyProof.pathIndices],
    leafIndex: [BigInt(inputNote.leafIndex), 0n],

    // Private — output notes
    outOwner: [recipientNote.owner, changeNote.owner],
    outAmount: [recipientNote.amount, changeNote.amount],
    outAsset: [recipientNote.asset, changeNote.asset],
    outChainId: [BigInt(recipientNote.chainId), BigInt(changeNote.chainId)],
    outBlinding: [recipientNote.blinding, changeNote.blinding],

    // Keys
    spendingKey: keys.spendingKey,
    nullifierKey: keys.nullifierKey,
  }
}

// ── Merge ────────────────────────────────────────────────────────────────

/**
 * Build circuit inputs for merging two notes into one.
 *
 * Uses the standard 2-in-2-out circuit with both input slots populated by
 * real notes. Output 0 is the merged note (sum of amounts); output 1 is dummy.
 * publicAmount = 0, recipient = INTERNAL_RECIPIENT (no value leaves the pool).
 *
 * Both input notes must share the same asset and chainId.
 * Both must have confirmed leafIndex >= 0.
 */
export async function buildMergeInputs(
  inputNote0: NoteCommitmentV2,
  inputNote1: NoteCommitmentV2,
  keys: V2Keys,
  merkleProof0: { pathElements: bigint[]; pathIndices: number[] },
  merkleProof1: { pathElements: bigint[]; pathIndices: number[] },
  chainId: number,
  mergedNote?: NoteV2
): Promise<ProofInputs> {
  if (inputNote0.note.asset !== inputNote1.note.asset) {
    throw new Error('Cannot merge notes with different assets')
  }

  const mergedAmount = inputNote0.note.amount + inputNote1.note.amount
  const resolvedMerged = mergedNote ?? createNote(
    inputNote0.note.owner,
    mergedAmount,
    inputNote0.note.asset,
    inputNote0.note.chainId
  )

  const dummy = createDummyNote()

  const nullifier0 = await computeNullifier(
    keys.nullifierKey,
    inputNote0.commitment,
    inputNote0.leafIndex
  )
  const nullifier1 = await computeNullifier(
    keys.nullifierKey,
    inputNote1.commitment,
    inputNote1.leafIndex
  )

  const outputCommitment0 = await computeNoteCommitment(resolvedMerged)
  const dummyOutputCommitment = await computeNoteCommitment(dummy)

  // Both Merkle proofs must resolve to the same root
  const { poseidonHash } = await import('./commitment')
  let root0 = inputNote0.commitment
  for (let i = 0; i < TREE_DEPTH; i++) {
    if (merkleProof0.pathIndices[i] === 0) {
      root0 = await poseidonHash([root0, merkleProof0.pathElements[i]])
    } else {
      root0 = await poseidonHash([merkleProof0.pathElements[i], root0])
    }
  }

  return {
    merkleRoot: root0,
    nullifier0,
    nullifier1,
    outputCommitment0,
    outputCommitment1: dummyOutputCommitment,
    publicAmount: 0n,
    publicAsset: inputNote0.note.asset,
    recipient: INTERNAL_RECIPIENT,
    chainId: BigInt(chainId),

    inOwner: [inputNote0.note.owner, inputNote1.note.owner],
    inAmount: [inputNote0.note.amount, inputNote1.note.amount],
    inAsset: [inputNote0.note.asset, inputNote1.note.asset],
    inChainId: [BigInt(inputNote0.note.chainId), BigInt(inputNote1.note.chainId)],
    inBlinding: [inputNote0.note.blinding, inputNote1.note.blinding],
    pathElements: [merkleProof0.pathElements, merkleProof1.pathElements],
    pathIndices: [merkleProof0.pathIndices, merkleProof1.pathIndices],
    leafIndex: [BigInt(inputNote0.leafIndex), BigInt(inputNote1.leafIndex)],

    outOwner: [resolvedMerged.owner, dummy.owner],
    outAmount: [resolvedMerged.amount, dummy.amount],
    outAsset: [resolvedMerged.asset, dummy.asset],
    outChainId: [BigInt(resolvedMerged.chainId), BigInt(dummy.chainId)],
    outBlinding: [resolvedMerged.blinding, dummy.blinding],

    spendingKey: keys.spendingKey,
    nullifierKey: keys.nullifierKey,
  }
}

// ── Split ────────────────────────────────────────────────────────────────────

const N_SPLIT_OUTPUTS = 8

/**
 * Build circuit inputs for a 2-in-8-out internal denomination split.
 *
 * - Input 0 is the note being consumed; input 1 is dummy.
 * - Outputs: one note per chunk, optional change note, padded with dummies to 8.
 * - Always internal: publicAmount = 0, recipient = 0 (no value leaves the pool).
 * - External withdrawal happens in a separate batch-withdraw step using standard 2-in-2-out proofs.
 */
export async function buildSplitInputs(
  inputNote: NoteCommitmentV2,
  chunks: bigint[],
  keys: V2Keys,
  merkleProof: { pathElements: bigint[]; pathIndices: number[] },
  chainId: number,
  recipientOwner?: bigint
): Promise<SplitBuildResult> {
  const totalChunks = chunks.reduce((sum, c) => sum + c, 0n)

  if (totalChunks > inputNote.note.amount) {
    throw new Error(
      `Chunks total (${totalChunks}) exceeds note balance (${inputNote.note.amount})`
    )
  }

  if (chunks.length > N_SPLIT_OUTPUTS) {
    throw new Error(
      `Too many chunks (${chunks.length}), maximum is ${N_SPLIT_OUTPUTS}`
    )
  }

  const change = inputNote.note.amount - totalChunks
  const hasChange = change > 0n

  if (hasChange && chunks.length >= N_SPLIT_OUTPUTS) {
    throw new Error(
      `No room for change note: ${chunks.length} chunks fills all ${N_SPLIT_OUTPUTS} output slots`
    )
  }

  const chunkOwner = recipientOwner ?? inputNote.note.owner
  const dummy = createDummyNote()
  const dummyProofData = dummyMerkleProof()

  const notes: NoteV2[] = []

  for (const chunk of chunks) {
    notes.push(
      createNote(chunkOwner, chunk, inputNote.note.asset, inputNote.note.chainId)
    )
  }

  if (hasChange) {
    notes.push(
      createNote(inputNote.note.owner, change, inputNote.note.asset, inputNote.note.chainId)
    )
  }

  while (notes.length < N_SPLIT_OUTPUTS) {
    notes.push(createDummyNote())
  }

  const commitments = await Promise.all(
    notes.map((n) => computeNoteCommitment(n))
  )

  const nullifier0 = await computeNullifier(
    keys.nullifierKey,
    inputNote.commitment,
    inputNote.leafIndex
  )
  const nullifier1 = 0n

  const { poseidonHash } = await import('./commitment')
  let currentHash = inputNote.commitment
  for (let i = 0; i < TREE_DEPTH; i++) {
    if (merkleProof.pathIndices[i] === 0) {
      currentHash = await poseidonHash([currentHash, merkleProof.pathElements[i]])
    } else {
      currentHash = await poseidonHash([merkleProof.pathElements[i], currentHash])
    }
  }

  // Internal split: no value leaves the pool
  const inputs: SplitProofInputs = {
    merkleRoot: currentHash,
    nullifier0,
    nullifier1,
    outputCommitments: commitments,
    publicAmount: 0n,
    publicAsset: inputNote.note.asset,
    recipient: INTERNAL_RECIPIENT,
    chainId: BigInt(chainId),

    inOwner: [inputNote.note.owner, dummy.owner],
    inAmount: [inputNote.note.amount, dummy.amount],
    inAsset: [inputNote.note.asset, dummy.asset],
    inChainId: [BigInt(inputNote.note.chainId), BigInt(dummy.chainId)],
    inBlinding: [inputNote.note.blinding, dummy.blinding],
    pathElements: [merkleProof.pathElements, dummyProofData.pathElements],
    pathIndices: [merkleProof.pathIndices, dummyProofData.pathIndices],
    leafIndex: [BigInt(inputNote.leafIndex), 0n],

    outOwner: notes.map((n) => n.owner),
    outAmount: notes.map((n) => n.amount),
    outAsset: notes.map((n) => n.asset),
    outChainId: notes.map((n) => BigInt(n.chainId)),
    outBlinding: notes.map((n) => n.blinding),

    spendingKey: keys.spendingKey,
    nullifierKey: keys.nullifierKey,
  }

  // Only return non-dummy output notes (amount > 0) for IndexedDB storage
  const realOutputNotes: SplitOutputNote[] = []
  for (let i = 0; i < notes.length; i++) {
    if (notes[i].amount > 0n) {
      realOutputNotes.push({
        commitment: commitments[i],
        owner: notes[i].owner,
        amount: notes[i].amount,
        asset: notes[i].asset,
        blinding: notes[i].blinding,
      })
    }
  }

  return {
    circuitInputs: formatSplitCircuitInputs(inputs),
    outputNotes: realOutputNotes,
  }
}

function formatSplitCircuitInputs(
  inputs: SplitProofInputs
): Record<string, string | string[] | string[][]> {
  return {
    merkleRoot: inputs.merkleRoot.toString(),
    nullifier0: inputs.nullifier0.toString(),
    nullifier1: inputs.nullifier1.toString(),
    outputCommitment: inputs.outputCommitments.map(String),
    publicAmount: inputs.publicAmount.toString(),
    publicAsset: inputs.publicAsset.toString(),
    recipient: inputs.recipient.toString(),
    chainId: inputs.chainId.toString(),

    spendingKey: inputs.spendingKey.toString(),
    nullifierKey: inputs.nullifierKey.toString(),

    inOwner: inputs.inOwner.map(String),
    inAmount: inputs.inAmount.map(String),
    inAsset: inputs.inAsset.map(String),
    inChainId: inputs.inChainId.map(String),
    inBlinding: inputs.inBlinding.map(String),
    leafIndex: inputs.leafIndex.map(String),

    pathElements: inputs.pathElements.map((arr) => arr.map(String)),
    pathIndices: inputs.pathIndices.map((arr) => arr.map(String)),

    outOwner: inputs.outOwner.map(String),
    outAmount: inputs.outAmount.map(String),
    outAsset: inputs.outAsset.map(String),
    outChainId: inputs.outChainId.map(String),
    outBlinding: inputs.outBlinding.map(String),
  }
}
