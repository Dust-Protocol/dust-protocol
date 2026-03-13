# Dust Protocol — Compliance Architecture

## Overview

Dust Protocol implements a 3-layer compliance system that screens participants against sanctions lists while preserving the privacy guarantees of the ZK-UTXO pool. Each layer operates independently so that failure of one does not disable compliance entirely.

| Layer | Where | What | Latency |
|-------|-------|------|---------|
| **1 — Chainalysis API** | Relayer (off-chain) | REST sanctions lookup before processing any transaction | ~200ms |
| **2 — On-chain Oracle** | DustPoolV2 contract | `IComplianceOracle.isBlocked()` called during deposit | 1 tx |
| **3 — ZK Exclusion Proof** | Client + contract | FFLONK proof of non-membership in sanctioned commitment SMT | ~2s client-side |

```
                     Deposit Flow                          Withdraw Flow
                     ────────────                          ─────────────
                          │                                     │
               ┌──────────▼──────────┐              ┌──────────▼──────────┐
               │  Layer 1: Chainalysis│              │  Layer 1: Chainalysis│
               │  API screening       │              │  API screening       │
               │  (relayer, fail-open)│              │  (relayer, fail-open)│
               └──────────┬──────────┘              └──────────┬──────────┘
                          │ pass                                │ pass
               ┌──────────▼──────────┐              ┌──────────▼──────────┐
               │  Layer 2: On-chain   │              │  Layer 3: ZK        │
               │  oracle screening    │              │  exclusion proof    │
               │  (contract-enforced) │              │  (contract-enforced)│
               └──────────┬──────────┘              └──────────┬──────────┘
                          │ pass                                │ valid
               ┌──────────▼──────────┐              ┌──────────▼──────────┐
               │  Deposit accepted    │              │  Withdrawal executed│
               │  + 1hr cooldown      │              │                     │
               └─────────────────────┘              └─────────────────────┘
```

---

## Layer 1: Chainalysis API Screening

**Source:** `src/lib/dustpool/v2/chainalysis-api.ts`

The relayer checks every sender address against the [Chainalysis Free Sanctions Screening API](https://public.chainalysis.com/api/v1) before processing deposits, withdrawals, transfers, and swaps. Authenticated via `X-API-Key` header when `CHAINALYSIS_API_KEY` env var is set; falls back to unauthenticated public endpoint otherwise.

### Mechanism

1. `GET /api/v1/address/{address}` returns an `identifications` array.
2. Non-empty array = sanctioned. The relayer blocks the request immediately.
3. Results are cached in-memory for 5 minutes (`CACHE_TTL_MS`).
4. Batch screening staggers requests with 100ms delay to respect rate limits.
5. Server errors (5xx) retry up to 3 times with exponential backoff (1s base).

### Fail Mode: Open

If the Chainalysis API is unreachable or returns an error, the relayer logs a warning and falls through to Layer 2/3. This is intentional: Layer 2 (deposit) and Layer 3 (withdrawal) are contract-enforced and cannot be bypassed.

### Integration Points

| Context | File | Behavior |
|---------|------|----------|
| Withdraw relayer | `api/v2/withdraw/route.ts` | Screens recipient via Chainalysis before processing |
| Split-withdraw relayer | `api/v2/split-withdraw/route.ts` | Same — recipient at `publicSignals[13]` |
| Batch-withdraw relayer | `api/v2/batch-withdraw/route.ts` | Screens each recipient; errors push to batch array |
| Swap relayer | `api/v2/swap/route.ts` | Screens adapter contract address |
| Generic swap relayer | `api/v2/swap-generic/route.ts` | Same — adapter address screening |
| Batch-swap relayer | `api/v2/batch-swap/route.ts` | Screens each swap recipient |
| Deposit status | `api/v2/deposit/status/[commitment]/route.ts` | Accepts optional `depositor` query param for screening |
| Pre-spend gate | `compliance-gate.ts` | Checks sender before any withdrawal/transfer/swap |
| React hook | `useV2Compliance.ts` | Screens connected wallet + shows compliance badge |
| Deposit screener | `deposit-screener.ts` | Dual: on-chain oracle + Chainalysis API, flags in exclusion SMT |
| Swap UI badge | `SwapV2Card.tsx` | Green/red/amber shield based on compliance status |

---

## Layer 2: On-Chain Oracle

**Source:** `contracts/dustpool/src/IComplianceOracle.sol`, `OFACSanctionsRegistry.sol`, `ChainalysisScreener.sol`

The DustPoolV2 contract holds a mutable `complianceOracle` address. When set to a non-zero address, every `deposit()`, `depositERC20()`, and `batchDeposit()` call invokes `IComplianceOracle.isBlocked(msg.sender)` before accepting funds.

### Interface

```solidity
interface IComplianceOracle {
    function isBlocked(address account) external view returns (bool);
}
```

### Implementations

**ChainalysisScreener** (mainnet/L2) — thin wrapper around the Chainalysis on-chain sanctions oracle at `0x40C57923924B5c5c5455c48D93317139ADDaC8fb`. Delegates `isBlocked()` to `ISanctionsList.isSanctioned()`.

**OFACSanctionsRegistry** (testnets or chains without Chainalysis oracle) — admin-managed registry with:
- `addSanctionedAddresses(address[])` / `removeSanctionedAddresses(address[])` for bulk updates
- Ownable2Step ownership model (no single-tx takeover)
- `sanctionedCount()` for monitoring

### Contract Integration

```
DustPoolV2.deposit()
    └── _screenDepositor(msg.sender)
            ├── oracle == address(0)? → no-op (screening disabled)
            └── oracle.isBlocked(depositor)?
                    ├── true  → revert DepositBlocked()
                    └── false → emit DepositScreened(depositor, true)
```

### Cooldown Period

After a deposit passes screening, the commitment enters a 1-hour cooldown (`COOLDOWN_PERIOD`). During this window, the depositor can only withdraw back to their own address. This mitigates deposit-then-sanction race conditions and gives the oracle time to propagate new sanctions.

### Owner Controls

```solidity
setComplianceOracle(address oracle)   // address(0) disables screening
setComplianceVerifier(address verifier) // address(0) disables ZK exclusion proofs
```

Both emit events (`ComplianceOracleUpdated`, `ComplianceVerifierUpdated`) for off-chain monitoring.

---

## Layer 3: ZK Exclusion Proofs

**Source:** `contracts/dustpool/circuits/v2/DustV2Compliance.circom`

Layer 3 enforces compliance at withdrawal time without revealing which commitment is being spent. The prover demonstrates that their commitment is NOT in an exclusion set (a Sparse Merkle Tree of flagged commitments).

### Circuit: DustV2Compliance

~6,884 R1CS constraints. FFLONK proof system (no trusted setup).

```
Public signals (2):
  - exclusionRoot    Root of the exclusion SMT (posted on-chain by relayer)
  - nullifier        Links this proof to a specific DustV2Transaction nullifier

Private inputs:
  - commitment       Note commitment being proven compliant
  - nullifierKey     User's nullifier derivation key
  - leafIndex        Leaf index in the deposit Merkle tree
  - smtSiblings[20]  SMT non-membership witness path
  - smtOldKey        Neighbor key at the queried position
  - smtOldValue      Neighbor value
  - smtIsOld0        1 = position empty, 0 = occupied by different key
```

### How It Works

```
Step 1: Nullifier Binding
  Poseidon(nullifierKey, commitment, leafIndex) === nullifier
  → Proves the prover knows the commitment's secret preimage
  → Binds this compliance proof to a specific UTXO via shared nullifier

Step 2: Non-Membership Proof
  SMTVerifier(exclusionRoot, commitment, fnc=1)
  → fnc=1 = non-inclusion mode
  → If smtIsOld0=1: the leaf position is empty (commitment was never flagged)
  → If smtIsOld0=0: a different key occupies the slot (commitment != flagged key)
```

### On-Chain Verification Flow

```
                         Client                          Relayer                          Contract
                           │                               │                                │
                           │  1. getComplianceWitness()     │                                │
                           │──────────────────────────────►│                                │
                           │  SMT siblings + oldKey/value   │                                │
                           │◄──────────────────────────────│                                │
                           │                               │                                │
                           │  2. Generate FFLONK proof      │                                │
                           │  (~6.8k constraints, ~2s)      │                                │
                           │                               │                                │
                           │  3. Local verify (sanity)      │                                │
                           │                               │                                │
                           │  4. submitComplianceProof()    │                                │
                           │──────────────────────────────►│                                │
                           │                               │  5. verifyComplianceProof()     │
                           │                               │───────────────────────────────►│
                           │                               │  ├ check exclusionRoot known    │
                           │                               │  ├ verify FFLONK proof          │
                           │                               │  └ complianceVerified[null]=true│
                           │                               │◄───────────────────────────────│
                           │                               │                                │
                           │                               │  6. withdraw() / withdrawSplit()│
                           │                               │───────────────────────────────►│
                           │                               │  ├ _checkComplianceGate()       │
                           │                               │  │  └ complianceVerified[null]? │
                           │                               │  │     true → delete + continue │
                           │                               │  │     false → revert           │
                           │                               │  └ execute withdrawal           │
                           │                               │◄───────────────────────────────│
```

The compliance flag is consumed (deleted) during withdrawal to prevent reuse. It is not bound to a specific exclusion root — staleness is mitigated by the relayer using recent roots and the 100-slot circular buffer expiring old ones.

---

## OFAC SDN Sync

**Source:** `src/lib/dustpool/v2/ofac-sdn-parser.ts`

The relayer maintains the exclusion SMT by periodically syncing sanctioned addresses from the US Treasury's SDN list.

### Pipeline

```
US Treasury SDN XML (treasury.gov/ofac/downloads/sdn.xml)
        │
        ▼
  ofac-sdn-parser.ts
  ├── Regex-based XML parsing (no heavy XML deps)
  ├── Extract <sdnEntry> blocks with Digital Currency Address - ETH
  ├── Deduplicate + EIP-55 checksum via viem getAddress()
  └── Cache parsed results for 1 hour (CACHE_TTL_MS)
        │
        ▼
  Relayer exclusion SMT
  ├── Flagged commitments stored as (key=commitment, value=1)
  ├── SMT depth 20 (matches circuit)
  └── Root posted on-chain via updateExclusionRoot()
        │
        ▼
  DustPoolV2.exclusionRoots[i]
  └── Circular buffer, 100 slots (ROOT_HISTORY_SIZE)
```

### SDN Entry Structure

The parser extracts entries matching `<idType>Digital Currency Address - ETH</idType>` and captures:
- `address` — the sanctioned wallet address
- `currency` — asset type (filtered to ETH for EVM chains)
- `name` — entity name from `<firstName>` + `<lastName>`
- `sdnId` — the `<uid>` identifier

Retries up to 3 times on server errors with exponential backoff.

---

## Fail Modes

| Layer | Failure | Behavior | Rationale |
|-------|---------|----------|-----------|
| **1 (Chainalysis API)** | API down / timeout | **Fail-open** — fall through to Layer 2/3 | Layers 2 and 3 are contract-enforced; API is a convenience pre-check |
| **2 (On-chain oracle)** | Oracle contract reverts | **Fail-closed** — deposit reverts | Depositor cannot bypass; they retry when oracle is fixed |
| **2 (On-chain oracle)** | Oracle set to address(0) | **Screening disabled** — deposits pass without check | Explicit owner decision; Layer 1 + 3 still active |
| **3 (ZK exclusion proof)** | Compliance verifier set to address(0) | **Proof requirement disabled** — withdrawals pass without compliance check | Explicit owner decision; Layer 1 + 2 still active |
| **3 (ZK exclusion proof)** | Relayer cannot serve SMT witness | **Fail-closed** — user cannot generate proof, withdrawal blocked | Relayer must be operational for withdrawals |
| **3 (ZK exclusion proof)** | Stale exclusion root | Proof against old root succeeds if root is still in the 100-slot buffer | Acceptable: root was valid when posted; new sanctions require fresh root push |
| **Relayer (recipient screening)** | RPC error checking oracle | **Fail-closed** — recipient blocked | Relayer is the only screening layer for recipients (not depositors) |
| **Cooldown** | Address sanctioned after deposit | Depositor can still withdraw to self during cooldown; third-party withdrawal blocked until cooldown expires | 1-hour window limits exposure |

---

## Deployed Addresses

### Compliance Verifiers (ZK Exclusion Proof)

| Chain | ComplianceVerifier |
|-------|-------------------|
| Ethereum Sepolia (11155111) | `0x52f1D503dAEB4bF49022e024BC95FBcbaF1b3D80` |
| Thanos Sepolia (111551119090) | `0xc3DD534A05D6822DE3052DfFdB262CdCe2EE6a3D` |
| Arbitrum Sepolia (421614) | `0xe6236145fddbC50439934Afb404a607Afaa14f51` |
| OP Sepolia (11155420) | `0x769810c0A461aC0f457747324b7f2fedD65963A7` |
| Base Sepolia (84532) | `0x33b72e6d7b39a32B88715b658f2248897Af2e650` |
| Flow EVM Testnet (545) | `0x5779192B220876221Bc2871511FB764941314e04` |

### Compliance Oracles (Deposit Screening)

| Chain | Oracle | Type |
|-------|--------|------|
| Flow EVM Testnet (545) | `0x61C67B3527deE3F5861773fD3A223920953051AA` | **OFACSanctionsRegistry** (production) |
| Flow EVM Testnet (545) | `0xACe425FC23d7594b829935EC4862f654541Bf0d3` | TestnetComplianceOracle (deprecated) |
| Ethereum Sepolia (11155111) | `0x52f1D503dAEB4bF49022e024BC95FBcbaF1b3D80` | ChainalysisScreener |
| Thanos Sepolia (111551119090) | `0xc3DD534A05D6822DE3052DfFdB262CdCe2EE6a3D` | OFACSanctionsRegistry |
| Mainnet / L2s | `0x40C57923924B5c5c5455c48D93317139ADDaC8fb` | ChainalysisScreener (wraps native oracle) |

### DustPoolV2 (Compliance-Enabled)

| Chain | DustPoolV2 | Active Oracle |
|-------|-----------|---------------|
| Ethereum Sepolia | `0x3cbf3459e7E0E9Fd2fd86a28c426CED2a60f023f` | ChainalysisScreener |
| Thanos Sepolia | `0x130eEBe65DC1B3f9639308C253F3F9e4F0bbDC29` | OFACSanctionsRegistry |
| Arbitrum Sepolia | `0x07E961c0d881c1439be55e5157a3d92a3efE305d` | TestnetMock |
| OP Sepolia | `0x068C9591409CCa14c891DB2bfc061923CF1EfbaB` | TestnetMock |
| Base Sepolia | `0x17f52f01ffcB6d3C376b2b789314808981cebb16` | TestnetMock |
| Flow EVM Testnet | `0x0deec7879dd4A80f28e2797EE1C14Bd6eEEC87aC` | **OFACSanctionsRegistry** |

---

## IPFS Anchoring (Protocol Labs Integration)

Compliance snapshots and ZK circuit artifacts are pinned to IPFS+Filecoin via [Storacha](https://storacha.network) for immutable auditability.

### OFAC Snapshot Pinning

After each `sync-ofac-sdn.ts` run, the relayer pins a JSON snapshot to IPFS containing:
- Timestamp, sanctioned address list, SDN source URL
- Exclusion SMT root posted on-chain
- CID returned as immutable audit trail

**Source:** `scripts/sync-ofac-sdn.ts`, `src/lib/dustpool/v2/deposit-screener.ts`

### ZK Circuit Artifacts on IPFS

All proof circuit WASM files and verification keys are pinned to IPFS as a censorship-resistant fallback for the R2 CDN.

| Circuit | WASM CID | VKey CID |
|---------|----------|----------|
| V1 Pool (Groth16) | `bafybeidpbi5t5ug7zvmkwakh6y7jv7zbpxhh6q6mazjzl2xyupuk6bqjpu` | `bafybeiatwejovqc3h6rps7lbx6pt4hr2blywkld3buuzyozbr3rr22rntu` |
| V2 Transaction (FFLONK) | `bafybeihzuoiaojj26o6zkyd2rxwns2ddxlddv2mpor2hvkgckv7wrjqp3m` | `bafybeie3iggjiloyayshsva7r6b642zjupscltbgbz222z7ukpboogchdq` |
| V2 Split (FFLONK 2-in-8-out) | `bafybeiel27v34zkati6wvgyiqb5a53w2twdhu6kohlyavtzkial2bkqor4` | `bafybeifkkxmg3qo5uk2wjopqh7d35kufxz7bnyyv66u4wpt4izfoeiipeq` |
| V2 Compliance (FFLONK) | `bafybeiflhu2pn4fel5niixx2chpwc4q2q5uwccuqtwrquj6wlsx5auuoxu` | `bafybeiaacfhin2bpcjoiveortblde4hb4bcbqnmplmbhcjclddmtmgzefm` |

ZKey files (76-283MB) remain on R2 CDN. Artifact loading priority: env var override → R2 CDN → IPFS gateway → local.

**Source:** `src/lib/ipfs/zk-artifact-manifest.ts`, `src/lib/dustpool/v2/zk-artifact-fallback.ts`

### Encrypted Note Backup (Lighthouse/Filecoin)

Users can back up their V2 UTXO notes to Filecoin via [Lighthouse](https://lighthouse.storage) with client-side AES-256-GCM encryption. The encryption key is derived from the user's wallet signature + PIN (same as stealth key derivation). Notes can be restored on any device with the same wallet + PIN.

**Source:** `src/lib/ipfs/lighthouse-backup.ts`

---

## Comparison to Other Protocols

| Feature | Dust Protocol | Railgun PPOI | 0xbow Privacy Pools |
|---------|--------------|-------------|---------------------|
| **Approach** | 3-layer (API + oracle + ZK exclusion) | Proof of Innocence (inclusion in "good" set) | Association sets (Vitalik's proposal) |
| **Proof direction** | Exclusion: prove NOT in bad set | Inclusion: prove membership in validated set | Inclusion: prove membership in compliant association set |
| **Sanctions source** | Chainalysis API + OFAC SDN XML + on-chain oracle | Community-maintained PPOI list | On-chain association set managers |
| **Proof system** | FFLONK (~6.8k constraints, no trusted setup) | Groth16 (trusted setup required) | Groth16 |
| **Data structure** | Sparse Merkle Tree (depth 20) for exclusion set | Linked PPOI commitments (UTXO graph walk) | Merkle tree of association set |
| **Deposit screening** | On-chain oracle (`isBlocked()`) on every deposit | No deposit screening (post-hoc PPOI) | Deposit-time association set selection |
| **Withdrawal screening** | Pre-verified ZK proof consumed at withdrawal | PPOI proof required per-transaction | Association set membership proof |
| **Cooldown** | 1 hour post-deposit | None (retroactive screening) | None |
| **Fail behavior** | Layer 1 fail-open, Layers 2/3 fail-closed | Fail-closed (no PPOI = no spend) | Fail-closed (no proof = no spend) |
| **Compliance granularity** | Per-nullifier (per-UTXO) | Per-transaction | Per-association set |
| **Admin controls** | Owner can toggle oracle + verifier independently | DAO-governed PPOI list | Set manager governance |
| **Privacy cost** | Exclusion proof reveals nothing about the commitment | PPOI reveals UTXO graph structure to verifier | Association set membership leaks set identity |

### Key Differentiators

**Exclusion vs. inclusion.** Dust uses exclusion proofs (prove you're NOT in the bad set), which means the default state is compliant. Railgun's PPOI and 0xbow require users to actively prove inclusion in a "good" set, making the default state non-compliant. Exclusion proofs are simpler and impose less burden on legitimate users.

**3-layer defense in depth.** Most protocols rely on a single compliance mechanism. Dust layers three independent systems: fast off-chain API screening catches known bad actors early, on-chain oracle provides contract-enforced deposit gating, and ZK exclusion proofs ensure withdrawal-time compliance without trusting the relayer.

**No trusted setup.** The compliance circuit uses FFLONK, which does not require a ceremony. Railgun's Groth16-based PPOI requires a trusted setup for each circuit change.
