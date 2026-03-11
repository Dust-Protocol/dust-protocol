// V2 DustPool constants — field arithmetic and tree parameters

/** BN254 scalar field size (snark field prime) */
export const BN254_FIELD_SIZE =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n

/** Poseidon Merkle tree depth (matches on-chain V2 contract) */
export const TREE_DEPTH = 20

/** Maximum note amount: 2^128 - 1 (enforced by range proof in circuit) */
export const MAX_AMOUNT = (1n << 128n) - 1n

/** Empty leaf value in Merkle tree */
export const ZERO_VALUE = 0n

/** USD threshold for compliance cooldown enforcement (BSA/AML reporting standard) */
export const COMPLIANCE_COOLDOWN_THRESHOLD_USD = 10_000
