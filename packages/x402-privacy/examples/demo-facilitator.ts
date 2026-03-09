/**
 * x402 Facilitator — verifies shielded proofs and settles payments on-chain.
 *
 * Wraps the ShieldedEvmFacilitatorScheme with a viem-backed signer,
 * reusing the package's verify/settle logic rather than reimplementing.
 *
 * Endpoints:
 *   POST /verify  — check Merkle root + nullifier on-chain
 *   POST /settle  — call DustPoolV2.withdraw() to release funds
 *
 * Environment:
 *   FACILITATOR_PRIVATE_KEY — hex private key for settlement txns
 *   BASE_SEPOLIA_RPC        — RPC endpoint (default: https://sepolia.base.org)
 *
 * Usage:
 *   FACILITATOR_PRIVATE_KEY=0x... npx tsx examples/demo-facilitator.ts
 */
import express from "express";
import { createPublicClient, createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

import type { PaymentPayload } from "@x402/core/types";
import { ShieldedEvmFacilitatorScheme } from "../src/facilitator/scheme";
import { POOL_ADDRESSES, DEFAULT_ASSETS } from "../src/constants";
import type { FacilitatorEvmSigner } from "../src/facilitator/types";

const app = express();
app.use(express.json());
const PORT = 3002;
const NETWORK = "eip155:84532";

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

const rpcUrl = process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(rpcUrl),
});

function buildSigner(): FacilitatorEvmSigner {
  const key = process.env.FACILITATOR_PRIVATE_KEY as `0x${string}` | undefined;

  const account = key ? privateKeyToAccount(key) : undefined;
  const walletClient =
    account
      ? createWalletClient({ account, chain: baseSepolia, transport: http(rpcUrl) })
      : undefined;

  return {
    getAddresses(): readonly `0x${string}`[] {
      return account ? [account.address] : [];
    },

    async readContract(args: {
      address: `0x${string}`;
      abi: readonly unknown[];
      functionName: string;
      args?: readonly unknown[];
    }): Promise<unknown> {
      return publicClient.readContract({
        address: args.address,
        abi: args.abi as readonly Record<string, unknown>[],
        functionName: args.functionName,
        args: args.args as readonly unknown[],
      });
    },

    async writeContract(args: {
      address: `0x${string}`;
      abi: readonly unknown[];
      functionName: string;
      args: readonly unknown[];
    }): Promise<`0x${string}`> {
      if (!walletClient) throw new Error("No FACILITATOR_PRIVATE_KEY configured");
      return walletClient.writeContract({
        address: args.address,
        abi: args.abi as readonly Record<string, unknown>[],
        functionName: args.functionName,
        args: args.args as readonly unknown[],
      });
    },

    async waitForTransactionReceipt(args: {
      hash: `0x${string}`;
    }): Promise<{ status: string }> {
      const receipt = await publicClient.waitForTransactionReceipt({ hash: args.hash });
      return { status: receipt.status };
    },

    async verifyTypedData(): Promise<boolean> {
      return false;
    },

    async sendTransaction(): Promise<`0x${string}`> {
      throw new Error("Not implemented for demo facilitator");
    },

    async getCode(args: {
      address: `0x${string}`;
    }): Promise<`0x${string}` | undefined> {
      return publicClient.getCode({ address: args.address });
    },
  };
}

const signer = buildSigner();
const facilitator = new ShieldedEvmFacilitatorScheme(signer, {
  poolAddresses: POOL_ADDRESSES,
  supportedAssets: {
    [NETWORK]: [DEFAULT_ASSETS[NETWORK].address],
  },
});

app.post("/verify", async (req, res) => {
  const { proof, publicSignals } = req.body;
  if (!publicSignals) {
    res.status(400).json({ isValid: false, invalidReason: "missing_signals" });
    return;
  }

  try {
    console.log(`${C.magenta}[FACILITATOR]${C.reset} Verifying proof on-chain...`);
    const result = await facilitator.verify(
      { x402Version: 2, resource: { url: "", description: "", mimeType: "" }, accepted: {}, payload: { proof, publicSignals } } as unknown as PaymentPayload,
      {
        scheme: "shielded",
        amount: req.body.amount ?? "100000",
        network: req.body.network ?? NETWORK,
        payTo: req.body.payTo ?? "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        asset: req.body.asset ?? DEFAULT_ASSETS[NETWORK].address,
        maxTimeoutSeconds: 300,
        extra: {},
      },
    );

    if (result.isValid) {
      console.log(`${C.magenta}[FACILITATOR]${C.reset} -> ${C.green}VALID${C.reset}`);
    } else {
      console.log(`${C.magenta}[FACILITATOR]${C.reset} -> ${C.red}INVALID: ${result.invalidReason}${C.reset}`);
    }
    res.json(result);
  } catch (err) {
    console.log(`${C.magenta}[FACILITATOR]${C.reset} -> ${C.red}ERROR: ${(err as Error).message}${C.reset}`);
    res.status(500).json({
      isValid: false,
      invalidReason: "rpc_error",
      invalidMessage: (err as Error).message,
    });
  }
});

app.post("/settle", async (req, res) => {
  if (!process.env.FACILITATOR_PRIVATE_KEY) {
    res.status(500).json({ success: false, errorReason: "no_private_key" });
    return;
  }

  const { proof, publicSignals, payTo, asset } = req.body;

  try {
    console.log(`${C.magenta}[FACILITATOR]${C.reset} Settling payment on-chain...`);
    const result = await facilitator.settle(
      { x402Version: 2, resource: { url: "", description: "", mimeType: "" }, accepted: {}, payload: { proof, publicSignals } } as unknown as PaymentPayload,
      {
        scheme: "shielded",
        network: req.body.network ?? NETWORK,
        amount: req.body.amount ?? "100000",
        payTo: payTo ?? "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        asset: asset ?? DEFAULT_ASSETS[NETWORK].address,
        maxTimeoutSeconds: 300,
        extra: {},
      },
    );

    if (result.success) {
      console.log(`${C.magenta}[FACILITATOR]${C.reset} -> ${C.green}Settled: ${result.transaction}${C.reset}`);
    } else {
      console.log(`${C.magenta}[FACILITATOR]${C.reset} -> ${C.red}Failed: ${result.errorReason}${C.reset}`);
    }
    res.json(result);
  } catch (err) {
    console.log(`${C.magenta}[FACILITATOR]${C.reset} -> ${C.red}ERROR: ${(err as Error).message}${C.reset}`);
    res.status(500).json({
      success: false,
      errorReason: "settle_failed",
      errorMessage: (err as Error).message,
      transaction: "",
      network: NETWORK,
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    network: NETWORK,
    pool: POOL_ADDRESSES[NETWORK],
    hasPrivateKey: !!process.env.FACILITATOR_PRIVATE_KEY,
  });
});

app.listen(PORT, () => {
  console.log(`\n${C.bold}${C.magenta}=== x402 Facilitator ===${C.reset}`);
  console.log(`${C.dim}Verify: POST http://localhost:${PORT}/verify${C.reset}`);
  console.log(`${C.dim}Settle: POST http://localhost:${PORT}/settle${C.reset}`);
  console.log(`${C.dim}Health: GET  http://localhost:${PORT}/health${C.reset}`);
  console.log(`${C.dim}Pool:   ${POOL_ADDRESSES[NETWORK]} (Base Sepolia)${C.reset}`);
  console.log(`${C.dim}Key:    ${process.env.FACILITATOR_PRIVATE_KEY ? "configured" : "NOT SET -- settle will fail"}${C.reset}\n`);
});
