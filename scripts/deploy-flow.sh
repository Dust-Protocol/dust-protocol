#!/usr/bin/env bash
# Deploy Dust Protocol contracts to Flow EVM Testnet (chain ID 545)
# Usage: DEPLOYER_PRIVATE_KEY=<key> ./scripts/deploy-flow.sh
#
# Flow EVM Testnet:
#   RPC: https://testnet.evm.nodes.onflow.org
#   Chain ID: 545
#   Explorer: https://evm-testnet.flowscan.io
set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────

FLOW_RPC="https://testnet.evm.nodes.onflow.org"
FLOW_CHAIN_ID=545
FLOW_EXPLORER="https://evm-testnet.flowscan.io"
OUTFILE="$(dirname "$0")/../deployments/flow-testnet.json"

: "${DEPLOYER_PRIVATE_KEY:?Set DEPLOYER_PRIVATE_KEY env var}"

# ERC-4337 EntryPoint v0.6 canonical address (deployed via CREATE2 on all EVM chains)
ENTRY_POINT="0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"

COMMON_FLAGS="--rpc-url $FLOW_RPC --private-key $DEPLOYER_PRIVATE_KEY --legacy"

# ─── Helpers ──────────────────────────────────────────────────────────────────

extract_address() {
  # forge create outputs "Deployed to: 0x..." — extract the address
  grep "Deployed to:" | awk '{print $3}'
}

log() {
  echo ""
  echo "════════════════════════════════════════════════════════"
  echo "  $1"
  echo "════════════════════════════════════════════════════════"
}

# ─── Pre-flight ───────────────────────────────────────────────────────────────

DEPLOYER_ADDR=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")
BALANCE=$(cast balance "$DEPLOYER_ADDR" --rpc-url "$FLOW_RPC" --ether 2>/dev/null || echo "unknown")
echo "Deployer: $DEPLOYER_ADDR"
echo "Balance:  $BALANCE FLOW"
echo "Chain:    Flow EVM Testnet ($FLOW_CHAIN_ID)"
echo ""

mkdir -p "$(dirname "$OUTFILE")"

# ─── 1. FflonkVerifier (transaction circuit proof verifier) ───────────────────

log "1/8 — Deploying FflonkVerifier"
VERIFIER_ADDR=$(
  forge create contracts/dustpool/src/FFLONKVerifier.sol:FflonkVerifier \
    $COMMON_FLAGS 2>&1 | extract_address
)
echo "FflonkVerifier: $VERIFIER_ADDR"

# ─── 2. FflonkSplitVerifier (2-in-8-out split circuit verifier) ──────────────

log "2/8 — Deploying FflonkSplitVerifier"
SPLIT_VERIFIER_ADDR=$(
  forge create contracts/dustpool/src/FFLONKSplitVerifier.sol:FflonkSplitVerifier \
    $COMMON_FLAGS 2>&1 | extract_address
)
echo "FflonkSplitVerifier: $SPLIT_VERIFIER_ADDR"

# ─── 3. TestnetComplianceOracle (admin-configurable blocklist for testnets) ───

log "3/8 — Deploying TestnetComplianceOracle"
COMPLIANCE_ORACLE_ADDR=$(
  forge create contracts/dustpool/src/TestnetComplianceOracle.sol:TestnetComplianceOracle \
    $COMMON_FLAGS 2>&1 | extract_address
)
echo "TestnetComplianceOracle: $COMPLIANCE_ORACLE_ADDR"

# ─── 4. DustPoolV2 (main privacy pool — constructor: verifier, splitVerifier, complianceOracle) ─

log "4/8 — Deploying DustPoolV2"
DUSTPOOL_V2_ADDR=$(
  forge create contracts/dustpool/src/DustPoolV2.sol:DustPoolV2 \
    $COMMON_FLAGS \
    --constructor-args "$VERIFIER_ADDR" "$SPLIT_VERIFIER_ADDR" "$COMPLIANCE_ORACLE_ADDR" \
    2>&1 | extract_address
)
echo "DustPoolV2: $DUSTPOOL_V2_ADDR"

# Grant deployer as relayer so the relayer can post Merkle roots and relay withdrawals
log "4b — Setting deployer as relayer on DustPoolV2"
cast send "$DUSTPOOL_V2_ADDR" \
  "setRelayer(address,bool)" "$DEPLOYER_ADDR" true \
  --rpc-url "$FLOW_RPC" --private-key "$DEPLOYER_PRIVATE_KEY" --legacy
echo "Relayer set: $DEPLOYER_ADDR"

# ─── 5. ERC5564Announcer (stealth address payment announcements) ──────────────

log "5/8 — Deploying ERC5564Announcer (StealthAnnouncer)"
ANNOUNCER_ADDR=$(
  forge create contracts/ERC5564Announcer.sol:ERC5564Announcer \
    $COMMON_FLAGS 2>&1 | extract_address
)
echo "ERC5564Announcer: $ANNOUNCER_ADDR"

# ─── 6. ERC6538Registry (stealth meta-address registry) ──────────────────────

log "6/8 — Deploying ERC6538Registry"
REGISTRY_ADDR=$(
  forge create contracts/ERC6538Registry.sol:ERC6538Registry \
    $COMMON_FLAGS 2>&1 | extract_address
)
echo "ERC6538Registry: $REGISTRY_ADDR"

# ─── 7. StealthAccountFactory (CREATE2 deployer for ERC-4337 stealth accounts) ─
# Constructor arg: IEntryPoint address (canonical v0.6)
# NOTE: Requires EntryPoint to be deployed on Flow EVM. If not present, this step
#       will succeed but createAccount() calls will revert until EntryPoint is live.

log "7/8 — Deploying StealthAccountFactory"
ACCOUNT_FACTORY_ADDR=$(
  forge create contracts/wallet/src/StealthAccountFactory.sol:StealthAccountFactory \
    $COMMON_FLAGS \
    --constructor-args "$ENTRY_POINT" \
    2>&1 | extract_address
)
echo "StealthAccountFactory: $ACCOUNT_FACTORY_ADDR"

# ─── 8. DustPaymaster (ERC-4337 verifying paymaster for gas sponsorship) ─────
# Constructor args: IEntryPoint, verifyingSigner (deployer acts as initial signer)

log "8/8 — Deploying DustPaymaster"
PAYMASTER_ADDR=$(
  forge create contracts/wallet/src/DustPaymaster.sol:DustPaymaster \
    $COMMON_FLAGS \
    --constructor-args "$ENTRY_POINT" "$DEPLOYER_ADDR" \
    2>&1 | extract_address
)
echo "DustPaymaster: $PAYMASTER_ADDR"

# ─── Save addresses to JSON ──────────────────────────────────────────────────

log "Saving deployment addresses"

cat > "$OUTFILE" <<EOF
{
  "chain": "Flow EVM Testnet",
  "chainId": $FLOW_CHAIN_ID,
  "rpc": "$FLOW_RPC",
  "explorer": "$FLOW_EXPLORER",
  "deployer": "$DEPLOYER_ADDR",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contracts": {
    "FflonkVerifier": "$VERIFIER_ADDR",
    "FflonkSplitVerifier": "$SPLIT_VERIFIER_ADDR",
    "TestnetComplianceOracle": "$COMPLIANCE_ORACLE_ADDR",
    "DustPoolV2": "$DUSTPOOL_V2_ADDR",
    "ERC5564Announcer": "$ANNOUNCER_ADDR",
    "ERC6538Registry": "$REGISTRY_ADDR",
    "StealthAccountFactory": "$ACCOUNT_FACTORY_ADDR",
    "DustPaymaster": "$PAYMASTER_ADDR",
    "EntryPoint": "$ENTRY_POINT"
  },
  "verification": {
    "note": "Flow EVM Testnet uses Blockscout at evm-testnet.flowscan.io. Verify via Blockscout API or UI.",
    "commands": [
      "forge verify-contract $VERIFIER_ADDR contracts/dustpool/src/FFLONKVerifier.sol:FflonkVerifier --chain-id $FLOW_CHAIN_ID --verifier blockscout --verifier-url https://evm-testnet.flowscan.io/api",
      "forge verify-contract $SPLIT_VERIFIER_ADDR contracts/dustpool/src/FFLONKSplitVerifier.sol:FflonkSplitVerifier --chain-id $FLOW_CHAIN_ID --verifier blockscout --verifier-url https://evm-testnet.flowscan.io/api",
      "forge verify-contract $COMPLIANCE_ORACLE_ADDR contracts/dustpool/src/TestnetComplianceOracle.sol:TestnetComplianceOracle --chain-id $FLOW_CHAIN_ID --verifier blockscout --verifier-url https://evm-testnet.flowscan.io/api",
      "forge verify-contract $DUSTPOOL_V2_ADDR contracts/dustpool/src/DustPoolV2.sol:DustPoolV2 --chain-id $FLOW_CHAIN_ID --verifier blockscout --verifier-url https://evm-testnet.flowscan.io/api --constructor-args $(cast abi-encode 'constructor(address,address,address)' $VERIFIER_ADDR $SPLIT_VERIFIER_ADDR $COMPLIANCE_ORACLE_ADDR)",
      "forge verify-contract $ANNOUNCER_ADDR contracts/ERC5564Announcer.sol:ERC5564Announcer --chain-id $FLOW_CHAIN_ID --verifier blockscout --verifier-url https://evm-testnet.flowscan.io/api",
      "forge verify-contract $REGISTRY_ADDR contracts/ERC6538Registry.sol:ERC6538Registry --chain-id $FLOW_CHAIN_ID --verifier blockscout --verifier-url https://evm-testnet.flowscan.io/api",
      "forge verify-contract $ACCOUNT_FACTORY_ADDR contracts/wallet/src/StealthAccountFactory.sol:StealthAccountFactory --chain-id $FLOW_CHAIN_ID --verifier blockscout --verifier-url https://evm-testnet.flowscan.io/api --constructor-args $(cast abi-encode 'constructor(address)' $ENTRY_POINT)",
      "forge verify-contract $PAYMASTER_ADDR contracts/wallet/src/DustPaymaster.sol:DustPaymaster --chain-id $FLOW_CHAIN_ID --verifier blockscout --verifier-url https://evm-testnet.flowscan.io/api --constructor-args $(cast abi-encode 'constructor(address,address)' $ENTRY_POINT $DEPLOYER_ADDR)"
    ]
  }
}
EOF

echo ""
echo "Addresses saved to: $OUTFILE"

# ─── Summary ──────────────────────────────────────────────────────────────────

log "Deployment Complete — Flow EVM Testnet (chain $FLOW_CHAIN_ID)"
echo ""
echo "  FflonkVerifier:           $VERIFIER_ADDR"
echo "  FflonkSplitVerifier:      $SPLIT_VERIFIER_ADDR"
echo "  TestnetComplianceOracle:  $COMPLIANCE_ORACLE_ADDR"
echo "  DustPoolV2:               $DUSTPOOL_V2_ADDR"
echo "  ERC5564Announcer:         $ANNOUNCER_ADDR"
echo "  ERC6538Registry:          $REGISTRY_ADDR"
echo "  StealthAccountFactory:    $ACCOUNT_FACTORY_ADDR"
echo "  DustPaymaster:            $PAYMASTER_ADDR"
echo "  EntryPoint (canonical):   $ENTRY_POINT"
echo ""
echo "Explorer: $FLOW_EXPLORER"
echo ""
echo "Next steps:"
echo "  1. Verify contracts (commands in $OUTFILE)"
echo "  2. Add Flow EVM Testnet config to src/config/chains.ts"
echo "  3. Fund the DustPaymaster with FLOW for gas sponsorship:"
echo "     cast send $PAYMASTER_ADDR --value 1ether --rpc-url $FLOW_RPC --private-key \$DEPLOYER_PRIVATE_KEY --legacy"
echo "  4. Confirm EntryPoint ($ENTRY_POINT) is deployed on Flow EVM — if not, ERC-4337 features won't work"
