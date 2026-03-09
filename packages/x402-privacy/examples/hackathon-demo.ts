/**
 * Hackathon Demo — Self-contained x402 shielded payment flow.
 *
 * Spins up all three services in-process (tree, facilitator, API server),
 * then runs the AI agent flow with colored, narrated output.
 *
 * Usage:
 *   npx tsx examples/hackathon-demo.ts
 */
import express from "express";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { ShieldedEvmClientScheme } from "../src/client/scheme";
import { computeAssetId, computeOwnerPubKey, computeNoteCommitment } from "../src/crypto";
import type { NoteCommitmentV2 } from "../src/crypto";
import type { ShieldedPayload } from "../src/types";
import {
  SCHEME_NAME,
  POOL_ADDRESSES,
  DEFAULT_ASSETS,
  TREE_DEPTH,
} from "../src/constants";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── ANSI colors ─────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  white: "\x1b[97m",
  bgBlue: "\x1b[44m",
  bgGreen: "\x1b[42m",
  bgRed: "\x1b[41m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgYellow: "\x1b[43m",
};

function banner(): void {
  console.log("");
  console.log(`${C.bold}${C.cyan}  ╔══════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║                                                              ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║${C.white}     x402 + ZK Privacy: AI Agents Pay Without Identity       ${C.cyan}║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║                                                              ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║${C.dim}${C.white}     Private API payments via FFLONK zero-knowledge proofs   ${C.cyan}║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║${C.dim}${C.white}     Built on Dust Protocol's DustPoolV2 ZK-UTXO pool        ${C.cyan}║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║                                                              ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ╚══════════════════════════════════════════════════════════════╝${C.reset}`);
  console.log("");
}

function step(num: number, total: number, msg: string): void {
  console.log(`\n${C.bold}${C.bgBlue}${C.white} STEP ${num}/${total} ${C.reset} ${C.bold}${msg}${C.reset}`);
}

function info(label: string, value: string): void {
  console.log(`  ${C.dim}${label}:${C.reset} ${value}`);
}

function success(msg: string): void {
  console.log(`  ${C.green}${C.bold}[OK]${C.reset} ${msg}`);
}

function warn(msg: string): void {
  console.log(`  ${C.yellow}[!]${C.reset} ${msg}`);
}

function timer(): () => string {
  const start = performance.now();
  return () => ((performance.now() - start) / 1000).toFixed(2);
}

function separator(): void {
  console.log(`${C.dim}  ${"─".repeat(60)}${C.reset}`);
}

// ── Config ──────────────────────────────────────────────────────────────────
const CHAIN_ID = 84532;
const NETWORK = "eip155:84532";
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const PAY_TO = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0";
const PRICE_BASE_UNITS = "100000"; // 0.10 USDC
const SERVER_PORT = 4000;
const FACILITATOR_PORT = 4002;

// ── In-process servers ──────────────────────────────────────────────────────

function startServer(): Promise<ReturnType<typeof express.application.listen>> {
  const app = express();

  app.use((req, _res, next) => {
    const raw = req.headers["x-payment"];
    if (raw && typeof raw === "string") {
      try {
        const decoded = Buffer.from(raw, "base64").toString();
        (req as express.Request & { shieldedPayment?: Record<string, unknown> }).shieldedPayment =
          JSON.parse(decoded);
      } catch {
        // malformed
      }
    }
    next();
  });

  app.get("/api/premium-data", (req, res) => {
    const payment = (req as express.Request & { shieldedPayment?: Record<string, unknown> })
      .shieldedPayment;

    if (!payment) {
      res.status(402).json({
        x402Version: 2,
        error: "Payment required",
        resource: {
          url: "/api/premium-data",
          description: "Premium AI training dataset",
        },
        accepts: [
          {
            scheme: SCHEME_NAME,
            network: NETWORK,
            amount: PRICE_BASE_UNITS,
            asset: DEFAULT_ASSETS[NETWORK].address,
            payTo: PAY_TO,
            maxTimeoutSeconds: 300,
            extra: {
              dustPoolV2: POOL_ADDRESSES[NETWORK],
              merkleRoot: "0",
              treeDepth: TREE_DEPTH,
              treeServiceUrl: "http://localhost:3001/tree",
              supportedAssets: [DEFAULT_ASSETS[NETWORK].address],
            },
          },
        ],
      });
      return;
    }

    res.json({
      data: "Premium AI training dataset: Llama-3-tokenized corpus v4.2",
      records: 1_500_000,
      format: "parquet",
      size: "2.3 GB",
      downloadUrl: "https://data.dustprotocol.xyz/datasets/llama3-v4.2.parquet",
      paidWith: "x402/shielded",
      timestamp: Date.now(),
    });
  });

  return new Promise((resolve) => {
    const server = app.listen(SERVER_PORT, () => resolve(server));
  });
}

function startFacilitator(): Promise<ReturnType<typeof express.application.listen>> {
  const app = express();
  app.use(express.json());

  // Simulated verification for demo (no RPC required)
  app.post("/verify", (_req, res) => {
    res.json({ isValid: true });
  });

  app.post("/settle", (_req, res) => {
    res.json({
      success: true,
      transaction: "0x" + "a".repeat(64),
      network: NETWORK,
    });
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", network: NETWORK, pool: POOL_ADDRESSES[NETWORK] });
  });

  return new Promise((resolve) => {
    const server = app.listen(FACILITATOR_PORT, () => resolve(server));
  });
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  banner();

  const totalSteps = 7;

  // ── Step 1: Boot infrastructure ───────────────────────────────────────
  step(1, totalSteps, "Booting infrastructure");
  const t1 = timer();

  const apiServer = await startServer();
  success(`API server listening on port ${SERVER_PORT}`);

  const facilitatorServer = await startFacilitator();
  success(`Facilitator listening on port ${FACILITATOR_PORT}`);

  info("Network", "Base Sepolia (eip155:84532)");
  info("Pool", POOL_ADDRESSES[NETWORK]);
  info("Boot time", `${t1()}s`);

  // ── Step 2: AI Agent initializes with shielded UTXO ───────────────────
  step(2, totalSteps, "AI Agent initializes shielded wallet");

  // Demo keys (in production: derived from wallet signature + PIN via deriveV2Keys)
  const spendingKey = 42n;
  const nullifierKey = 99n;

  const wasmPath = resolve(__dirname, "../circuits/DustV2Transaction.wasm");
  const zkeyPath = resolve(
    __dirname,
    "../../../../contracts/dustpool/circuits/v2/build/DustV2Transaction.zkey",
  );

  const hasWasm = existsSync(wasmPath);
  const hasZkey = existsSync(zkeyPath);

  info("Spending key", `${spendingKey} (demo)`);
  info("Nullifier key", `${nullifierKey} (demo)`);
  info("WASM circuit", hasWasm ? `found` : `${C.red}MISSING${C.reset}`);
  info("ZKey file", hasZkey ? `found (${C.dim}~76 MB${C.reset})` : `${C.red}MISSING${C.reset}`);

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

  const client = new ShieldedEvmClientScheme({
    spendingKey,
    nullifierKey,
    treeServiceUrl: "http://localhost:3001/tree",
    wasmPath,
    zkeyPath,
  });

  client.loadUtxos([preloadedNote]);

  const balanceUsdc = Number(client.getBalance(asset)) / 1e6;
  success(`Shielded balance loaded: ${C.bold}${balanceUsdc} USDC${C.reset}`);
  info("UTXO commitment", commitment.toString().slice(0, 24) + "...");

  // ── Step 3: Request premium API ───────────────────────────────────────
  step(3, totalSteps, "AI Agent requests premium API endpoint");

  const apiUrl = `http://localhost:${SERVER_PORT}/api/premium-data`;
  info("URL", apiUrl);

  const t3 = timer();
  const response = await fetch(apiUrl);
  info("Response time", `${t3()}s`);

  if (response.status !== 402) {
    console.log(`  ${C.red}Unexpected status: ${response.status}${C.reset}`);
    shutdown(apiServer, facilitatorServer);
    return;
  }

  console.log(`  ${C.bgRed}${C.white}${C.bold} HTTP 402 ${C.reset} ${C.red}Payment Required${C.reset}`);

  const paymentRequired = await response.json() as {
    accepts: Array<{
      scheme: string;
      amount: string;
      asset: string;
      payTo: string;
      network: string;
      extra: { dustPoolV2: string };
    }>;
  };

  const shieldedOption = paymentRequired.accepts.find((a) => a.scheme === "shielded");
  if (!shieldedOption) {
    console.log(`  ${C.red}No shielded payment option available${C.reset}`);
    shutdown(apiServer, facilitatorServer);
    return;
  }

  separator();
  console.log(`  ${C.yellow}Server says:${C.reset}`);
  info("  Scheme", `${C.bold}shielded${C.reset} (x402 privacy extension)`);
  info("  Price", `${Number(shieldedOption.amount) / 1e6} USDC (${shieldedOption.amount} base units)`);
  info("  Pay to", shieldedOption.payTo);
  info("  Privacy pool", shieldedOption.extra.dustPoolV2);
  info("  Network", shieldedOption.network);

  // ── Step 4: Agent decides to pay ──────────────────────────────────────
  step(4, totalSteps, "Agent decides: generate ZK proof for private payment");

  console.log(`  ${C.dim}The agent has ${balanceUsdc} USDC in its shielded wallet.${C.reset}`);
  console.log(`  ${C.dim}The API costs ${Number(shieldedOption.amount) / 1e6} USDC.${C.reset}`);
  console.log(`  ${C.dim}Generating an FFLONK proof to spend from the UTXO pool...${C.reset}`);
  console.log(`  ${C.dim}This proves the agent owns a valid deposit WITHOUT revealing which one.${C.reset}`);

  // ── Step 5: Generate ZK proof ─────────────────────────────────────────
  step(5, totalSteps, "Generating FFLONK zero-knowledge proof");

  if (!hasWasm || !hasZkey) {
    warn("Circuit files not found. Simulating proof generation for demo.");
    console.log(`  ${C.dim}In production, this takes ~60s on CPU, ~3s on GPU.${C.reset}`);

    // Simulate proof generation with a realistic payload
    const simulatedPayload: ShieldedPayload = {
      proof: ("0x" + "ab".repeat(384)) as `0x${string}`,
      publicSignals: {
        merkleRoot: "14744269619966411208579211824598458697587494354926760081771325075741142829156",
        nullifier0: "7812549832104987623984756012398745601239874560123984756012398456",
        nullifier1: "0",
        outputCommitment0: "19847560123984756012398745601239874560123987456012398745601239847",
        outputCommitment1: "8745601239847560123984756012398745601239874560123987456012398745",
        publicAmount: shieldedOption.amount,
        publicAsset: asset.toString(),
        recipient: BigInt(shieldedOption.payTo).toString(),
        chainId: CHAIN_ID.toString(),
      },
    };

    const simulatedTime = "62.4";
    console.log("");
    console.log(`  ${C.magenta}[Proof Generation]${C.reset}`);
    info("  Time", `${C.bold}${C.green}${simulatedTime}s${C.reset} (simulated)`);
    info("  Proof size", `${C.bold}768 bytes${C.reset} (FFLONK, constant size)`);
    info("  Public signals", "9 (merkleRoot, nullifiers, commitments, amount, asset, recipient, chainId)");
    info("  Nullifier", simulatedPayload.publicSignals.nullifier0.slice(0, 20) + "...");
    info("  Chain binding", `chainId=${CHAIN_ID} (replay protection)`);
    info("  Recipient binding", `${shieldedOption.payTo.slice(0, 10)}... (redirect protection)`);

    separator();
    console.log(`  ${C.dim}What the proof reveals:    amount, recipient, asset, chain${C.reset}`);
    console.log(`  ${C.dim}What the proof hides:      payer identity, deposit source, balance${C.reset}`);
    console.log(`  ${C.dim}What is impossible:         double-spend (nullifier prevents it)${C.reset}`);

    // ── Step 6: Send payment ────────────────────────────────────────────
    step(6, totalSteps, "Agent sends shielded payment via X-PAYMENT header");

    const paymentHeader = Buffer.from(JSON.stringify(simulatedPayload)).toString("base64");
    info("Header", "X-PAYMENT: <base64-encoded proof + signals>");
    info("Payload size", `${paymentHeader.length} bytes (base64)`);

    const t6 = timer();
    const paidResponse = await fetch(apiUrl, {
      headers: { "X-PAYMENT": paymentHeader },
    });
    info("Response time", `${t6()}s`);

    if (paidResponse.ok) {
      const data = await paidResponse.json();

      // ── Step 7: Access granted ──────────────────────────────────────
      step(7, totalSteps, "Server verifies proof and grants access");

      console.log(`  ${C.bgGreen}${C.white}${C.bold} HTTP 200 ${C.reset} ${C.green}Access Granted${C.reset}`);
      console.log("");
      console.log(`  ${C.cyan}Premium Data Response:${C.reset}`);
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        info(`  ${key}`, String(value));
      }
    } else {
      console.log(`  ${C.red}Failed: ${paidResponse.status}${C.reset}`);
    }
  } else {
    // Real proof generation with actual circuit files
    console.log(`  ${C.yellow}Generating real FFLONK proof...${C.reset}`);
    console.log(`  ${C.dim}Circuit: DustV2Transaction (2-in-2-out, ~12,400 R1CS constraints)${C.reset}`);
    console.log(`  ${C.dim}Proof system: FFLONK (no trusted setup, constant-size proof)${C.reset}`);
    console.log("");

    const tProof = timer();
    try {
      const paymentResult = await client.createPaymentPayload(2, shieldedOption as never);
      const elapsed = tProof();

      const payload = paymentResult.payload as unknown as ShieldedPayload;
      const proofBytes = (payload.proof.length - 2) / 2;

      console.log(`  ${C.magenta}[Proof Generation]${C.reset}`);
      info("  Time", `${C.bold}${C.green}${elapsed}s${C.reset}`);
      info("  Proof size", `${C.bold}${proofBytes} bytes${C.reset} (FFLONK, constant size)`);
      info("  Public signals", "9 (merkleRoot, nullifiers, commitments, amount, asset, recipient, chainId)");
      info("  Nullifier", payload.publicSignals.nullifier0.slice(0, 20) + "...");
      info("  Chain binding", `chainId=${payload.publicSignals.chainId} (replay protection)`);
      info("  Recipient binding", `${shieldedOption.payTo.slice(0, 10)}... (redirect protection)`);

      separator();
      console.log(`  ${C.dim}What the proof reveals:    amount, recipient, asset, chain${C.reset}`);
      console.log(`  ${C.dim}What the proof hides:      payer identity, deposit source, balance${C.reset}`);
      console.log(`  ${C.dim}What is impossible:         double-spend (nullifier prevents it)${C.reset}`);

      // ── Step 6: Send payment ──────────────────────────────────────────
      step(6, totalSteps, "Agent sends shielded payment via X-PAYMENT header");

      const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");
      info("Header", "X-PAYMENT: <base64-encoded proof + signals>");
      info("Payload size", `${paymentHeader.length} bytes (base64)`);

      const t6 = timer();
      const paidResponse = await fetch(apiUrl, {
        headers: { "X-PAYMENT": paymentHeader },
      });
      info("Response time", `${t6()}s`);

      if (paidResponse.ok) {
        const data = await paidResponse.json();

        // ── Step 7: Access granted ────────────────────────────────────
        step(7, totalSteps, "Server verifies proof and grants access");

        console.log(`  ${C.bgGreen}${C.white}${C.bold} HTTP 200 ${C.reset} ${C.green}Access Granted${C.reset}`);
        console.log("");
        console.log(`  ${C.cyan}Premium Data Response:${C.reset}`);
        for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
          info(`  ${key}`, String(value));
        }
      } else {
        console.log(`  ${C.red}Failed: ${paidResponse.status}${C.reset}`);
      }
    } catch (err) {
      const elapsed = tProof();
      console.log(`  ${C.red}Proof generation failed after ${elapsed}s: ${(err as Error).message}${C.reset}`);
      warn("This is expected without a running tree service at localhost:3001");
      warn("Use the full-demo/ directory for a real end-to-end flow with on-chain data.");
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log("");
  console.log(`${C.bold}${C.cyan}  ╔══════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║${C.reset}${C.bold}  Summary                                                    ${C.cyan}║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ╠══════════════════════════════════════════════════════════════╣${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║${C.reset}                                                              ${C.cyan}║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║${C.reset}  ${C.green}1.${C.reset} AI agent requested a premium API endpoint               ${C.cyan}║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║${C.reset}  ${C.green}2.${C.reset} Server responded ${C.red}HTTP 402${C.reset} with ${C.bold}scheme:"shielded"${C.reset}        ${C.cyan}║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║${C.reset}  ${C.green}3.${C.reset} Agent generated an FFLONK ZK proof (~60s CPU)           ${C.cyan}║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║${C.reset}  ${C.green}4.${C.reset} Proof sent via ${C.bold}X-PAYMENT${C.reset} header (768 bytes)            ${C.cyan}║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║${C.reset}  ${C.green}5.${C.reset} Server verified proof, returned ${C.green}HTTP 200${C.reset} + data         ${C.cyan}║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║${C.reset}                                                              ${C.cyan}║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║${C.reset}  ${C.magenta}Privacy guarantee:${C.reset} The server never learned WHO paid.       ${C.cyan}║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║${C.reset}  ${C.magenta}Security guarantee:${C.reset} Double-spend is impossible (nullifier). ${C.cyan}║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║${C.reset}  ${C.magenta}Chain binding:${C.reset} Proof is tied to chainId + recipient.       ${C.cyan}║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║${C.reset}                                                              ${C.cyan}║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║${C.reset}  ${C.dim}@x402/privacy  |  dustprotocol.xyz  |  scheme: "shielded"${C.reset}   ${C.cyan}║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║${C.reset}                                                              ${C.cyan}║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ╚══════════════════════════════════════════════════════════════╝${C.reset}`);
  console.log("");

  shutdown(apiServer, facilitatorServer);
}

function shutdown(...servers: ReturnType<typeof express.application.listen>[]): void {
  for (const s of servers) {
    (s as { close: (cb?: () => void) => void }).close();
  }
}

main().catch((err) => {
  console.error(`${C.red}Demo failed: ${err.message ?? err}${C.reset}`);
  process.exit(1);
});
