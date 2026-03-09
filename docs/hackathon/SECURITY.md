# Dust Protocol — Security Overview

## Audit Summary

14 findings identified and resolved across three layers:

| Severity | Contract | Frontend | Circuit | Total |
|----------|----------|----------|---------|-------|
| Critical | 1        | 0        | 2       | 3     |
| High     | 2        | 0        | 0       | 2     |
| Medium   | 1        | 1        | 0       | 2     |
| Low      | 0        | 2        | 0       | 2     |
| Info     | 0        | 0        | 1       | 1     |

Additionally, a multi-chain parity audit applied 21 fixes across 5 chains (Ethereum Sepolia, Thanos Sepolia, Arbitrum Sepolia, Base Sepolia, Optimism Sepolia).

## Contract Security (`DustPoolV2.sol`)

- **Ownable2Step** — ownership transfer requires explicit acceptance by new owner, preventing accidental loss
- **Pausable** — owner can halt all deposits and withdrawals immediately
- **Reentrancy guard** — custom nonReentrant modifier on all external-call paths
- **CEI pattern** — state updates before external calls in every function (`depositERC20`, `withdraw`, `withdrawSplit`)
- **Custom errors** — 25 typed revert reasons (no string-based `require`)

## Double-Spend Prevention

- **`commitmentUsed` mapping** — each commitment can only be deposited once (prevents duplicate commitment attacks)
- **`nullifiers` mapping** — each nullifier can only be spent once
- **Nullifier zero guard** — `nullifier0 == bytes32(0)` rejected, preventing permanent slot poisoning
- **BN254 field element validation** — all 9/15 public signals checked `< FIELD_SIZE` to prevent field overflow equivalence

## Solvency & Limits

- **`totalDeposited` per asset** — tracks cumulative deposits per token; withdrawals revert with `InsufficientPoolBalance` if pool would go insolvent
- **`MAX_DEPOSIT_AMOUNT = 2^64 - 1`** — caps single deposits to match circuit range proof width
- **Root history buffer** — circular buffer of 100 roots; stale proofs expire naturally

## Cross-Chain Replay Prevention

- **`block.chainid` as public signal** — 9th signal in transaction proof, 15th in split proof; proofs are bound to the chain they were generated for
- **`Poseidon(chainId, tokenAddress)` as `publicAsset`** — asset identity includes chain, preventing cross-chain token confusion

## Compliance Layer

- **Chainalysis Oracle screening** — deposits checked against sanctions list via `IComplianceOracle.isBlocked()`
- **ZK exclusion proofs** — withdrawals require FFLONK proof that the commitment is NOT in the exclusion sparse Merkle tree (sanctions list)
- **1-hour cooldown** — post-deposit standby period; during cooldown only the original depositor can withdraw

## Frontend & Client Security

- **Private keys in React refs** — never in React state, never persisted to localStorage
- **AES-256-GCM encrypted IndexedDB** — UTXO notes encrypted at rest via `storage-crypto.ts`
- **Key clearing on disconnect** — `useV2Keys` clears all key material when wallet disconnects or address changes
- **PIN-based key derivation** — `PBKDF2(walletSignature, pin, 100K iterations)` derives stealth keys; no raw keys stored

## Relayer Hardening

- **Whitelist-only** — `onlyRelayer` modifier on `withdraw`, `withdrawSplit`, `updateRoot`
- **Rate limiting** — API-level rate limits on all relayer endpoints
- **Cross-chain nullifier guard** — relayer checks nullifier uniqueness across chains before submitting
- **Tree checkpoints** — Merkle tree state persisted with rollback capability

## Test Coverage

| Layer    | Framework | Tests  |
|----------|-----------|--------|
| Contract | Foundry   | 161    |
| Frontend | Vitest    | 263    |
| **Total**|           | **424**|

7 Foundry test suites: core pool, compliance, cross-chain, exclusion proofs, split operations, whitelist. Zero failures.

## Deployed Chains

| Chain           | DustPoolV2 | Verifier | Split Verifier |
|-----------------|------------|----------|----------------|
| Ethereum Sepolia | `0x3cbf..023f` | `0xd0f5..FD8a` | `0x472C..2120` |
| Thanos Sepolia   | `0x130e..e29`  | `0x3a8D..4dda` | `0xbcb3..Ef7`  |
| Base Sepolia     | `0x17f5..b16`  | Configured    | Configured     |
