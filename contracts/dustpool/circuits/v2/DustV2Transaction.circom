pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/mux1.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";

// Reusable Merkle proof verifier using Poseidon(2) hashing.
// Walks from a leaf commitment up to the root of a binary Merkle tree.
template MerkleProofVerifier(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output root;

    component hashers[levels];
    component mux[levels];

    signal computedPath[levels + 1];
    computedPath[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        // pathIndices[i] must be 0 or 1
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        // Mux: if pathIndices[i] == 0, leaf is on the left; else on the right
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

// Universal 2-in-2-out privacy transaction circuit.
//
// Supports deposit, withdrawal, and private transfer in a single circuit:
//   - Deposit:  dummy inputs,  real outputs,  publicAmount > 0
//   - Withdraw: real inputs,   dummy outputs, publicAmount < 0 (field neg)
//   - Transfer: real inputs,   real outputs,  publicAmount = 0
//
// Note commitment = Poseidon(owner, amount, asset, chainId, blinding)
// Nullifier      = Poseidon(nullifierKey, commitment, leafIndex)
// Owner pubkey   = Poseidon(spendingKey)
template DustV2Transaction(TREE_DEPTH) {
    // ---- Public signals ----
    signal input merkleRoot;
    signal input nullifier0;
    signal input nullifier1;
    signal input outputCommitment0;
    signal input outputCommitment1;
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

    // ---- Private inputs: 2 output notes ----
    signal input outOwner[2];
    signal input outAmount[2];
    signal input outAsset[2];
    signal input outChainId[2];
    signal input outBlinding[2];

    // ================================================================
    // Step 1: Derive owner public key from spending key
    // ================================================================
    component ownerPubKey = Poseidon(1);
    ownerPubKey.inputs[0] <== spendingKey;

    // ================================================================
    // Step 2: Process each input note
    // ================================================================
    component inCommitmentHasher[2];
    component inNullifierHasher[2];
    component merkleVerifier[2];
    component isDummy[2];
    component inAmountRange[2]; // C3: input amount range check

    // Pre-declare signals that are used inside the for loop
    signal publicNullifier[2];
    signal notDummy[2];
    signal nullifierDiff[2];

    publicNullifier[0] <== nullifier0;
    publicNullifier[1] <== nullifier1;

    for (var i = 0; i < 2; i++) {
        // 2a. Compute input note commitment = Poseidon(owner, amount, asset, chainId, blinding)
        inCommitmentHasher[i] = Poseidon(5);
        inCommitmentHasher[i].inputs[0] <== inOwner[i];
        inCommitmentHasher[i].inputs[1] <== inAmount[i];
        inCommitmentHasher[i].inputs[2] <== inAsset[i];
        inCommitmentHasher[i].inputs[3] <== inChainId[i];
        inCommitmentHasher[i].inputs[4] <== inBlinding[i];

        // 2b. Ownership check: owner must equal ownerPubKey OR note is dummy (amount == 0)
        // Constraint: inAmount[i] * (inOwner[i] - ownerPubKey.out) === 0
        // If amount != 0, then inOwner[i] must equal ownerPubKey.out
        // If amount == 0 (dummy), ownership is not enforced
        inAmount[i] * (inOwner[i] - ownerPubKey.out) === 0;

        // C3 fix: range check input amounts (prevents overflow via field arithmetic)
        inAmountRange[i] = Num2Bits(128);
        inAmountRange[i].in <== inAmount[i];

        // C2 fix: asset consistency — non-dummy input notes must match publicAsset
        inAmount[i] * (inAsset[i] - publicAsset) === 0;

        // ChainId consistency — non-dummy input notes must match public chainId
        inAmount[i] * (inChainId[i] - chainId) === 0;

        // 2c. Compute nullifier = Poseidon(nullifierKey, commitment, leafIndex)
        inNullifierHasher[i] = Poseidon(3);
        inNullifierHasher[i].inputs[0] <== nullifierKey;
        inNullifierHasher[i].inputs[1] <== inCommitmentHasher[i].out;
        inNullifierHasher[i].inputs[2] <== leafIndex[i];

        // 2d. Merkle proof verification
        merkleVerifier[i] = MerkleProofVerifier(TREE_DEPTH);
        merkleVerifier[i].leaf <== inCommitmentHasher[i].out;
        for (var j = 0; j < TREE_DEPTH; j++) {
            merkleVerifier[i].pathElements[j] <== pathElements[i][j];
            merkleVerifier[i].pathIndices[j] <== pathIndices[i][j];
        }

        // Skip Merkle verification for dummy notes (amount == 0)
        // Constraint: inAmount[i] * (computedRoot - merkleRoot) === 0
        inAmount[i] * (merkleVerifier[i].root - merkleRoot) === 0;

        // C1 fix: bind leafIndex to pathIndices (prevents nullifier unbinding double-spend)
        // Without this, an attacker can use valid pathIndices for Merkle proof but
        // vary leafIndex to produce different nullifiers for the same UTXO.
        var computedLeafIndex = 0;
        for (var j = 0; j < TREE_DEPTH; j++) {
            computedLeafIndex += pathIndices[i][j] * (1 << j);
        }
        leafIndex[i] === computedLeafIndex;

        // 2e. Determine if this is a dummy note
        isDummy[i] = IsZero();
        isDummy[i].in <== inAmount[i];

        // 2f. Nullifier matching with dummy handling
        // If not dummy (isDummy.out == 0): publicNullifier must equal computed nullifier
        // If dummy (isDummy.out == 1): publicNullifier must be 0
        //
        // We enforce both via:
        //   (1 - isDummy) * (publicNullifier - computedNullifier) === 0
        //   isDummy * publicNullifier === 0
        notDummy[i] <== 1 - isDummy[i].out;

        nullifierDiff[i] <== publicNullifier[i] - inNullifierHasher[i].out;
        notDummy[i] * nullifierDiff[i] === 0;

        isDummy[i].out * publicNullifier[i] === 0;
    }

    // ================================================================
    // Step 3: Process each output note
    // ================================================================
    component outCommitmentHasher[2];
    component outAmountRange[2];

    for (var j = 0; j < 2; j++) {
        // 3a. Compute output commitment = Poseidon(owner, amount, asset, chainId, blinding)
        outCommitmentHasher[j] = Poseidon(5);
        outCommitmentHasher[j].inputs[0] <== outOwner[j];
        outCommitmentHasher[j].inputs[1] <== outAmount[j];
        outCommitmentHasher[j].inputs[2] <== outAsset[j];
        outCommitmentHasher[j].inputs[3] <== outChainId[j];
        outCommitmentHasher[j].inputs[4] <== outBlinding[j];

        // 3b. Range proof: outAmount must fit in 128 bits (prevents overflow attacks)
        outAmountRange[j] = Num2Bits(128);
        outAmountRange[j].in <== outAmount[j];

        // C2 fix: asset consistency — non-dummy output notes must match publicAsset
        outAmount[j] * (outAsset[j] - publicAsset) === 0;

        // ChainId consistency — non-dummy output notes must match public chainId
        outAmount[j] * (outChainId[j] - chainId) === 0;
    }

    // 3c. Output commitment matching (public signals must match computed commitments)
    outputCommitment0 === outCommitmentHasher[0].out;
    outputCommitment1 === outCommitmentHasher[1].out;

    // ================================================================
    // Step 4: Balance conservation
    // ================================================================
    // inAmount[0] + inAmount[1] + publicAmount === outAmount[0] + outAmount[1]
    // (publicAmount is positive for deposits, field-negative for withdrawals)
    inAmount[0] + inAmount[1] + publicAmount === outAmount[0] + outAmount[1];

    // ================================================================
    // Step 5: I1 fix — Bind recipient to proof (prevent relay-time substitution)
    // ================================================================
    // Compute a binding hash: Poseidon(recipient, publicAsset, publicAmount)
    // This forces the verifier to accept only the exact (recipient, asset, amount)
    // triple that the prover committed to. Any change invalidates the proof.
    component recipientBinding = Poseidon(3);
    recipientBinding.inputs[0] <== recipient;
    recipientBinding.inputs[1] <== publicAsset;
    recipientBinding.inputs[2] <== publicAmount;

    // Constrain that this hash is non-trivially computed (not optimized away).
    // The binding hash is derived from public signals, so the verifier enforces
    // that the prover's chosen (recipient, publicAsset, publicAmount) matches
    // exactly what was used in proof generation.
    signal recipientBindingCheck;
    recipientBindingCheck <== recipientBinding.out;
}

component main {public [merkleRoot, nullifier0, nullifier1, outputCommitment0, outputCommitment1, publicAmount, publicAsset, recipient, chainId]} = DustV2Transaction(20);
