# Flow EVM Testnet — Compliance Oracle Setup

**Chain ID:** 545
**RPC:** `https://testnet.evm.nodes.onflow.org`
**Explorer:** `https://evm-testnet.flowscan.io`

## Background

Dust uses two layers of compliance screening:

1. **Deposit screening** — On-chain. `DustPoolV2._screenDepositor()` calls `complianceOracle.isBlocked(depositor)` on every `deposit()`. If blocked, the deposit reverts.
2. **Withdrawal screening** — Two sub-layers:
   - **Relayer-side:** `screenRecipient()` in `relayer-compliance.ts` reads the oracle address from `DustPoolV2.complianceOracle()` and calls `isBlocked(recipient)`. Blocks relay if sanctioned. Fails closed (oracle errors = blocked).
   - **ZK exclusion proof:** Before `withdraw()`/`withdrawSplit()`, the relayer calls `verifyComplianceProof()` on-chain with a FFLONK proof showing the UTXO's commitment is NOT in the exclusion SMT. The contract checks `complianceVerified[nullifier]` and consumes it.

### Why TestnetComplianceOracle on Flow

Chainalysis sanctions oracle (`0x40C57923924B5c5c5455c48D93317139ADDaC8fb`) is deployed on Ethereum mainnet and select L2s. It is **not available on Flow EVM**. All testnets in this project use `TestnetComplianceOracle` — an admin-configurable blocklist with the same `IComplianceOracle.isBlocked(address)` interface.

### Existing compliance verifier addresses (other testnets)

| Chain | dustPoolV2ComplianceVerifier |
|-------|----------------------------|
| Ethereum Sepolia (11155111) | `0x52f1D503dAEB4bF49022e024BC95FBcbaF1b3D80` |
| Thanos Sepolia (111551119090) | `0xc3DD534A05D6822DE3052DfFdB262CdCe2EE6a3D` |
| Arbitrum Sepolia (421614) | `0xe6236145fddbC50439934Afb404a607Afaa14f51` |
| OP Sepolia (11155420) | `0x769810c0A461aC0f457747324b7f2fedD65963A7` |
| Base Sepolia (84532) | `0x33b72e6d7b39a32B88715b658f2248897Af2e650` |
| Flow EVM Testnet (545) | **not yet deployed** |

---

## Prerequisites

```bash
export DEPLOYER_PRIVATE_KEY="<your-deployer-private-key>"
export FLOW_RPC="https://testnet.evm.nodes.onflow.org"
export COMMON_FLAGS="--rpc-url $FLOW_RPC --private-key $DEPLOYER_PRIVATE_KEY --legacy"

DEPLOYER=$(cast wallet address --private-key $DEPLOYER_PRIVATE_KEY)
cast balance $DEPLOYER --rpc-url $FLOW_RPC --ether
```

> `--legacy` is required — Flow EVM Testnet does not support EIP-1559.

---

## Step 1: Deploy TestnetComplianceOracle

Admin-configurable blocklist. Constructor sets `admin = msg.sender`. No constructor args.

```bash
forge create contracts/dustpool/src/TestnetComplianceOracle.sol:TestnetComplianceOracle \
  $COMMON_FLAGS
```

Save output as `$COMPLIANCE_ORACLE`.

**What it does:** Provides `isBlocked(address) -> bool`. The admin (deployer) can `setBlocked(addr, true/false)` or `batchSetBlocked(addr[], bool)` to simulate sanctions. All addresses default to unblocked.

---

## Step 2: Deploy FflonkComplianceVerifier

FFLONK proof verifier for the DustV2Compliance circuit (2 public signals: `[exclusionRoot, nullifier]`). No constructor args.

```bash
forge create contracts/dustpool/src/FFLONKComplianceVerifier.sol:FflonkComplianceVerifier \
  $COMMON_FLAGS
```

Save output as `$COMPLIANCE_VERIFIER`.

---

## Step 3: Deploy DustPoolV2 (if not already deployed)

Constructor takes 3 args: `(address verifier, address splitVerifier, address complianceOracle)`.

If DustPoolV2 is already deployed on Flow (check `chains.ts`), skip to Step 4. Otherwise:

```bash
forge create contracts/dustpool/src/DustPoolV2.sol:DustPoolV2 \
  $COMMON_FLAGS \
  --constructor-args "$VERIFIER" "$SPLIT_VERIFIER" "$COMPLIANCE_ORACLE"
```

Save output as `$DUSTPOOL_V2`.

**If DustPoolV2 already exists but has `complianceOracle == address(0)`:**

```bash
cast send "$DUSTPOOL_V2" \
  "setComplianceOracle(address)" "$COMPLIANCE_ORACLE" \
  --rpc-url $FLOW_RPC --private-key $DEPLOYER_PRIVATE_KEY --legacy
```

This is an `onlyOwner` call. Setting to `address(0)` disables deposit screening.

---

## Step 4: Configure DustPoolV2

### 4a. Grant deployer as relayer

Required for `updateExclusionRoot()`, `updateRoot()`, `withdraw()`, and `verifyComplianceProof()` — all gated by `onlyRelayer`.

```bash
cast send "$DUSTPOOL_V2" \
  "setRelayer(address,bool)" "$DEPLOYER" true \
  --rpc-url $FLOW_RPC --private-key $DEPLOYER_PRIVATE_KEY --legacy
```

### 4b. Set compliance verifier on DustPoolV2

Links the FFLONK compliance proof verifier. Without this, `_checkComplianceGate()` is a no-op (skips ZK exclusion proof requirement on withdrawals).

```bash
cast send "$DUSTPOOL_V2" \
  "setComplianceVerifier(address)" "$COMPLIANCE_VERIFIER" \
  --rpc-url $FLOW_RPC --private-key $DEPLOYER_PRIVATE_KEY --legacy
```

This is an `onlyOwner` call. Emits `ComplianceVerifierUpdated(address)`.

---

## Step 5: Bootstrap the Exclusion SMT (sentinel commitment)

The exclusion Sparse Merkle Tree must have at least one entry so its root is non-zero. The contract rejects `updateExclusionRoot(bytes32(0))`. The sentinel commitment `1n` (which can never be a valid Poseidon commitment) is inserted as the initial entry.

### 5a. Compute the sentinel root

```bash
node scripts/bootstrap-exclusion-root.mjs
```

Expected output:
```
Sentinel commitment: 1
Exclusion root: 0x02c0066e5e54d52901e39e1f6e1337ab297cd61e4b02ed8e39cca6f1a1bf2543
```

This root is deterministic and matches all other chain deployments.

### 5b. Post the root on-chain

```bash
EXCLUSION_ROOT="0x02c0066e5e54d52901e39e1f6e1337ab297cd61e4b02ed8e39cca6f1a1bf2543"

cast send "$DUSTPOOL_V2" \
  "updateExclusionRoot(bytes32)" "$EXCLUSION_ROOT" \
  --rpc-url $FLOW_RPC --private-key $DEPLOYER_PRIVATE_KEY --legacy
```

This is an `onlyRelayer` call. Emits `ExclusionRootUpdated(root, index, relayer)`.

### 5c. Verify

```bash
cast call "$DUSTPOOL_V2" \
  "isKnownExclusionRoot(bytes32)(bool)" "$EXCLUSION_ROOT" \
  --rpc-url $FLOW_RPC
```

Should return `true`.

---

## Step 6: Configure the relayer for Flow

The relayer (Next.js API routes) screens deposits and withdrawals automatically once `chains.ts` is updated. No separate relayer configuration is needed.

### How it works

1. **Deposit screening:** Handled entirely on-chain by `DustPoolV2._screenDepositor()`. When a user calls `deposit()`, the contract calls `complianceOracle.isBlocked(msg.sender)`. No relayer involvement.

2. **Withdrawal recipient screening:** The relayer routes (`withdraw/route.ts`, `split-withdraw/route.ts`, `batch-withdraw/route.ts`, `transfer/route.ts`) call `screenRecipient(recipient, chainId)` from `relayer-compliance.ts`. This function:
   - Reads `DustPoolV2.complianceOracle()` address on-chain
   - Calls `oracle.isBlocked(recipient)`
   - Returns `{ blocked: true, reason }` or `{ blocked: false }`
   - Fails closed: if the oracle call throws, the recipient is blocked

3. **ZK exclusion proof:** Before withdraw, the client calls `GET /api/v2/compliance?commitment=<bigint>&chainId=545` to get a non-membership witness from the relayer's in-memory SMT. The client generates a FFLONK proof and submits via `POST /api/v2/compliance`. The relayer posts it on-chain via `verifyComplianceProof()`.

4. **Exclusion SMT auto-initialization:** On first request for chain 545, `exclusion-tree.ts` creates an in-memory SMT, inserts the sentinel commitment `1n`, and saves a checkpoint to `/tmp/dust-v2-exclusion-545.json`. This happens automatically — no manual relayer setup.

### What to update in `chains.ts`

After deploying, update `FLOW_EVM_TESTNET_CONFIG.contracts`:

```typescript
dustPoolV2: '<DustPoolV2 address>',
dustPoolV2Verifier: '<FflonkVerifier address>',
dustPoolV2SplitVerifier: '<FflonkSplitVerifier address>',
dustPoolV2ComplianceVerifier: '<FflonkComplianceVerifier address>',
```

Once `dustPoolV2` is non-null in the chain config, `getDustPoolV2Address(545)` returns the address and all relayer routes become active for Flow.

---

## Verification

### Verify contracts on Blockscout

```bash
FLOW_CHAIN_ID=545
VERIFIER_URL="https://evm-testnet.flowscan.io/api"
VERIFY_FLAGS="--chain-id $FLOW_CHAIN_ID --verifier blockscout --verifier-url $VERIFIER_URL"

forge verify-contract "$COMPLIANCE_ORACLE" \
  contracts/dustpool/src/TestnetComplianceOracle.sol:TestnetComplianceOracle \
  $VERIFY_FLAGS

forge verify-contract "$COMPLIANCE_VERIFIER" \
  contracts/dustpool/src/FFLONKComplianceVerifier.sol:FflonkComplianceVerifier \
  $VERIFY_FLAGS
```

### Smoke test the compliance oracle

```bash
# Check deployer is not blocked (should return false)
cast call "$COMPLIANCE_ORACLE" \
  "isBlocked(address)(bool)" "$DEPLOYER" \
  --rpc-url $FLOW_RPC

# Block a test address
cast send "$COMPLIANCE_ORACLE" \
  "setBlocked(address,bool)" "0x000000000000000000000000000000000000dEaD" true \
  --rpc-url $FLOW_RPC --private-key $DEPLOYER_PRIVATE_KEY --legacy

# Verify it's blocked (should return true)
cast call "$COMPLIANCE_ORACLE" \
  "isBlocked(address)(bool)" "0x000000000000000000000000000000000000dEaD" \
  --rpc-url $FLOW_RPC
```

### Verify DustPoolV2 compliance state

```bash
# Check complianceOracle is set (should return TestnetComplianceOracle address)
cast call "$DUSTPOOL_V2" "complianceOracle()(address)" --rpc-url $FLOW_RPC

# Check complianceVerifier is set (should return FflonkComplianceVerifier address)
cast call "$DUSTPOOL_V2" "complianceVerifier()(address)" --rpc-url $FLOW_RPC

# Check exclusion root is posted
cast call "$DUSTPOOL_V2" \
  "isKnownExclusionRoot(bytes32)(bool)" \
  "0x02c0066e5e54d52901e39e1f6e1337ab297cd61e4b02ed8e39cca6f1a1bf2543" \
  --rpc-url $FLOW_RPC
```
