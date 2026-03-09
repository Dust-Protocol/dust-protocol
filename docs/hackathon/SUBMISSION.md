# Dust Protocol

**Private payments for humans and AI agents -- compliant, cross-chain, zero-knowledge.**

**Track:** Existing Code | **Focus Area:** AI & Robotics

---

## Problem

Financial privacy is a human right (UDHR Article 12), yet on-chain transactions are fully transparent by default. Every transfer, salary payment, and donation is permanently visible to anyone.

Current solutions sit at two failed extremes. Tornado Cash offered privacy with zero compliance -- it got sanctioned. Centralized exchanges offer compliance with zero privacy -- users surrender all financial data to intermediaries. Neither model is sustainable.

The missing piece: privacy that works *with* compliance, not against it.

## Solution

Dust Protocol is a privacy layer for EVM chains that combines stealth addresses, zero-knowledge proofs, and on-chain compliance screening. It supports both human wallets and autonomous AI agents.

**Core components:**

- **Stealth Addresses** (ERC-5564/6538) -- ECDH key exchange on secp256k1 generates one-time receiving addresses. Senders and recipients are unlinkable on-chain.

- **DustPoolV2** -- A ZK-UTXO privacy pool using Poseidon Merkle trees (depth 20). Deposits, withdrawals, and transfers are proven with FFLONK proofs (~12,400 constraints, no trusted setup). A 2-in-8-out split circuit breaks withdrawals into common denominations, defeating amount fingerprinting.

- **Compliance Layer** -- Chainalysis Oracle screens deposits at the contract level. ZK exclusion proofs allow users to prove they are not on sanctions lists without revealing their identity.

- **Private Swaps** -- DustSwapAdapterV2 performs atomic withdraw-swap-deposit through Uniswap V4 pools, with Chainlink oracle price verification. Users swap assets without breaking privacy.

- **x402-privacy** -- An extension to Coinbase's x402 HTTP 402 payment protocol. AI agents pay for API calls using ZK proofs. The API server never learns who is paying. Three roles (server, client, facilitator) map directly to the x402 architecture, with a Poseidon Merkle tree service for proof generation.

## What's New During Hackathon (Feb 10 - Mar 16)

- **Flow EVM deployment** -- Cross-chain expansion to Flow's EVM-compatible network
- **Filecoin encrypted note backup** -- Decentralized recovery for encrypted UTXO notes, removing single-point-of-failure risk from browser storage
- **x402-privacy package** -- Full `@x402/privacy` npm package with client, server, facilitator, tree indexer, and working demo (AI agent pays for API access privately)
- **Multi-chain parity audit** -- 9-agent audit across 5 chains, 21 security fixes applied (deposit validation, reentrancy guards, chain-scoped storage, PBKDF2 key derivation hardening)
- **Denomination privacy** -- 2-in-8-out split circuit (32K constraints) auto-splits withdrawals into common chunks

## Architecture

```
User/Agent
    |
    v
Stealth Address (ECDH, secp256k1)  -->  One-time receiving address
    |
    v
DustPoolV2 (ZK-UTXO)
  - Deposit: commitment = Poseidon(owner, amount, asset, chainId, blinding)
  - Withdraw/Transfer: FFLONK proof (2-in-2-out or 2-in-8-out split)
  - 9 public signals: merkleRoot, null0, null1, outC0, outC1, pubAmount, pubAsset, recipient, chainId
    |
    v
Compliance: Chainalysis Oracle (deposit screening) + ZK exclusion proofs
    |
    v
DustSwapAdapterV2: withdraw --> Uniswap V4 swap --> deposit (atomic, private)
    |
    v
x402-privacy: HTTP 402 + ZK proof --> AI agent pays without identity linkage
```

## Deployed Contracts

| Chain | DustPoolV2 | DustSwapAdapterV2 |
|-------|-----------|-------------------|
| Ethereum Sepolia (11155111) | `0x3cbf3459e7E0E9Fd2fd86a28c426CED2a60f023f` | `0xb91Afd19FeB4000E228243f40B8d98ea07127400` |
| Base Sepolia (84532) | `0x17f52f01ffcB6d3C376b2b789314808981cebb16` | `0x844d11bD48D85411eE8cD1a7cB0aC00672B1d516` |
| Arbitrum Sepolia (421614) | `0x07E961c0d881c1439be55e5157a3d92a3efE305d` | `0xe1Ca871aE6905eAe7B442d0AF7c5612CAE0a9B94` |
| OP Sepolia (11155420) | `0x068C9591409CCa14c891DB2bfc061923CF1EfbaB` | -- |
| Thanos Sepolia (111551119090) | `0x130eEBe65DC1B3f9639308C253F3F9e4F0bbDC29` | -- |

Full stealth infrastructure (ERC-5564 Announcer, ERC-6538 Registry, ERC-4337 factories, Paymaster) deployed on all chains. See [CONTRACTS.md](../CONTRACTS.md) for complete address list.

## Sponsor Bounties

- **Flow** -- DustPoolV2 and stealth infrastructure deployed on Flow EVM, bringing compliant privacy to the Flow ecosystem
- **Filecoin** -- Encrypted UTXO note backup on Filecoin/IPFS for decentralized key recovery, replacing fragile browser-only storage

## How to Run

```bash
git clone https://github.com/dust-protocol/dust
cd dust
cp .env.example .env   # add RPC URLs and keys
npm install
npm run dev             # starts Next.js frontend at localhost:3000
```

**x402 AI agent demo:**

```bash
cd packages/x402-privacy
npx tsx examples/tree-service.ts   # Terminal 1: Merkle tree indexer
npx tsx examples/demo-server.ts    # Terminal 2: API with 402 paywall
npx tsx examples/demo-agent.ts     # Terminal 3: AI agent pays privately
```

## Demo Video

[Link to demo video -- TBD]

## Team

[Team members -- TBD]

---

*Privacy is not about having something to hide. It is about having the right to choose what to reveal.*
