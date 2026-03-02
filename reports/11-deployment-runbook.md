# Multi-Chain Deployment Runbook

Deploy Dust Protocol contracts to Arbitrum Sepolia, OP Sepolia, and Base Sepolia.

## Prerequisites

```bash
export PRIVATE_KEY=<deployer_key>  # 0x8d56E94a02F06320BDc68FAfE23DEc9Ad7463496
```

Fund the deployer on each chain:
- Arbitrum Sepolia: https://faucet.quicknode.com/arbitrum/sepolia
- OP Sepolia: https://console.optimism.io/faucet
- Base Sepolia: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

## Phase 1: Core Infrastructure (per chain)

Repeat for each chain. Set `RPC_URL` and `CHAIN_ID` before starting.

### Arbitrum Sepolia
```bash
export RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
export CHAIN_ID=421614
export EXPLORER_API=https://api-sepolia.arbiscan.io/api
export EXPLORER_KEY=$ARBISCAN_API_KEY
```

### OP Sepolia
```bash
export RPC_URL=https://sepolia.optimism.io
export CHAIN_ID=11155420
export EXPLORER_API=https://api-sepolia-optimistic.etherscan.io/api
export EXPLORER_KEY=$OPTIMISM_ETHERSCAN_API_KEY
```

### Base Sepolia
```bash
export RPC_URL=https://sepolia.base.org
export CHAIN_ID=84532
export EXPLORER_API=https://api-sepolia.basescan.org/api
export EXPLORER_KEY=$BASESCAN_API_KEY
```

---

### Step 1.1: ERC-5564 Announcer

```bash
cd contracts
forge create ERC5564Announcer.sol:ERC5564Announcer \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast --slow
```

Record: `ANNOUNCER_ADDRESS=<deployed>`

Verify:
```bash
forge verify-contract $ANNOUNCER_ADDRESS ERC5564Announcer \
  --chain $CHAIN_ID --verifier-url $EXPLORER_API --etherscan-api-key $EXPLORER_KEY
```

### Step 1.2: ERC-6538 Registry

```bash
forge create ERC6538Registry.sol:ERC6538Registry \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast --slow
```

Record: `REGISTRY_ADDRESS=<deployed>`

### Step 1.3: StealthWalletFactory

```bash
cd contracts/wallet
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast --slow
```

Record: `WALLET_FACTORY_ADDRESS=<deployed>`

### Step 1.4: StealthAccountFactory (ERC-4337)

```bash
forge script script/Deploy4337.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast --slow
```

Record: `ACCOUNT_FACTORY_ADDRESS=<deployed>`

### Step 1.5: DustPaymaster

```bash
# Deploy paymaster (funds gasless claims)
# Constructor: entryPoint address
forge create src/DustPaymaster.sol:DustPaymaster \
  --constructor-args 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789 \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast --slow
```

Record: `PAYMASTER_ADDRESS=<deployed>`

Fund the paymaster:
```bash
cast send $PAYMASTER_ADDRESS --value 0.05ether \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

---

## Phase 2: DustPoolV2 (Privacy Pool)

### Step 2.1: Deploy DustPoolV2 + Verifiers

```bash
cd contracts/dustpool
forge script script/DeployV2.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast --slow
```

This deploys:
- `FflonkVerifier` (transaction circuit)
- `FflonkSplitVerifier` (split circuit)
- `FflonkComplianceVerifier` (compliance circuit)
- `TestnetComplianceOracle` (mock oracle)
- `DustPoolV2` (main pool)

Record all 5 addresses from console output:
```
VERIFIER_ADDRESS=<FflonkVerifier>
SPLIT_VERIFIER_ADDRESS=<FflonkSplitVerifier>
COMPLIANCE_VERIFIER_ADDRESS=<FflonkComplianceVerifier>
DUST_POOL_V2_ADDRESS=<DustPoolV2>
```

### Step 2.2: Verify Contracts

```bash
forge verify-contract $DUST_POOL_V2_ADDRESS DustPoolV2 \
  --chain $CHAIN_ID --verifier-url $EXPLORER_API --etherscan-api-key $EXPLORER_KEY \
  --constructor-args $(cast abi-encode "constructor(address,address,address)" \
    $VERIFIER_ADDRESS $SPLIT_VERIFIER_ADDRESS $COMPLIANCE_ORACLE_ADDRESS)
```

---

## Phase 3: Naming Registry (Optional per chain)

Only needed if `canonicalForNaming: true`. Currently only Thanos and Eth Sepolia have naming. Skip for L2s initially.

---

## Phase 4: Update Chain Config

After deploying to a chain, update `src/config/chains.ts`:

```typescript
// Example for Arbitrum Sepolia:
contracts: {
  announcer: '<ANNOUNCER_ADDRESS>',
  registry: '<REGISTRY_ADDRESS>',
  nameRegistry: '',  // No naming on L2s initially
  walletFactory: '<WALLET_FACTORY_ADDRESS>',
  legacyWalletFactory: '',
  accountFactory: '<ACCOUNT_FACTORY_ADDRESS>',
  legacyAccountFactory: '',
  entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  paymaster: '<PAYMASTER_ADDRESS>',
  dustPool: null,  // V1 not deployed on L2s
  dustPoolVerifier: null,
  subAccount7702: null,
  nameRegistryMerkle: null,
  nameVerifier: null,
  uniswapV4PoolManager: null,  // Phase 5
  uniswapV4StateView: null,
  uniswapV4Quoter: null,
  dustPoolV2: '<DUST_POOL_V2_ADDRESS>',
  dustPoolV2Verifier: '<VERIFIER_ADDRESS>',
  dustPoolV2SplitVerifier: '<SPLIT_VERIFIER_ADDRESS>',
  dustPoolV2ComplianceVerifier: '<COMPLIANCE_VERIFIER_ADDRESS>',
  dustSwapAdapterV2: null,  // Phase 5
  dustSwapVanillaPoolKey: null,
},
deploymentBlock: <BLOCK_NUMBER_OF_FIRST_DEPLOY>,
dustPoolDeploymentBlock: <BLOCK_NUMBER_OF_DUSTPOOLV2_DEPLOY>,
```

Also update `src/lib/dustpool/v2/relayer-tree.ts`:
```typescript
const V2_START_BLOCKS: Record<number, number> = {
  11155111: 10311323,
  111551119090: 6482414,
  421614: <ACTUAL_BLOCK>,
  11155420: <ACTUAL_BLOCK>,
  84532: <ACTUAL_BLOCK>,
}
```

---

## Phase 5: DustSwap (Optional, requires Uniswap V4)

DustSwap requires Uniswap V4 PoolManager on each chain. Check availability:

| Chain | V4 PoolManager | Status |
|-------|---------------|--------|
| Arbitrum Sepolia | TBD | Check Uniswap docs |
| OP Sepolia | TBD | Check Uniswap docs |
| Base Sepolia | TBD | Check Uniswap docs |

If V4 is available, use the refactored `DeploySwapAdapterV2.s.sol`:

```bash
cd contracts/dustswap
export POOL_MANAGER=<V4_POOL_MANAGER_ADDRESS>
export DUST_POOL_V2=<DUST_POOL_V2_ADDRESS>
export CHAINLINK_ETH_USD=<CHAINLINK_FEED_ADDRESS>

forge script script/DeploySwapAdapterV2.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast --slow
```

Chainlink ETH/USD feeds:
- Arbitrum Sepolia: `0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165`
- OP Sepolia: `0x61Ec26aA57019C486B10502285c5A3D4A4750AD7`
- Base Sepolia: `0x4aDC67D02Aff5D8E9a64202d8B30C0CE5412eCFe`

---

## Checklist (per chain)

- [ ] Deployer funded (≥0.1 ETH)
- [ ] ERC-5564 Announcer deployed + verified
- [ ] ERC-6538 Registry deployed + verified
- [ ] StealthWalletFactory deployed + verified
- [ ] StealthAccountFactory deployed + verified
- [ ] DustPaymaster deployed + funded
- [ ] DustPoolV2 + verifiers deployed + verified
- [ ] Relayer authorized on DustPoolV2
- [ ] `chains.ts` updated with all addresses
- [ ] `relayer-tree.ts` V2_START_BLOCKS updated
- [ ] Smoke test: deposit + withdraw on new chain
