/**
 * AI Agent — makes a private API payment using the x402 shielded scheme.
 *
 * Flow:
 *   1. Request premium data -> get 402 with scheme:"shielded"
 *   2. Select shielded option, generate FFLONK ZK proof (~66s on CPU)
 *   3. Send proof to facilitator for on-chain verification
 *   4. Retry API call with X-PAYMENT header -> get premium data
 *   5. Server never learns the payer's identity
 *
 * Prerequisites:
 *   - demo-server.ts running on port 3000
 *   - demo-facilitator.ts running on port 3002
 *   - tree-service.ts running on port 3001
 *
 * Usage:
 *   npx tsx examples/demo-agent.ts
 */
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ShieldedEvmClientScheme } from "../src/client/scheme";
import { computeAssetId, computeOwnerPubKey, computeNoteCommitment } from "../src/crypto";
import type { NoteCommitmentV2 } from "../src/crypto";
import type { ShieldedPayload } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_URL = "http://localhost:3000/api/premium-data";
const FACILITATOR_URL = "http://localhost:3002";

const CHAIN_ID = 84532;
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// ANSI colors for terminal output
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

async function main(): Promise<void> {
  console.log(`\n${C.bold}${C.cyan}=== x402 AI Agent: Private API Payment ===${C.reset}\n`);

  // In production these are derived from wallet signature + PIN via deriveV2Keys()
  const spendingKey = 42n;
  const nullifierKey = 99n;

  const client = new ShieldedEvmClientScheme({
    spendingKey,
    nullifierKey,
    treeServiceUrl: "http://localhost:3001/tree",
    wasmPath: resolve(__dirname, "../circuits/DustV2Transaction.wasm"),
    zkeyPath: resolve(
      __dirname,
      "../../../../contracts/dustpool/circuits/v2/build/DustV2Transaction.zkey",
    ),
  });

  const owner = await computeOwnerPubKey(spendingKey);
  const asset = await computeAssetId(CHAIN_ID, USDC_ADDRESS);
  const note = {
    owner,
    amount: 10_000_000n, // 10 USDC
    asset,
    chainId: CHAIN_ID,
    blinding: 12345n,
  };
  const commitment = await computeNoteCommitment(note);

  const preloadedNote: NoteCommitmentV2 = {
    note,
    commitment,
    leafIndex: 0,
    spent: false,
  };

  client.loadUtxos([preloadedNote]);

  const balanceUsdc = Number(client.getBalance(asset)) / 1e6;
  console.log(`  ${C.dim}Shielded balance: ${balanceUsdc} USDC${C.reset}\n`);

  // ── Step 1: Request premium data ──────────────────────────────────────
  console.log(`${C.bold}Step 1:${C.reset} AI Agent requests premium API endpoint...`);
  const response = await fetch(API_URL);

  if (response.status !== 402) {
    console.log(`  ${C.red}Unexpected response: ${response.status}${C.reset}`);
    return;
  }

  console.log(`  ${C.red}${C.bold}HTTP 402${C.reset} ${C.red}Payment Required${C.reset}`);
  const paymentRequired = await response.json();

  // ── Step 2: Identify shielded payment option ──────────────────────────
  console.log(`\n${C.bold}Step 2:${C.reset} Server responds with ${C.bold}scheme:"shielded"${C.reset} — ZK payment option`);

  const shieldedOption = paymentRequired.accepts.find(
    (a: { scheme: string }) => a.scheme === "shielded",
  );

  if (!shieldedOption) {
    console.log(`  ${C.red}No shielded payment option available${C.reset}`);
    return;
  }

  const priceUsdc = Number(shieldedOption.amount) / 1e6;
  console.log(`  ${C.dim}Price: ${priceUsdc} USDC (${shieldedOption.amount} base units)${C.reset}`);
  console.log(`  ${C.dim}Pay to: ${shieldedOption.payTo}${C.reset}`);
  console.log(`  ${C.dim}Pool: ${shieldedOption.extra.dustPoolV2}${C.reset}`);

  // ── Step 3: Generate ZK proof ─────────────────────────────────────────
  console.log(`\n${C.bold}Step 3:${C.reset} Agent generates FFLONK ZK proof for private payment...`);
  console.log(`  ${C.dim}Proving UTXO ownership without revealing the deposit source${C.reset}`);
  const startTime = performance.now();

  const paymentResult = await client.createPaymentPayload(2, shieldedOption);

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  console.log(`  ${C.green}${C.bold}Proof generated in ${elapsed}s${C.reset}`);

  const payload = paymentResult.payload as unknown as ShieldedPayload;
  const proofBytes = (payload.proof.length - 2) / 2;
  console.log(`  ${C.dim}Proof size: ${proofBytes} bytes (constant-size FFLONK)${C.reset}`);
  console.log(`  ${C.dim}Nullifier: ${payload.publicSignals.nullifier0.slice(0, 20)}...${C.reset}`);

  // ── Step 4: Verify with facilitator ───────────────────────────────────
  console.log(`\n${C.bold}Step 4:${C.reset} Agent sends shielded payment via X-PAYMENT header...`);
  const verifyRes = await fetch(`${FACILITATOR_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proof: payload.proof,
      publicSignals: payload.publicSignals,
      amount: shieldedOption.amount,
      network: shieldedOption.network,
      payTo: shieldedOption.payTo,
    }),
  });
  const verifyResult = await verifyRes.json();

  if (verifyResult.isValid) {
    console.log(`  ${C.green}${C.bold}Facilitator: proof VALID${C.reset}`);
  } else {
    console.log(`  ${C.yellow}Facilitator: ${verifyResult.invalidReason}${C.reset}`);
    console.log(`  ${C.dim}(Expected with demo keys / empty on-chain tree)${C.reset}`);
  }

  // ── Step 5: Retry API call with payment header ────────────────────────
  console.log(`\n${C.bold}Step 5:${C.reset} Server verifies proof and grants access...`);
  const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");
  const paidResponse = await fetch(API_URL, {
    headers: { "X-PAYMENT": paymentHeader },
  });

  if (paidResponse.ok) {
    const data = await paidResponse.json();
    console.log(`  ${C.green}${C.bold}HTTP 200 — Access Granted${C.reset}`);
    console.log(`  ${C.cyan}Premium data:${C.reset} ${JSON.stringify(data, null, 2)}`);
  } else {
    console.log(`  ${C.red}Failed: ${paidResponse.status}${C.reset}`);
  }

  console.log(`\n${C.bold}${C.magenta}Payment complete. Server never knew who paid.${C.reset}`);
  console.log(`${C.dim}The proof proves valid UTXO ownership without linking to the deposit.${C.reset}\n`);
}

main().catch(console.error);
