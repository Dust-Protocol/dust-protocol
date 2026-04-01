# Dust Protocol

**Private payments on EVM chains.** Stealth addresses, zero-knowledge proofs, and on-chain compliance -- built for humans and AI agents.

[Live App](https://dustprotocol.app) | [GitHub](https://github.com/Dust-Protocol/dust-protocol)

---

## What Is Dust?

Dust is a privacy layer for Ethereum and EVM-compatible chains. It combines three primitives:

**Stealth Transfers** -- Send ETH or tokens to anyone without creating an on-chain link between sender and recipient. Every payment goes to a one-time address derived through ECDH (ERC-5564 / ERC-6538). `.dust` names provide human-readable payment endpoints.

**DustPool V2 (ZK-UTXO Privacy Pool)** -- Deposit and withdraw arbitrary amounts with full privacy. A 2-in-2-out UTXO model with hidden amounts (Pedersen commitments), FFLONK proofs (no trusted setup), and an off-chain Merkle tree. A 2-in-8-out split circuit breaks withdrawals into common-sized chunks to defeat amount fingerprinting.

**Private Swaps** -- Trade ETH and USDC without on-chain traceability. Withdraw from the ZK pool, swap through a DEX, and deposit the output back -- all in a single atomic transaction verified by ZK proof.

---

## PL Genesis Hackathon: What We Built

### Flow EVM Deployment (Full Stack)

Complete Dust Protocol deployment on Flow EVM Testnet -- stealth transfers, ZK privacy pools, private swaps via PunchSwap V2, OFAC sanctions screening, and encrypted note backup.

Key additions for Flow:
- **DustSwapAdapterGeneric** -- Adapter for PunchSwap V2 (Flow has no Uniswap V4), enabling atomic private swaps with the same ZK guarantees
- **NoteAnnouncer** -- On-chain encrypted note backup for cross-device recovery
- **OFACSanctionsRegistry** -- OFAC-compliant deposit screening deployed natively on Flow
- **FHEComplianceBridge** -- Cross-chain compliance verdict relay from the fhEVM module

### Zama FHE Module (Ethereum Sepolia)

Confidential compliance using Zama's fhEVM. Sanctions screening runs entirely on encrypted data -- the oracle never sees plaintext addresses or results.

| Contract | Purpose |
|----------|---------|
| **FHEComplianceOracle** | Encrypted sanctions lookup over ciphertexts using fhEVM precompiles |
| **ConfidentialDustPool** | Privacy pool with FHE-encrypted balances (`euint64`) |
| **FHEPoolStats** | Encrypted deposit/withdrawal analytics with homomorphic addition |
| **FHEComplianceBridge** | Caches decrypted verdicts, relays cross-chain to DustPoolV2 |

### Protocol Labs Infrastructure

- **Storacha (IPFS + Filecoin)** -- ZK circuit artifacts (WASM, verification keys) pinned to IPFS with content-addressed integrity verification. CID manifest tracks all artifacts with automatic fallback to CDN.
- **Encrypted Backup** -- Note data encrypted client-side (AES-256-GCM) and stored on Filecoin via Storacha for cross-device recovery.

### x402-privacy: Private Payments for AI Agents

An extension of Coinbase's [x402 HTTP payment protocol](https://github.com/coinbase/x402) for zero-knowledge payments. AI agents deposit into a ZK-UTXO pool and pay for API calls with FFLONK proofs -- the server verifies payment without ever learning who paid.

```
Agent -> GET /api/data
Server -> 402 Payment Required (scheme: "shielded")
Agent -> [generates FFLONK proof] -> GET /api/data + X-PAYMENT: <proof>
Server -> 200 OK
```

See [`packages/x402-privacy`](packages/x402-privacy) for the SDK.

---

## Multi-Chain Deployment

| Network | Chain ID | DustPool V2 | Private Swaps | Compliance | Explorer |
|---------|----------|:-----------:|:-------------:|:----------:|----------|
| Flow EVM Testnet | `545` | Yes | Yes (PunchSwap) | Yes (OFAC + FHE) | [flowscan.io](https://evm-testnet.flowscan.io) |
| Ethereum Sepolia | `11155111` | Yes | Yes (Uniswap V4) | FHE module | [etherscan.io](https://sepolia.etherscan.io) |
| Base Sepolia | `84532` | Yes | Yes (Uniswap V4) | Yes | [basescan.org](https://sepolia.basescan.org) |
| Arbitrum Sepolia | `421614` | Yes | Yes (Uniswap V4) | Yes | [arbiscan.io](https://sepolia.arbiscan.io) |
| OP Sepolia | `11155420` | Yes | No | Yes | [etherscan.io](https://sepolia-optimism.etherscan.io) |

---

## Flow EVM Testnet Contracts (Chain ID: 545)

### Core Stealth

| Contract | Address |
|----------|---------|
| ERC5564Announcer | [`0xfE55B104f6A200cbD17D0Be5a90D17a2A2a0d223`](https://evm-testnet.flowscan.io/address/0xfE55B104f6A200cbD17D0Be5a90D17a2A2a0d223) |
| ERC6538Registry | [`0x5ac18d5AdaC9b65E1Be9291A7C2cDbf33b584a3b`](https://evm-testnet.flowscan.io/address/0x5ac18d5AdaC9b65E1Be9291A7C2cDbf33b584a3b) |
| NameRegistryMerkle | [`0x2319E5B6DBb639049E98f3E4D1EE9A67E0CB46fb`](https://evm-testnet.flowscan.io/address/0x2319E5B6DBb639049E98f3E4D1EE9A67E0CB46fb) |
| NameVerifier | [`0x0d25EC7B314E4208EEa29bCDb9F6313965a99BdE`](https://evm-testnet.flowscan.io/address/0x0d25EC7B314E4208EEa29bCDb9F6313965a99BdE) |

### ERC-4337 (Gasless Claims)

| Contract | Address |
|----------|---------|
| StealthWalletFactory | [`0x97b74D21ca46c3CaB2918fF10c8418c606223638`](https://evm-testnet.flowscan.io/address/0x97b74D21ca46c3CaB2918fF10c8418c606223638) |
| StealthAccountFactory | [`0x77c3d8c2B0bb27c9A8ACCa39F2398aaa021eb776`](https://evm-testnet.flowscan.io/address/0x77c3d8c2B0bb27c9A8ACCa39F2398aaa021eb776) |
| DustPaymaster | [`0xC3c8Fa75910FED41D30221615d6875D2079179b8`](https://evm-testnet.flowscan.io/address/0xC3c8Fa75910FED41D30221615d6875D2079179b8) |

### Privacy Pool (DustPool V2)

| Contract | Address |
|----------|---------|
| DustPoolV2 | [`0x72f0bd8d014cdB045efD33311028A3013769d69F`](https://evm-testnet.flowscan.io/address/0x72f0bd8d014cdB045efD33311028A3013769d69F) |
| FflonkVerifier (9 signals) | [`0x0e4cF377fc18E46BB1184e4274367Bc0dB958573`](https://evm-testnet.flowscan.io/address/0x0e4cF377fc18E46BB1184e4274367Bc0dB958573) |
| FflonkSplitVerifier (15 signals) | [`0x75BD499f7CA8E361b7930e2881b2B3c99Aa1eea1`](https://evm-testnet.flowscan.io/address/0x75BD499f7CA8E361b7930e2881b2B3c99Aa1eea1) |
| FflonkComplianceVerifier | [`0x5779192B220876221Bc2871511FB764941314e04`](https://evm-testnet.flowscan.io/address/0x5779192B220876221Bc2871511FB764941314e04) |

### Compliance

| Contract | Address |
|----------|---------|
| OFACSanctionsRegistry | [`0x61C67B3527deE3F5861773fD3A223920953051AA`](https://evm-testnet.flowscan.io/address/0x61C67B3527deE3F5861773fD3A223920953051AA) |
| FHEComplianceBridge | [`0x4A646be6E51cF9Ecc849b7fcB5a6aCFc28321378`](https://evm-testnet.flowscan.io/address/0x4A646be6E51cF9Ecc849b7fcB5a6aCFc28321378) |

### Private Swaps (PunchSwap V2)

| Contract | Address |
|----------|---------|
| DustSwapAdapterGeneric | [`0x3E140c501A39ab9DcA569E76f902E3bd8B11366c`](https://evm-testnet.flowscan.io/address/0x3E140c501A39ab9DcA569E76f902E3bd8B11366c) |
| NoteAnnouncer | [`0x5aC74e83F2A77073975503Ba5756bB6977fBa879`](https://evm-testnet.flowscan.io/address/0x5aC74e83F2A77073975503Ba5756bB6977fBa879) |
| PunchSwap V2 Router | `0xeD53235cC3E9d2d464E9c408B95948836648870B` |
| WFLOW | `0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e` |

Full address list across all chains: [`docs/CONTRACTS.md`](docs/CONTRACTS.md)

---

## How It Works

### Stealth Key Derivation

```
wallet_signature = sign("Dust Protocol stealth key", walletAddress)
entropy = PBKDF2(wallet_signature + PIN, salt_v2, 100000 iterations, SHA-512)
spendKey = entropy[0:32]   // secp256k1 scalar
viewKey  = entropy[32:64]  // secp256k1 scalar
metaAddress = (spendKey * G, viewKey * G)  // registered on ERC-6538
```

### DustPool V2 -- UTXO Model

**Deposit:** Browser generates `spendingKey` and `nullifierKey` from wallet signature + PIN. A commitment `Poseidon(amount, asset, spendingKey, nullifierKey, randomBlinding)` is queued on-chain and inserted into the relayer's off-chain Merkle tree.

**Withdraw (2-in-2-out):** Browser fetches a Merkle proof, generates an FFLONK proof proving ownership of 2 input UTXOs, and creates 2 output UTXOs. The relayer submits on-chain -- the contract verifies the proof, marks nullifiers spent, and transfers funds. 9 public signals: `[merkleRoot, nullifier0, nullifier1, outCommitment0, outCommitment1, publicAmount, publicAsset, recipient, chainId]`.

**Split Withdraw (2-in-8-out):** Same flow but creates up to 8 output commitments. The denomination engine auto-selects optimal splits for maximum anonymity set overlap. 15 public signals.

**Compliance:** Before withdrawal, the relayer runs a ZK exclusion proof against a Sparse Merkle Tree of flagged commitments. The circuit proves the user's commitment is NOT in the sanctions set -- without revealing which commitment they hold.

### Private Swap Flow

```
1. User selects swap amount in browser
2. Browser generates FFLONK proof (proves pool membership without revealing deposit)
3. DustSwapAdapter atomically: withdraws from DustPoolV2 -> swaps on DEX -> deposits output back
4. Output lands as a fresh UTXO with no linkage to the original deposit
```

---

## Quick Start

```bash
git clone https://github.com/Dust-Protocol/dust-protocol.git
cd dust-protocol
npm install
cp .env.example .env.local
npm run dev
```

The app runs at `http://localhost:3000`. Connect a wallet and switch to any supported testnet.

### Environment Variables

```env
# Required -- relayer key for gas sponsorship
RELAYER_PRIVATE_KEY=<private-key>

# Optional -- Alchemy RPC for higher rate limits
NEXT_PUBLIC_ALCHEMY_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/<key>
NEXT_PUBLIC_ALCHEMY_BASE_SEPOLIA_RPC=https://base-sepolia.g.alchemy.com/v2/<key>
NEXT_PUBLIC_ALCHEMY_ARBITRUM_SEPOLIA_RPC=https://arb-sepolia.g.alchemy.com/v2/<key>
NEXT_PUBLIC_ALCHEMY_OP_SEPOLIA_RPC=https://opt-sepolia.g.alchemy.com/v2/<key>

# Optional -- FHE compliance module (Zama fhEVM)
NEXT_PUBLIC_FHE_CHAIN_ID=11155111
NEXT_PUBLIC_FHE_ORACLE_ADDRESS=<address>
NEXT_PUBLIC_FHE_RPC_URL=<rpc-url>
```

### Running Tests

```bash
# Solidity (Foundry)
cd contracts/dustpool && forge test

# FHE contracts (Hardhat + Zama mocked env)
cd contracts/fhe-compliance && npx hardhat test

# TypeScript
npx vitest run

# Type check
npx tsc --noEmit
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Auth | Privy (social login + embedded wallets), wagmi v2, viem v2 |
| ZK Proofs | circom, snarkjs (FFLONK + Groth16 over BN254), Poseidon hashing |
| Contracts | Solidity 0.8.20, Foundry, Uniswap V4, PunchSwap V2 |
| FHE | Zama fhEVM 0.11 (euint64, ebool, eaddress), Hardhat |
| Storage | Storacha (IPFS + Filecoin) for ZK artifacts, Cloudflare R2 CDN |
| Account Abstraction | ERC-4337, EIP-7702 |
| Standards | ERC-5564, ERC-6538, ERC-4337 |

---

## Architecture

```
src/
  app/
    page.tsx                # Landing page
    dashboard/              # Balance + pool UI
    onboarding/             # PIN setup + name registration
    swap/                   # Private swaps
    pools/                  # Pool stats
    api/v2/                 # Relayer API routes
      withdraw/             # ZK withdrawal relay
      split-withdraw/       # Split withdrawal relay
      batch-withdraw/       # Batched + shuffled withdrawals
      swap/                 # Private swap relay
      compliance/           # Exclusion compliance proofs
      fhe-compliance/       # FHE compliance endpoint
      fhe-stats/            # FHE pool statistics
      confidential-pool/    # Confidential pool operations
      tree/                 # Merkle tree root + proofs
  lib/
    stealth/                # ECDH cryptography (ERC-5564/6538)
    dustpool/v2/            # Pool contracts, relayer, compliance, proofs
    dustpool/v2/fhe/        # FHE compliance client, types, config
    filecoin/               # Storacha backup client
    ipfs/                   # ZK artifact manifest + IPFS client
    swap/zk/                # Privacy swap proof generation
  hooks/
    stealth/                # useStealthScanner, useUnifiedBalance
    dustpool/v2/            # useV2Deposit, useV2Withdraw, useV2Compliance
    swap/                   # useDustSwap, usePoolQuote

contracts/
  dustpool/                 # DustPoolV2 + FFLONK verifiers (Foundry)
    circuits/v2/            # circom circuits (Transaction, Split, Compliance)
  dustswap/                 # DustSwapHook + DustSwapAdapter
  wallet/                   # StealthWallet, StealthAccount (ERC-4337)
  fhe-compliance/           # FHE oracle + pool stats (Hardhat + Zama)

packages/
  x402-privacy/             # ZK payment SDK for AI agents (x402 extension)
```

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| Key derivation | PBKDF2 (SHA-512, 100K iterations) over wallet signature + PIN |
| Key isolation | Private keys in React refs, never serialized or sent to any server |
| ZK privacy | FFLONK proofs -- withdrawal is cryptographically unlinkable to deposit |
| Denomination privacy | 2-in-8-out split into common chunks defeats amount fingerprinting |
| Compliance | ZK exclusion proof against SMT of flagged commitments -- no commitment reveal |
| FHE compliance | Sanctions screening on encrypted data -- oracle never sees plaintext |
| Deposit screening | OFAC sanctions registry + 1-hour post-deposit cooldown |
| Cross-chain replay | Chain ID as public signal in all circuits + on-chain `block.chainid` check |
| Pool solvency | Per-asset deposit tracking, withdrawals cannot exceed total deposits |
| Note encryption | AES-256-GCM (Web Crypto API) for local and Filecoin-backed note storage |

---

## Research

- [Privacy Pools](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4563364) -- Buterin et al.
- [An Incomplete Guide to Stealth Addresses](https://vitalik.eth.limo/general/2023/01/20/stealth.html) -- Vitalik
- [ERC-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
- [ERC-6538: Stealth Meta-Address Registry](https://ethereum-magicians.org/t/stealth-meta-address-registry/12888)
- [Uniswap V4 Hooks](https://docs.uniswap.org/contracts/v4/overview)
- [Zama fhEVM](https://docs.zama.ai/fhevm)
- [x402 Payment Protocol](https://github.com/coinbase/x402)

---

## License

MIT
