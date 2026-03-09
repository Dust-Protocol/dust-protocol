# Flow EVM Testnet — Deployment Commands

**Chain ID:** 545
**RPC:** `https://testnet.evm.nodes.onflow.org`
**Explorer:** `https://evm-testnet.flowscan.io` (Blockscout)
**Native token:** FLOW

## Prerequisites

```bash
export DEPLOYER_PRIVATE_KEY="<your-deployer-private-key>"
export FLOW_RPC="https://testnet.evm.nodes.onflow.org"
export COMMON_FLAGS="--rpc-url $FLOW_RPC --private-key $DEPLOYER_PRIVATE_KEY --legacy"

# Verify deployer balance
DEPLOYER=$(cast wallet address --private-key $DEPLOYER_PRIVATE_KEY)
cast balance $DEPLOYER --rpc-url $FLOW_RPC --ether
```

> `--legacy` flag required: Flow EVM Testnet may not support EIP-1559 transactions.

---

## Deployment Order

Dependencies flow top-to-bottom. Each step lists which previous addresses it needs.

### Step 1: FflonkVerifier (transaction circuit)

**Constructor:** none
**Dependencies:** none

```bash
forge create contracts/dustpool/src/FFLONKVerifier.sol:FflonkVerifier \
  $COMMON_FLAGS
```

Save output as `$VERIFIER`.

---

### Step 2: FflonkSplitVerifier (2-in-8-out split circuit)

**Constructor:** none
**Dependencies:** none

```bash
forge create contracts/dustpool/src/FFLONKSplitVerifier.sol:FflonkSplitVerifier \
  $COMMON_FLAGS
```

Save output as `$SPLIT_VERIFIER`.

---

### Step 3: FflonkComplianceVerifier (exclusion proof circuit)

**Constructor:** none
**Dependencies:** none

```bash
forge create contracts/dustpool/src/FFLONKComplianceVerifier.sol:FflonkComplianceVerifier \
  $COMMON_FLAGS
```

Save output as `$COMPLIANCE_VERIFIER`.

---

### Step 4: TestnetComplianceOracle (admin-configurable blocklist)

**Constructor:** none (sets `admin = msg.sender`)
**Dependencies:** none

```bash
forge create contracts/dustpool/src/TestnetComplianceOracle.sol:TestnetComplianceOracle \
  $COMMON_FLAGS
```

Save output as `$COMPLIANCE_ORACLE`.

---

### Step 5: DustPoolV2 (main privacy pool)

**Constructor:** `(address _verifier, address _splitVerifier, address _complianceOracle)`
- `_verifier`: `$VERIFIER` (Step 1) — FFLONK transaction verifier, immutable, cannot be address(0)
- `_splitVerifier`: `$SPLIT_VERIFIER` (Step 2) — FFLONK split verifier, immutable, cannot be address(0)
- `_complianceOracle`: `$COMPLIANCE_ORACLE` (Step 4) — can be address(0) to disable screening

**Dependencies:** Steps 1, 2, 4

```bash
forge create contracts/dustpool/src/DustPoolV2.sol:DustPoolV2 \
  $COMMON_FLAGS \
  --constructor-args "$VERIFIER" "$SPLIT_VERIFIER" "$COMPLIANCE_ORACLE"
```

Save output as `$DUSTPOOL_V2`.

---

### Step 6: ERC5564Announcer (stealth payment announcements)

**Constructor:** none
**Dependencies:** none

```bash
forge create contracts/ERC5564Announcer.sol:ERC5564Announcer \
  $COMMON_FLAGS
```

Save output as `$ANNOUNCER`.

---

### Step 7: ERC6538Registry (stealth meta-address registry)

**Constructor:** none (computes EIP-712 DOMAIN_SEPARATOR in constructor using block.chainid)
**Dependencies:** none

```bash
forge create contracts/ERC6538Registry.sol:ERC6538Registry \
  $COMMON_FLAGS
```

Save output as `$REGISTRY`.

---

### Step 8: NameRegistryMerkle (canonical .dust name registry)

**Constructor:** none (sets `sponsor = msg.sender`, initializes Merkle tree zero hashes)
**Dependencies:** none

```bash
forge create contracts/naming/src/NameRegistryMerkle.sol:NameRegistryMerkle \
  $COMMON_FLAGS
```

Save output as `$NAME_REGISTRY`.

---

### Step 9: NameVerifier (cross-chain .dust name verifier)

**Constructor:** `(address _owner)`
- `_owner`: deployer address (relayer that syncs roots from canonical chain)

**Dependencies:** none

```bash
forge create contracts/naming/src/NameVerifier.sol:NameVerifier \
  $COMMON_FLAGS \
  --constructor-args "$DEPLOYER"
```

Save output as `$NAME_VERIFIER`.

---

### Step 10: StealthWalletFactory (CREATE2 deployer for stealth wallets)

**Constructor:** none
**Dependencies:** none

```bash
forge create contracts/wallet/src/StealthWalletFactory.sol:StealthWalletFactory \
  $COMMON_FLAGS
```

Save output as `$WALLET_FACTORY`.

---

### Step 11: StealthAccountFactory (ERC-4337 stealth account deployer)

**Constructor:** `(IEntryPoint _entryPoint)`
- `_entryPoint`: ERC-4337 EntryPoint v0.6 canonical address

**Dependencies:** EntryPoint must be deployed on Flow EVM. Canonical v0.6 address: `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`. If not deployed, the factory deploys fine but `createAccount()` calls will revert.

```bash
ENTRY_POINT="0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"

forge create contracts/wallet/src/StealthAccountFactory.sol:StealthAccountFactory \
  $COMMON_FLAGS \
  --constructor-args "$ENTRY_POINT"
```

Save output as `$ACCOUNT_FACTORY`.

---

### Step 12: DustPaymaster (ERC-4337 verifying paymaster)

**Constructor:** `(IEntryPoint _entryPoint, address _verifyingSigner)`
- `_entryPoint`: same EntryPoint as Step 11
- `_verifyingSigner`: address that signs UserOp sponsorship approvals (deployer initially)

**Dependencies:** EntryPoint (same caveat as Step 11)

```bash
forge create contracts/wallet/src/DustPaymaster.sol:DustPaymaster \
  $COMMON_FLAGS \
  --constructor-args "$ENTRY_POINT" "$DEPLOYER"
```

Save output as `$PAYMASTER`.

---

## Post-Deployment Setup

### 5a. Set deployer as relayer on DustPoolV2

The relayer posts Merkle roots and relays withdraw/transfer transactions.

```bash
cast send "$DUSTPOOL_V2" \
  "setRelayer(address,bool)" "$DEPLOYER" true \
  --rpc-url $FLOW_RPC --private-key $DEPLOYER_PRIVATE_KEY --legacy
```

### 5b. Set compliance verifier on DustPoolV2

Required for compliance-gated withdrawals. Without this, compliance proof verification is disabled (address(0)).

```bash
cast send "$DUSTPOOL_V2" \
  "setComplianceVerifier(address)" "$COMPLIANCE_VERIFIER" \
  --rpc-url $FLOW_RPC --private-key $DEPLOYER_PRIVATE_KEY --legacy
```

### 5c. Bootstrap exclusion root on DustPoolV2

Post the initial exclusion SMT root (sentinel commitment `1n` in empty tree). This root must match the value used by all other chains. Get the root from an existing deployment or compute via `scripts/bootstrap-exclusion-root.mjs`.

```bash
# Example root from existing deployments — verify this matches your exclusion SMT
EXCLUSION_ROOT="0x02c0066e5e54d52901e39e1f6e1337ab297cd61e4b02ed8e39cca6f1a1bf2543"

cast send "$DUSTPOOL_V2" \
  "updateExclusionRoot(bytes32)" "$EXCLUSION_ROOT" \
  --rpc-url $FLOW_RPC --private-key $DEPLOYER_PRIVATE_KEY --legacy
```

### 5d. Post initial Merkle root on DustPoolV2

The relayer must post the initial empty tree root before any withdrawals can verify.

```bash
# Empty Poseidon Merkle tree root (depth 20) — get from relayer or compute
cast send "$DUSTPOOL_V2" \
  "updateRoot(bytes32)" "$INITIAL_ROOT" \
  --rpc-url $FLOW_RPC --private-key $DEPLOYER_PRIVATE_KEY --legacy
```

### 8a. Set sponsor on NameRegistryMerkle (if deploying on canonical chain)

Deployer is already sponsor after construction. To change:

```bash
cast send "$NAME_REGISTRY" \
  "setSponsor(address)" "$NEW_SPONSOR" \
  --rpc-url $FLOW_RPC --private-key $DEPLOYER_PRIVATE_KEY --legacy
```

### 12a. Fund DustPaymaster for gas sponsorship

Deposit FLOW into the EntryPoint on behalf of the paymaster:

```bash
cast send "$PAYMASTER" \
  "deposit()" \
  --value 1ether \
  --rpc-url $FLOW_RPC --private-key $DEPLOYER_PRIVATE_KEY --legacy
```

### 12b. Stake DustPaymaster with EntryPoint

Required by ERC-4337 bundlers to accept the paymaster:

```bash
cast send "$PAYMASTER" \
  "addStake(uint32)" 86400 \
  --value 0.1ether \
  --rpc-url $FLOW_RPC --private-key $DEPLOYER_PRIVATE_KEY --legacy
```

---

## Verification Commands (Blockscout)

Flow EVM Testnet uses Blockscout at `evm-testnet.flowscan.io`.

```bash
FLOW_CHAIN_ID=545
VERIFIER_URL="https://evm-testnet.flowscan.io/api"
VERIFY_FLAGS="--chain-id $FLOW_CHAIN_ID --verifier blockscout --verifier-url $VERIFIER_URL"

# Step 1: FflonkVerifier (no constructor args)
forge verify-contract "$VERIFIER" \
  contracts/dustpool/src/FFLONKVerifier.sol:FflonkVerifier \
  $VERIFY_FLAGS

# Step 2: FflonkSplitVerifier (no constructor args)
forge verify-contract "$SPLIT_VERIFIER" \
  contracts/dustpool/src/FFLONKSplitVerifier.sol:FflonkSplitVerifier \
  $VERIFY_FLAGS

# Step 3: FflonkComplianceVerifier (no constructor args)
forge verify-contract "$COMPLIANCE_VERIFIER" \
  contracts/dustpool/src/FFLONKComplianceVerifier.sol:FflonkComplianceVerifier \
  $VERIFY_FLAGS

# Step 4: TestnetComplianceOracle (no constructor args)
forge verify-contract "$COMPLIANCE_ORACLE" \
  contracts/dustpool/src/TestnetComplianceOracle.sol:TestnetComplianceOracle \
  $VERIFY_FLAGS

# Step 5: DustPoolV2 (3 address constructor args)
forge verify-contract "$DUSTPOOL_V2" \
  contracts/dustpool/src/DustPoolV2.sol:DustPoolV2 \
  $VERIFY_FLAGS \
  --constructor-args $(cast abi-encode "constructor(address,address,address)" "$VERIFIER" "$SPLIT_VERIFIER" "$COMPLIANCE_ORACLE")

# Step 6: ERC5564Announcer (no constructor args)
forge verify-contract "$ANNOUNCER" \
  contracts/ERC5564Announcer.sol:ERC5564Announcer \
  $VERIFY_FLAGS

# Step 7: ERC6538Registry (no constructor args)
forge verify-contract "$REGISTRY" \
  contracts/ERC6538Registry.sol:ERC6538Registry \
  $VERIFY_FLAGS

# Step 8: NameRegistryMerkle (no constructor args)
forge verify-contract "$NAME_REGISTRY" \
  contracts/naming/src/NameRegistryMerkle.sol:NameRegistryMerkle \
  $VERIFY_FLAGS

# Step 9: NameVerifier (1 address constructor arg)
forge verify-contract "$NAME_VERIFIER" \
  contracts/naming/src/NameVerifier.sol:NameVerifier \
  $VERIFY_FLAGS \
  --constructor-args $(cast abi-encode "constructor(address)" "$DEPLOYER")

# Step 10: StealthWalletFactory (no constructor args)
forge verify-contract "$WALLET_FACTORY" \
  contracts/wallet/src/StealthWalletFactory.sol:StealthWalletFactory \
  $VERIFY_FLAGS

# Step 11: StealthAccountFactory (1 address constructor arg)
forge verify-contract "$ACCOUNT_FACTORY" \
  contracts/wallet/src/StealthAccountFactory.sol:StealthAccountFactory \
  $VERIFY_FLAGS \
  --constructor-args $(cast abi-encode "constructor(address)" "$ENTRY_POINT")

# Step 12: DustPaymaster (2 address constructor args)
forge verify-contract "$PAYMASTER" \
  contracts/wallet/src/DustPaymaster.sol:DustPaymaster \
  $VERIFY_FLAGS \
  --constructor-args $(cast abi-encode "constructor(address,address)" "$ENTRY_POINT" "$DEPLOYER")
```

---

## Contract Summary

| # | Contract | Constructor Args | Source |
|---|----------|-----------------|--------|
| 1 | FflonkVerifier | none | `contracts/dustpool/src/FFLONKVerifier.sol` |
| 2 | FflonkSplitVerifier | none | `contracts/dustpool/src/FFLONKSplitVerifier.sol` |
| 3 | FflonkComplianceVerifier | none | `contracts/dustpool/src/FFLONKComplianceVerifier.sol` |
| 4 | TestnetComplianceOracle | none (admin = msg.sender) | `contracts/dustpool/src/TestnetComplianceOracle.sol` |
| 5 | DustPoolV2 | (verifier, splitVerifier, complianceOracle) | `contracts/dustpool/src/DustPoolV2.sol` |
| 6 | ERC5564Announcer | none | `contracts/ERC5564Announcer.sol` |
| 7 | ERC6538Registry | none | `contracts/ERC6538Registry.sol` |
| 8 | NameRegistryMerkle | none (sponsor = msg.sender) | `contracts/naming/src/NameRegistryMerkle.sol` |
| 9 | NameVerifier | (owner) | `contracts/naming/src/NameVerifier.sol` |
| 10 | StealthWalletFactory | none | `contracts/wallet/src/StealthWalletFactory.sol` |
| 11 | StealthAccountFactory | (entryPoint) | `contracts/wallet/src/StealthAccountFactory.sol` |
| 12 | DustPaymaster | (entryPoint, verifyingSigner) | `contracts/wallet/src/DustPaymaster.sol` |

## Dependency Graph

```
FflonkVerifier ─────────┐
FflonkSplitVerifier ────┤
TestnetComplianceOracle ─┼──> DustPoolV2 ──> setRelayer(), setComplianceVerifier()
FflonkComplianceVerifier ─┘                    (post-deploy setup)

ERC5564Announcer        (standalone)
ERC6538Registry         (standalone)
NameRegistryMerkle      (standalone, setSponsor() optional)
NameVerifier            (needs owner address)
StealthWalletFactory    (standalone)

EntryPoint (canonical) ──┬──> StealthAccountFactory
                         └──> DustPaymaster ──> deposit(), addStake()
```

## Not Included (DustSwap)

DustSwapAdapterV2 requires a Uniswap V4 PoolManager on Flow EVM. If V4 is available:

**Constructor:** `(address poolManager_, address dustPoolV2_)` — inherits `Ownable(msg.sender)`
**Post-deploy:** `setRelayer()`, `setPriceOracle()`, `setMaxOracleDeviation()`

```bash
forge create contracts/dustswap/src/DustSwapAdapterV2.sol:DustSwapAdapterV2 \
  $COMMON_FLAGS \
  --constructor-args "$POOL_MANAGER" "$DUSTPOOL_V2"
```
