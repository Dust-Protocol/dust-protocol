# @x402/privacy

> **Private payments for AI agents.** A ZK privacy extension for [x402](https://github.com/coinbase/x402) — the HTTP 402 payment protocol.

AI agents pay for API calls using zero-knowledge proofs. The server verifies payment without ever learning who paid. No accounts, no identity, no tracking.

```
Agent -> GET /api/premium-data
Server -> 402 Payment Required (scheme: "shielded")
Agent -> [generates FFLONK ZK proof in ~60s]
Agent -> GET /api/premium-data + X-PAYMENT: <proof>
Server -> 200 OK (premium data)
```

The server sees a valid proof. It never sees the payer.

## Why This Matters

AI agents are the fastest-growing class of API consumers. Today they pay with API keys tied to an identity. Every request is tracked, correlated, and profiled.

**@x402/privacy** flips this: agents deposit into a ZK-UTXO pool once, then spend from it privately. Each payment proves "I own a valid deposit" without revealing which deposit, when it was made, or who made it.

- **No API keys.** Payment is proof of funds, not proof of identity.
- **No tracking.** Payments from the same agent are unlinkable.
- **No accounts.** The protocol is the trust layer — not a platform.
- **Double-spend resistant.** Nullifiers prevent reuse. On-chain verification.
- **Chain-bound.** Proofs are tied to chainId + recipient. No replay attacks.

Built on [Dust Protocol](https://dustprotocol.xyz)'s DustPoolV2 — a ZK-UTXO privacy pool using Poseidon Merkle trees and FFLONK proofs over BN254.

## Architecture

![x402 Privacy - How Shielded Payments Work](./docs/excalidraw.png)

Three roles, matching the x402 protocol:

| Role | Package | Responsibility |
|------|---------|---------------|
| **Server** (API Provider) | `@x402/privacy/server` | Returns 402 responses with `scheme: "shielded"` payment requirements |
| **Client** (AI Agent) | `@x402/privacy/client` | Generates ZK proofs, manages UTXOs, creates payment payloads |
| **Facilitator** | `@x402/privacy/facilitator` | Verifies proofs on-chain, settles payments via `DustPoolV2.withdraw()` |

Supporting modules:

| Module | Package | Purpose |
|--------|---------|---------|
| **Tree** | `@x402/privacy/tree` | Indexes `DepositQueued` events, builds Poseidon Merkle tree, serves proofs over HTTP |
| **Crypto** | `@x402/privacy/crypto` | Poseidon hashing, Merkle tree, nullifier computation, note creation |

## Quick Demo

The self-contained hackathon demo runs the full flow in a single terminal:

```bash
npx tsx examples/hackathon-demo.ts
```

This boots an API server and facilitator in-process, initializes an AI agent with a shielded UTXO, and walks through the entire payment flow with colored, narrated output and timing.

For the full end-to-end demo with real on-chain proofs (requires circuit files):

```bash
# Terminal 1 — Tree service (indexes deposits, serves Merkle proofs)
npx tsx examples/tree-service.ts

# Terminal 2 — API server (returns 402 for unauthenticated requests)
npx tsx examples/demo-server.ts

# Terminal 3 — Facilitator (verifies proofs on-chain)
npx tsx examples/demo-facilitator.ts

# Terminal 4 — AI agent (generates ZK proof, pays privately)
npx tsx examples/demo-agent.ts

# Or run everything at once:
bash examples/run-demo.sh
```

## Package Structure

```
@x402/privacy
  src/
    client/
      scheme.ts         ShieldedEvmClientScheme — proof generation + UTXO management
      utxo-store.ts     UtxoStore — in-memory UTXO set with balance tracking
      proof-inputs.ts   Circuit input builder (2-in-2-out, dummy padding)
      register.ts       registerShieldedEvmScheme() for x402 client
    facilitator/
      scheme.ts         ShieldedEvmFacilitatorScheme — verify + settle
      verify.ts         On-chain verification (root, nullifier, amount, chain, recipient)
      settle.ts         DustPoolV2.withdraw() settlement
      register.ts       registerShieldedEvmScheme() for x402 facilitator
      types.ts          FacilitatorEvmSigner interface
    server/
      scheme.ts         ShieldedEvmServerScheme — price parsing + requirement enhancement
      register.ts       registerShieldedEvmScheme() for x402 server
    tree/
      indexer.ts        TreeIndexer — syncs DepositQueued events, builds Merkle tree
      client.ts         TreeClient — HTTP client for tree service
      service.ts        createTreeRouter() — Express router factory
      types.ts          TreeConfig, response types
    crypto/
      poseidon.ts       poseidonHash, computeNoteCommitment, computeAssetId, computeOwnerPubKey
      nullifier.ts      computeNullifier
      note.ts           createNote, createDummyNote, generateBlinding
      merkle.ts         MerkleTree (depth-20, Poseidon, root history)
      types.ts          NoteV2, NoteCommitmentV2, V2Keys, MerkleProof
    types.ts            ShieldedPayload, ShieldedExtra
    constants.ts        Pool addresses, verifier addresses, ABI, event definitions
    index.ts            Barrel exports
  circuits/
    DustV2Transaction.wasm
    verification_key.json
  examples/
    hackathon-demo.ts   Self-contained demo (single script, colored output)
    demo-server.ts      Express API server with 402 paywall
    demo-agent.ts       AI agent that pays privately
    demo-facilitator.ts ZK proof verifier + on-chain settler
    tree-service.ts     Standalone Merkle tree indexer
    run-demo.sh         Runs all 4 components together
    full-demo/          Full E2E demo with real on-chain deposits
```

## Supported Networks

| Network | Chain ID | DustPoolV2 | USDC | Status |
|---------|----------|-----------|------|--------|
| Base Sepolia | 84532 | `0x17f52f01ffcB6d3C376b2b789314808981cebb16` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | Live |
| Ethereum Sepolia | 11155111 | `0x3cbf3459e7E0E9Fd2fd86a28c426CED2a60f023f` | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | Live |

Networks are identified using [CAIP-2](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md) format: `eip155:<chainId>`.

## Installation

```bash
npm install @x402/privacy
```

Peer dependency: `@x402/core >= 2.0.0`

## Prerequisites

- **Node.js 18+**
- **Funded UTXO** in DustPoolV2 for the agent's spending key (deposit USDC first)
- **Circuit files**: `DustV2Transaction.wasm` and `DustV2Transaction.zkey` (included in the `circuits/` directory for the wasm; zkey must be downloaded separately due to size)
- **Tree service**: A running instance that indexes on-chain deposits and serves Merkle proofs

## Usage

### Server (API Provider)

Return a 402 response with the `shielded` payment scheme when no payment is present:

```typescript
import express from "express";
import { SCHEME_NAME } from "@x402/privacy";

const app = express();

app.get("/api/premium-data", (req, res) => {
  const payment = req.headers["x-payment"];

  if (!payment) {
    res.status(402).json({
      x402Version: 2,
      accepts: [
        {
          scheme: SCHEME_NAME,
          network: "eip155:84532",
          amount: "100000", // 0.10 USDC (6 decimals)
          asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          payTo: "0xYOUR_ADDRESS_HERE",
          maxTimeoutSeconds: 300,
          extra: {
            dustPoolV2: "0x17f52f01ffcB6d3C376b2b789314808981cebb16",
            merkleRoot: "0",
            treeDepth: 20,
            treeServiceUrl: "https://tree.dustprotocol.xyz",
            supportedAssets: [
              "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            ],
          },
        },
      ],
    });
    return;
  }

  res.json({ data: "premium content" });
});

app.listen(3000);
```

With the x402 server registration helper:

```typescript
import { registerShieldedEvmScheme } from "@x402/privacy/server";

registerShieldedEvmScheme(server, {
  networks: ["eip155:84532"],
});
```

### Client (AI Agent)

Generate a ZK payment when the server responds with 402:

```typescript
import { ShieldedEvmClientScheme } from "@x402/privacy/client";
import { computeOwnerPubKey, computeAssetId, computeNoteCommitment } from "@x402/privacy/crypto";
import type { NoteCommitmentV2 } from "@x402/privacy/crypto";

// 1. Initialize client with agent's private keys
const client = new ShieldedEvmClientScheme({
  spendingKey: BigInt(process.env.SPENDING_KEY!),
  nullifierKey: BigInt(process.env.NULLIFIER_KEY!),
  treeServiceUrl: "https://tree.dustprotocol.xyz",
  wasmPath: "./circuits/DustV2Transaction.wasm",
  zkeyPath: "./circuits/DustV2Transaction.zkey",
});

// 2. Load pre-funded UTXOs (from prior DustPoolV2 deposits)
const owner = await computeOwnerPubKey(BigInt(process.env.SPENDING_KEY!));
const asset = await computeAssetId(84532, "0x036CbD53842c5426634e7929541eC2318f3dCF7e");
const note = { owner, amount: 10_000_000n, asset, chainId: 84532, blinding: 12345n };
const commitment = await computeNoteCommitment(note);

client.loadUtxos([
  { note, commitment, leafIndex: 0, spent: false },
]);

// 3. Request the API
const response = await fetch("https://api.example.com/data");

if (response.status === 402) {
  const { accepts } = await response.json();
  const shieldedOption = accepts.find((a: { scheme: string }) => a.scheme === "shielded");

  if (shieldedOption) {
    // 4. Generate ZK proof -- proves UTXO ownership without revealing the deposit
    const payment = await client.createPaymentPayload(2, shieldedOption);

    // 5. Retry with payment in X-PAYMENT header
    const encoded = Buffer.from(JSON.stringify(payment.payload)).toString("base64");
    const premium = await fetch("https://api.example.com/data", {
      headers: { "X-PAYMENT": encoded },
    });
  }
}
```

With the x402 client registration helper:

```typescript
import { registerShieldedEvmScheme } from "@x402/privacy/client";

registerShieldedEvmScheme(client, {
  spendingKey: BigInt(process.env.SPENDING_KEY!),
  nullifierKey: BigInt(process.env.NULLIFIER_KEY!),
  treeServiceUrl: "https://tree.dustprotocol.xyz",
  wasmPath: "./circuits/DustV2Transaction.wasm",
  zkeyPath: "./circuits/DustV2Transaction.zkey",
  networks: ["eip155:84532"],
});
```

### Facilitator

Verify proofs on-chain and settle payments by calling `DustPoolV2.withdraw()`:

```typescript
import { ShieldedEvmFacilitatorScheme } from "@x402/privacy/facilitator";
import type { FacilitatorEvmSigner } from "@x402/privacy/facilitator";

// The signer wraps a viem WalletClient + PublicClient
const signer: FacilitatorEvmSigner = {
  getAddresses: () => [walletClient.account.address],
  readContract: (args) => publicClient.readContract(args),
  writeContract: (args) => walletClient.writeContract(args),
  waitForTransactionReceipt: (args) => publicClient.waitForTransactionReceipt(args),
  verifyTypedData: (args) => publicClient.verifyTypedData(args),
  sendTransaction: (args) => walletClient.sendTransaction(args),
  getCode: (args) => publicClient.getCode(args),
};

const facilitator = new ShieldedEvmFacilitatorScheme(signer, {
  poolAddresses: {
    "eip155:84532": "0x17f52f01ffcB6d3C376b2b789314808981cebb16",
    "eip155:11155111": "0x3cbf3459e7E0E9Fd2fd86a28c426CED2a60f023f",
  },
  treeServiceUrl: "https://tree.dustprotocol.xyz",
  supportedAssets: {
    "eip155:84532": ["0x036CbD53842c5426634e7929541eC2318f3dCF7e"],
  },
});

// Verify: checks merkle root, nullifier, amount, chain, recipient
const verifyResult = await facilitator.verify(paymentPayload, requirements);
if (verifyResult.isValid) {
  // Settle: calls DustPoolV2.withdraw() on-chain
  const settleResult = await facilitator.settle(paymentPayload, requirements);
  // settleResult.transaction contains the tx hash
}
```

With the x402 facilitator registration helper:

```typescript
import { registerShieldedEvmScheme } from "@x402/privacy/facilitator";

registerShieldedEvmScheme(facilitator, {
  signer,
  networks: "eip155:84532",
  poolAddresses: {
    "eip155:84532": "0x17f52f01ffcB6d3C376b2b789314808981cebb16",
  },
});
```

### Tree Service

The tree service indexes `DepositQueued` events from DustPoolV2 and maintains an in-memory Poseidon Merkle tree. Both clients and facilitators query it for Merkle proofs.

**Run the standalone service:**

```typescript
import express from "express";
import { TreeIndexer } from "@x402/privacy/tree";

const indexer = new TreeIndexer({
  rpcUrl: "https://sepolia.base.org",
  poolAddress: "0x17f52f01ffcB6d3C376b2b789314808981cebb16",
  startBlock: 0n,
});

await indexer.initialize(); // syncs all DepositQueued events, builds Merkle tree

const app = express();

app.get("/tree/root", (_, res) => {
  res.json({ root: indexer.root.toString(), leafCount: indexer.leafCount });
});

app.get("/tree/path/:leafIndex", async (req, res) => {
  const proof = await indexer.getProof(parseInt(req.params.leafIndex, 10));
  res.json({
    root: proof.root.toString(),
    pathElements: proof.pathElements.map(String),
    pathIndices: proof.pathIndices,
  });
});

app.get("/tree/commitment/:hash", (req, res) => {
  const leafIndex = indexer.lookupCommitment(req.params.hash);
  res.json({ exists: leafIndex !== undefined, leafIndex });
});

// Poll for new deposits
setInterval(() => indexer.sync(), 15_000);

app.listen(3001);
```

**Or use the built-in router factory:**

```typescript
import { createTreeRouter, TreeIndexer } from "@x402/privacy/tree";
import express from "express";

const indexer = new TreeIndexer({ rpcUrl, poolAddress });
await indexer.initialize();

const router = createTreeRouter({
  indexer,
  createRouter: () => express.Router(),
});

app.use("/tree", router);
```

**Query from a client:**

```typescript
import { TreeClient } from "@x402/privacy/tree";

const tree = new TreeClient("https://tree.dustprotocol.xyz");
const { root, leafCount } = await tree.getRoot();
const proof = await tree.getProof(leafIndex);
const { exists } = await tree.lookupCommitment(commitmentHex);
```

## How It Works (Technical)

### The ZK Circuit

The FFLONK proof is generated from a **2-in-2-out UTXO circuit** (~12,400 R1CS constraints):

- **Inputs** (private): spending key, nullifier key, input notes, Merkle paths, blinding factors
- **Outputs** (public): 9 signals — merkleRoot, nullifier0, nullifier1, outputCommitment0, outputCommitment1, publicAmount, publicAsset, recipient, chainId

The proof proves:
1. The prover knows the preimage of a note commitment in the Merkle tree
2. The nullifier is correctly derived from the note
3. Input amounts = output amounts + public amount (conservation)
4. The recipient and chainId match the payment requirements

### Proof System: FFLONK

FFLONK produces constant-size proofs (768 bytes) with no trusted setup. Verification costs ~280k gas on-chain.

### Privacy Guarantees

| Property | Mechanism |
|----------|-----------|
| Sender anonymity | Proof hides which leaf in the Merkle tree is being spent |
| Unlinkability | Different payments from the same agent use different nullifiers |
| Double-spend prevention | Nullifiers are checked on-chain before settlement |
| Replay protection | chainId is a public signal in the circuit |
| Redirect protection | recipient address is a public signal in the circuit |

## API Reference

### `ShieldedEvmClientScheme`

```typescript
new ShieldedEvmClientScheme(options: ShieldedClientOptions)
```

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `spendingKey` | `bigint` | Yes | Agent's spending private key |
| `nullifierKey` | `bigint` | Yes | Agent's nullifier derivation key |
| `treeServiceUrl` | `string` | Yes | URL of the Merkle tree service |
| `wasmPath` | `string` | No | Path to `DustV2Transaction.wasm` |
| `zkeyPath` | `string` | No | Path to `DustV2Transaction.zkey` |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `loadUtxos(notes)` | `void` | Load pre-funded UTXOs into the store |
| `getBalance(assetId)` | `bigint` | Get total unspent balance for an asset |
| `createPaymentPayload(version, requirements)` | `Promise<{x402Version, payload}>` | Generate ZK proof and return payment payload |

### `ShieldedEvmFacilitatorScheme`

```typescript
new ShieldedEvmFacilitatorScheme(signer: FacilitatorEvmSigner, options: ShieldedFacilitatorOptions)
```

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `poolAddresses` | `Record<string, Address>` | Yes | DustPoolV2 address per CAIP-2 network |
| `treeServiceUrl` | `string` | No | Tree service URL |
| `supportedAssets` | `Record<string, Address[]>` | No | Accepted token addresses per network |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `verify(payload, requirements)` | `Promise<VerifyResponse>` | Verify proof on-chain (root, nullifier, amount, chain, recipient) |
| `settle(payload, requirements)` | `Promise<SettleResponse>` | Call `DustPoolV2.withdraw()` to settle payment |
| `getExtra(network)` | `Record<string, unknown>` | Get shielded extra fields for a network |
| `getSigners(network)` | `string[]` | Get facilitator signer addresses |

`VerifyResponse`: `{ isValid: boolean; invalidReason?: string; invalidMessage?: string }`

`SettleResponse`: `{ success: boolean; transaction: string; network: string; errorReason?: string }`

### `ShieldedEvmServerScheme`

```typescript
new ShieldedEvmServerScheme()
```

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `parsePrice(price, network)` | `Promise<{amount, asset}>` | Parse `"$0.10"`, `0.10`, or `{amount, asset}` into base units |
| `enhancePaymentRequirements(reqs, kind, extensions)` | `Promise<Record>` | Merge shielded `extra` fields into payment requirements |

### `TreeIndexer`

```typescript
new TreeIndexer(config: TreeConfig)
```

| Config | Type | Required | Description |
|--------|------|----------|-------------|
| `rpcUrl` | `string` | Yes | JSON-RPC endpoint |
| `poolAddress` | `Address` | Yes | DustPoolV2 contract address |
| `startBlock` | `bigint` | No | Block to start indexing from (default: 0) |
| `pollIntervalMs` | `number` | No | Auto-poll interval (used by external callers) |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `initialize()` | `Promise<void>` | Sync all events and build the Merkle tree |
| `sync()` | `Promise<void>` | Fetch new `DepositQueued` events since last sync |
| `root` | `bigint` | Current Merkle root |
| `leafCount` | `number` | Number of leaves in the tree |
| `getProof(leafIndex)` | `Promise<MerkleProof>` | Get Merkle inclusion proof for a leaf |
| `lookupCommitment(hash)` | `number \| undefined` | Find leaf index by commitment hash |

### `TreeClient`

```typescript
new TreeClient(baseUrl: string)
```

| Method | Returns | Description |
|--------|---------|-------------|
| `getRoot()` | `Promise<{root, leafCount}>` | Fetch current root from tree service |
| `getProof(leafIndex)` | `Promise<MerkleProof>` | Fetch Merkle proof from tree service |
| `lookupCommitment(hex)` | `Promise<{exists, leafIndex?}>` | Check if commitment exists in tree |

### Crypto Functions

```typescript
import {
  poseidonHash,
  computeNoteCommitment,
  computeAssetId,
  computeOwnerPubKey,
  computeNullifier,
  createNote,
  createDummyNote,
  generateBlinding,
  MerkleTree,
} from "@x402/privacy/crypto";
```

| Function | Signature | Description |
|----------|-----------|-------------|
| `poseidonHash` | `(inputs: bigint[]) => Promise<bigint>` | Poseidon hash over BN254 |
| `computeNoteCommitment` | `(note: NoteV2) => Promise<bigint>` | `Poseidon(owner, amount, asset, chainId, blinding)` |
| `computeAssetId` | `(chainId: number, token: string) => Promise<bigint>` | `Poseidon(chainId, tokenAddress)` |
| `computeOwnerPubKey` | `(spendingKey: bigint) => Promise<bigint>` | `Poseidon(spendingKey)` |
| `computeNullifier` | `(nullifierKey: bigint, commitment: bigint, leafIndex: number) => Promise<bigint>` | `Poseidon(nullifierKey, commitment, leafIndex)` |
| `createNote` | `(owner, amount, asset, chainId) => NoteV2` | Create a note with random blinding |
| `createDummyNote` | `() => NoteV2` | Zero-valued dummy note (for circuit padding) |
| `generateBlinding` | `() => bigint` | Cryptographically random blinding factor mod BN254 |
| `MerkleTree.create` | `(depth: number) => Promise<MerkleTree>` | Create a depth-N Poseidon Merkle tree |

### Types

```typescript
// Payment payload sent in X-PAYMENT header
type ShieldedPayload = {
  proof: `0x${string}`;
  publicSignals: {
    merkleRoot: string;
    nullifier0: string;
    nullifier1: string;
    outputCommitment0: string;
    outputCommitment1: string;
    publicAmount: string;
    publicAsset: string;
    recipient: string;
    chainId: string;
  };
  encryptedNotes?: string[];
};

// Extra fields in 402 payment requirements
type ShieldedExtra = {
  dustPoolV2: `0x${string}`;
  merkleRoot: string;
  treeDepth: number;
  treeServiceUrl: string;
  supportedAssets: `0x${string}`[];
};

// UTXO note
type NoteV2 = {
  owner: bigint;    // Poseidon(spendingKey)
  amount: bigint;   // token amount in base units
  asset: bigint;    // Poseidon(chainId, tokenAddress)
  chainId: number;
  blinding: bigint; // random blinding factor
};

// Note with tree position
type NoteCommitmentV2 = {
  note: NoteV2;
  commitment: bigint; // Poseidon(owner, amount, asset, chainId, blinding)
  leafIndex: number;
  spent: boolean;
};

// Cryptographic key pair
type V2Keys = {
  spendingKey: bigint;
  nullifierKey: bigint;
};

// Merkle inclusion proof
type MerkleProof = {
  pathElements: bigint[];
  pathIndices: number[];
  root: bigint;
};
```

### Constants

```typescript
import {
  SCHEME_NAME,          // "shielded"
  POOL_ADDRESSES,       // { "eip155:84532": "0x17f5...", "eip155:11155111": "0x3cbf..." }
  VERIFIER_ADDRESSES,   // FFLONK verifier contracts per network
  DEFAULT_ASSETS,       // USDC addresses + decimals per network
  DUST_POOL_V2_ABI,     // ABI subset for withdraw, deposit, isKnownRoot, nullifiers
  DEPOSIT_QUEUED_EVENT, // DepositQueued event ABI
  BN254_FIELD_SIZE,     // BN254 scalar field modulus
  TREE_DEPTH,           // 20
  MAX_AMOUNT,           // 2^64 - 1
} from "@x402/privacy";
```

## Security

- **Private keys never leave the client.** The `spendingKey` and `nullifierKey` are used only inside `ShieldedEvmClientScheme` for proof generation. They are never sent over the network, included in payloads, or persisted.

- **Zero-knowledge proofs.** The FFLONK proof reveals nothing about which deposit the payment comes from. The server and facilitator see only the proof, nullifiers, and output commitments -- not the input note or its position in the tree.

- **Nullifiers prevent double-spending.** Each UTXO can only be spent once. The nullifier is derived from the note's commitment and leaf index, and checked against the on-chain `nullifiers` mapping before settlement.

- **Merkle root must be known on-chain.** The facilitator calls `DustPoolV2.isKnownRoot()` to verify the proof references a valid tree state. This prevents proofs against fabricated trees.

- **Chain binding.** The `chainId` is a public signal in the circuit. A proof generated for Base Sepolia cannot be replayed on Ethereum Sepolia.

- **Recipient binding.** The `recipient` address (the API provider's `payTo`) is a public signal. A proof generated for one provider cannot be redirected to another.

## License

Apache-2.0
