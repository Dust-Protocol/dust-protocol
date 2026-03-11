pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/mux1.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";

// Binary Merkle proof verifier using Poseidon(2) hashing.
// Identical to DustV2Transaction — duplicated to keep circuits self-contained.
template MerkleProofVerifierSplit(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output root;

    component hashers[levels];
    component mux[levels];

    signal computedPath[levels + 1];
    computedPath[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        mux[i] = MultiMux1(2);
        mux[i].c[0][0] <== computedPath[i];
        mux[i].c[0][1] <== pathElements[i];
        mux[i].c[1][0] <== pathElements[i];
        mux[i].c[1][1] <== computedPath[i];
        mux[i].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];

        computedPath[i + 1] <== hashers[i].out;
    }

    root <== computedPath[levels];
}

// 2-in-N-out split circuit for denomination splits.
//
// Extends the DustV2Transaction design to N_OUTPUTS output notes in a single
// proof, enabling efficient denomination splits (e.g., 1 ETH → 8 × 0.125 ETH).
//
// Modes:
//   - Split:    real inputs → N real outputs,      publicAmount = 0
//   - Deposit:  dummy inputs → N real outputs,     publicAmount > 0
//   - Withdraw: real inputs → N outputs (some 0),  publicAmount < 0 (field neg)
//
// Note commitment = Poseidon(owner, amount, asset, chainId, blinding)
// Nullifier      = Poseidon(nullifierKey, commitment, leafIndex)
// Owner pubkey   = Poseidon(spendingKey)
template DustV2Split(TREE_DEPTH, N_OUTPUTS) {
    // ---- Public signals (3 + N_OUTPUTS + 4 = 15 for N_OUTPUTS=8) ----
    signal input merkleRoot;
    signal input nullifier0;
    signal input nullifier1;
    signal input outputCommitment[N_OUTPUTS];
    signal input publicAmount;
    signal input publicAsset;
    signal input recipient;
    signal input chainId;

    // ---- Private inputs: spending keys ----
    signal input spendingKey;
    signal input nullifierKey;

    // ---- Private inputs: 2 input notes ----
    signal input inOwner[2];
    signal input inAmount[2];
    signal input inAsset[2];
    signal input inChainId[2];
    signal input inBlinding[2];

    // ---- Private inputs: 2 Merkle proofs ----
    signal input pathElements[2][TREE_DEPTH];
    signal input pathIndices[2][TREE_DEPTH];
    signal input leafIndex[2];

    // ---- Private inputs: N output notes ----
    signal input outOwner[N_OUTPUTS];
    signal input outAmount[N_OUTPUTS];
    signal input outAsset[N_OUTPUTS];
    signal input outChainId[N_OUTPUTS];
    signal input outBlinding[N_OUTPUTS];

    // ================================================================
    // Step 1: Derive owner public key from spending key
    // ================================================================
    component ownerPubKey = Poseidon(1);
    ownerPubKey.inputs[0] <== spendingKey;

    // ================================================================
    // Step 2: Process each input note (identical to DustV2Transaction)
    // ================================================================
    component inCommitmentHasher[2];
    component inNullifierHasher[2];
    component merkleVerifier[2];
    component isDummy[2];
    component inAmountRange[2];

    signal publicNullifier[2];
    signal notDummy[2];
    signal nullifierDiff[2];

    publicNullifier[0] <== nullifier0;
    publicNullifier[1] <== nullifier1;

    for (var i = 0; i < 2; i++) {
        // Commitment = Poseidon(owner, amount, asset, chainId, blinding)
        inCommitmentHasher[i] = Poseidon(5);
        inCommitmentHasher[i].inputs[0] <== inOwner[i];
        inCommitmentHasher[i].inputs[1] <== inAmount[i];
        inCommitmentHasher[i].inputs[2] <== inAsset[i];
        inCommitmentHasher[i].inputs[3] <== inChainId[i];
        inCommitmentHasher[i].inputs[4] <== inBlinding[i];

        // Ownership: amount != 0 implies inOwner == ownerPubKey
        inAmount[i] * (inOwner[i] - ownerPubKey.out) === 0;

        // Input amount range check (prevents overflow via field arithmetic)
        inAmountRange[i] = Num2Bits(128);
        inAmountRange[i].in <== inAmount[i];

        // Asset consistency — non-dummy inputs must match publicAsset
        inAmount[i] * (inAsset[i] - publicAsset) === 0;

        // ChainId consistency — non-dummy inputs must match public chainId
        inAmount[i] * (inChainId[i] - chainId) === 0;

        // Nullifier = Poseidon(nullifierKey, commitment, leafIndex)
        inNullifierHasher[i] = Poseidon(3);
        inNullifierHasher[i].inputs[0] <== nullifierKey;
        inNullifierHasher[i].inputs[1] <== inCommitmentHasher[i].out;
        inNullifierHasher[i].inputs[2] <== leafIndex[i];

        // Merkle proof verification
        merkleVerifier[i] = MerkleProofVerifierSplit(TREE_DEPTH);
        merkleVerifier[i].leaf <== inCommitmentHasher[i].out;
        for (var j = 0; j < TREE_DEPTH; j++) {
            merkleVerifier[i].pathElements[j] <== pathElements[i][j];
            merkleVerifier[i].pathIndices[j] <== pathIndices[i][j];
        }

        // Skip Merkle verification for dummy notes (amount == 0)
        inAmount[i] * (merkleVerifier[i].root - merkleRoot) === 0;

        // C1 fix: bind leafIndex to pathIndices (prevents nullifier unbinding double-spend)
        var computedLeafIndex = 0;
        for (var j = 0; j < TREE_DEPTH; j++) {
            computedLeafIndex += pathIndices[i][j] * (1 << j);
        }
        leafIndex[i] === computedLeafIndex;

        isDummy[i] = IsZero();
        isDummy[i].in <== inAmount[i];

        // Nullifier matching: real notes must match computed, dummies must be 0
        notDummy[i] <== 1 - isDummy[i].out;
        nullifierDiff[i] <== publicNullifier[i] - inNullifierHasher[i].out;
        notDummy[i] * nullifierDiff[i] === 0;
        isDummy[i].out * publicNullifier[i] === 0;
    }

    // ================================================================
    // Step 3: Process each output note
    // ================================================================
    component outCommitmentHasher[N_OUTPUTS];
    component outAmountRange[N_OUTPUTS];

    for (var j = 0; j < N_OUTPUTS; j++) {
        // Commitment = Poseidon(owner, amount, asset, chainId, blinding)
        outCommitmentHasher[j] = Poseidon(5);
        outCommitmentHasher[j].inputs[0] <== outOwner[j];
        outCommitmentHasher[j].inputs[1] <== outAmount[j];
        outCommitmentHasher[j].inputs[2] <== outAsset[j];
        outCommitmentHasher[j].inputs[3] <== outChainId[j];
        outCommitmentHasher[j].inputs[4] <== outBlinding[j];

        // Output amount range check (prevents overflow attacks)
        outAmountRange[j] = Num2Bits(128);
        outAmountRange[j].in <== outAmount[j];

        // Asset consistency — non-dummy outputs must match publicAsset
        outAmount[j] * (outAsset[j] - publicAsset) === 0;

        // ChainId consistency — non-dummy outputs must match public chainId
        outAmount[j] * (outChainId[j] - chainId) === 0;

        // Public commitment must match computed commitment
        outputCommitment[j] === outCommitmentHasher[j].out;
    }

    // ================================================================
    // Step 4: Balance conservation
    // ================================================================
    // inAmount[0] + inAmount[1] + publicAmount === sum(outAmount[0..N_OUTPUTS-1])
    signal outSum[N_OUTPUTS];
    outSum[0] <== outAmount[0];
    for (var j = 1; j < N_OUTPUTS; j++) {
        outSum[j] <== outSum[j - 1] + outAmount[j];
    }
    inAmount[0] + inAmount[1] + publicAmount === outSum[N_OUTPUTS - 1];

    // ================================================================
    // Step 5: Bind recipient to proof (prevent relay-time substitution)
    // ================================================================
    component recipientBinding = Poseidon(3);
    recipientBinding.inputs[0] <== recipient;
    recipientBinding.inputs[1] <== publicAsset;
    recipientBinding.inputs[2] <== publicAmount;

    signal recipientBindingCheck;
    recipientBindingCheck <== recipientBinding.out;
}

// 15 public signals: merkleRoot(1) + nullifiers(2) + outputCommitment(8) + publicAmount(1) + publicAsset(1) + recipient(1) + chainId(1)
component main {public [merkleRoot, nullifier0, nullifier1, outputCommitment, publicAmount, publicAsset, recipient, chainId]} = DustV2Split(20, 8);
