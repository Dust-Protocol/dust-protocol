import { ethers } from 'ethers';
import { NextResponse } from 'next/server';
import { getChainConfig } from '@/config/chains';
import { getServerProvider, getServerSponsor, parseChainId, waitForTx } from '@/lib/server-provider';
import { ENTRY_POINT_ABI } from '@/lib/stealth/types';
import { checkOrigin } from '@/lib/api-auth';

export const maxDuration = 60;

// Auto-top-up: if paymaster deposit drops below MIN, top up
const PAYMASTER_MIN_DEPOSIT = ethers.utils.parseEther('0.1');
const PAYMASTER_TOP_UP_AMOUNT = ethers.utils.parseEther('1.0');
let lastTopUpCheck = 0;
const TOP_UP_CHECK_INTERVAL_MS = 60_000;

// Rate limiting
const submitCooldowns = new Map<string, number>();
const SUBMIT_COOLDOWN_MS = 10_000;

const NO_STORE = { 'Cache-Control': 'no-store' };

interface SignedUserOp {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}

/**
 * POST /api/bundle/submit — Submit a signed UserOperation
 *
 * Receives a fully signed UserOp + chainId.
 * Calls entryPoint.handleOps() via the sponsor wallet (self-bundling).
 */
export async function POST(req: Request) {
  try {
    const originError = checkOrigin(req);
    if (originError) return originError;

    const body = await req.json();
    const chainId = parseChainId(body);
    const config = getChainConfig(chainId);
    const { userOp } = body as { userOp: SignedUserOp; chainId?: number };

    if (!userOp || !userOp.sender || !userOp.signature || userOp.signature === '0x') {
      return NextResponse.json({ error: 'Missing or unsigned UserOp' }, { status: 400, headers: NO_STORE });
    }

    // Rate limit by sender address
    const senderKey = `${chainId}:${userOp.sender.toLowerCase()}`;
    const lastSubmit = submitCooldowns.get(senderKey);
    if (lastSubmit && Date.now() - lastSubmit < SUBMIT_COOLDOWN_MS) {
      return NextResponse.json(
        { error: 'Please wait before submitting again' },
        { status: 429, headers: NO_STORE }
      );
    }
    submitCooldowns.set(senderKey, Date.now());

    const provider = getServerProvider(chainId);
    const sponsor = getServerSponsor(chainId);

    // Validate: sender has balance
    const balance = await provider.getBalance(userOp.sender);
    if (balance.isZero()) {
      return NextResponse.json(
        { error: 'No funds in stealth account' },
        { status: 400, headers: NO_STORE }
      );
    }

    console.log(`[Bundle/Submit] handleOps for ${userOp.sender} on ${config.name}, balance: ${ethers.utils.formatEther(balance)} ${config.nativeCurrency.symbol}`);

    const entryPoint = new ethers.Contract(config.contracts.entryPoint, ENTRY_POINT_ABI, sponsor);

    // Auto-top-up paymaster deposit if running low
    const now = Date.now();
    if (now - lastTopUpCheck > TOP_UP_CHECK_INTERVAL_MS) {
      lastTopUpCheck = now;
      try {
        const deposit = await entryPoint.balanceOf(config.contracts.paymaster);
        if (deposit.lt(PAYMASTER_MIN_DEPOSIT)) {
          const sponsorBal = await provider.getBalance(sponsor.address);
          if (sponsorBal.gt(PAYMASTER_TOP_UP_AMOUNT)) {
            console.log(`[Bundle/Submit] Paymaster deposit low: ${ethers.utils.formatEther(deposit)}. Topping up...`);
            const topUpTx = await entryPoint.depositTo(config.contracts.paymaster, { value: PAYMASTER_TOP_UP_AMOUNT, type: 2 });
            await waitForTx(topUpTx);
            console.log('[Bundle/Submit] Paymaster topped up with 1.0');
          } else {
            console.warn(`[Bundle/Submit] Paymaster deposit low but sponsor balance insufficient: ${ethers.utils.formatEther(sponsorBal)}`);
          }
        }
      } catch (e) {
        console.warn('[Bundle/Submit] Top-up check failed:', e instanceof Error ? e.message : e);
      }
    }

    // Gas limit must cover verificationGasLimit×2 (account + paymaster) + callGasLimit + overhead.
    // 1M overhead ensures enough gas reaches the inner call for high-callGasLimit ops (e.g. DustPool).
    const callGas = ethers.BigNumber.from(userOp.callGasLimit);
    const verGas = ethers.BigNumber.from(userOp.verificationGasLimit);
    const preGas = ethers.BigNumber.from(userOp.preVerificationGas);
    const overhead = ethers.BigNumber.from(1_000_000);
    const computedGasLimit = preGas.add(verGas.mul(2)).add(callGas).add(overhead);
    const gasLimit = computedGasLimit.gt(1_500_000) ? computedGasLimit : ethers.BigNumber.from(1_500_000);

    const tx = await entryPoint.handleOps([userOp], sponsor.address, {
      gasLimit,
      type: 2,
    });
    const receipt = await waitForTx(tx);
    if (receipt.status === 0) {
      return NextResponse.json({ error: 'Bundle execution reverted on-chain' }, { status: 500, headers: NO_STORE });
    }

    console.log('[Bundle/Submit] Success, tx:', receipt.transactionHash);

    return NextResponse.json({ txHash: receipt.transactionHash }, { headers: NO_STORE });
  } catch (e) {
    console.error('[Bundle/Submit] Error:', e);
    const raw = e instanceof Error ? e.message : '';
    let message = 'Submission failed';
    if (raw.includes('AA')) message = `EntryPoint: ${raw.match(/AA\d+\s+[^"]+/)?.[0] || raw.slice(0, 100)}`;

    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
