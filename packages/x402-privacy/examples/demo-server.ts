/**
 * x402 API Server — serves premium data behind a shielded payment wall.
 *
 * Flow:
 *   1. Agent requests GET /api/premium-data
 *   2. No X-PAYMENT header -> 402 with scheme:"shielded" requirement
 *   3. Valid X-PAYMENT header -> premium data response
 *
 * Usage:
 *   npx tsx examples/demo-server.ts
 */
import express from "express";
import {
  SCHEME_NAME,
  POOL_ADDRESSES,
  DEFAULT_ASSETS,
  TREE_DEPTH,
} from "../src/constants";

const app = express();
const PORT = 3000;
const NETWORK = "eip155:84532";
const PAY_TO = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0";
const PRICE_BASE_UNITS = "100000"; // 0.10 USDC
const TREE_SERVICE_URL = "http://localhost:3001/tree";

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

interface ShieldedPaymentHeader {
  proof: string;
  publicSignals: Record<string, string>;
}

app.use((req, _res, next) => {
  const raw = req.headers["x-payment"];
  if (raw && typeof raw === "string") {
    try {
      const decoded = Buffer.from(raw, "base64").toString();
      (req as express.Request & { shieldedPayment?: ShieldedPaymentHeader }).shieldedPayment =
        JSON.parse(decoded);
    } catch {
      // Malformed payment header
    }
  }
  next();
});

app.get("/api/premium-data", (req, res) => {
  const payment = (req as express.Request & { shieldedPayment?: ShieldedPaymentHeader })
    .shieldedPayment;

  if (!payment) {
    console.log(`${C.yellow}[SERVER]${C.reset} GET /api/premium-data -> ${C.red}402 Payment Required${C.reset}`);
    const asset = DEFAULT_ASSETS[NETWORK];
    const pool = POOL_ADDRESSES[NETWORK];

    res.status(402).json({
      x402Version: 2,
      error: "Payment required",
      resource: {
        url: "/api/premium-data",
        description: "Premium AI training data",
      },
      accepts: [
        {
          scheme: SCHEME_NAME,
          network: NETWORK,
          amount: PRICE_BASE_UNITS,
          asset: asset.address,
          payTo: PAY_TO,
          maxTimeoutSeconds: 300,
          extra: {
            dustPoolV2: pool,
            merkleRoot: "0",
            treeDepth: TREE_DEPTH,
            treeServiceUrl: TREE_SERVICE_URL,
            supportedAssets: [asset.address],
          },
        },
      ],
    });
    return;
  }

  const proofLen = payment.proof ? (payment.proof.length - 2) / 2 : 0;
  console.log(
    `${C.green}[SERVER]${C.reset} Payment received: ${proofLen} bytes proof, nullifier: ${payment.publicSignals?.nullifier0?.slice(0, 20) ?? "?"}...`,
  );
  console.log(`${C.green}[SERVER]${C.reset} -> ${C.green}200 OK${C.reset} (serving premium data)`);

  res.json({
    data: "Premium AI training dataset: Llama-3-tokenized corpus v4.2",
    records: 1_500_000,
    format: "parquet",
    timestamp: Date.now(),
  });
});

app.listen(PORT, () => {
  console.log(`\n${C.bold}${C.cyan}=== x402 API Server ===${C.reset}`);
  console.log(`${C.dim}Serving premium data at${C.reset} http://localhost:${PORT}/api/premium-data`);
  console.log(`${C.dim}Payment: 0.10 USDC (shielded via DustPoolV2 on Base Sepolia)${C.reset}`);
  console.log(`${C.dim}Pool: ${POOL_ADDRESSES[NETWORK]}${C.reset}\n`);
});
