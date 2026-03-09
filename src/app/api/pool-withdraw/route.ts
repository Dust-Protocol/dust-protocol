import { ethers } from 'ethers';
import { NextResponse } from 'next/server';
import { DUST_POOL_ABI } from '@/lib/stealth/types';
import { getChainConfig } from '@/config/chains';
import { getServerProvider, getServerSponsor, parseChainId, getMaxGasPrice, waitForTx } from '@/lib/server-provider';
import { checkOrigin } from '@/lib/api-auth';

export const maxDuration = 60;

const SPONSOR_KEY = process.env.RELAYER_PRIVATE_KEY;

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

// Rate limiting
const withdrawCooldowns = new Map<string, number>();
const WITHDRAW_COOLDOWN_MS = 10_000;

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export async function POST(req: Request) {
  try {
    const originError = checkOrigin(req);
    if (originError) return originError;

    if (!SPONSOR_KEY) {
      return NextResponse.json({ error: 'Sponsor not configured' }, { status: 500 });
    }

    const body = await req.json();
    const chainId = parseChainId(body);
    const config = getChainConfig(chainId);

    if (!config.contracts.dustPool) {
      return NextResponse.json({ error: 'DustPool not available on this chain' }, { status: 400 });
    }

    const { proof, root, nullifierHash, recipient, amount } = body;

    if (!proof || !root || !nullifierHash || !recipient || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: NO_STORE });
    }
    if (!isValidAddress(recipient)) {
      return NextResponse.json({ error: 'Invalid recipient address' }, { status: 400, headers: NO_STORE });
    }
    // Validate hex formats to prevent wasting sponsor gas on guaranteed reverts
    if (!/^0x[0-9a-fA-F]{64}$/.test(root)) {
      return NextResponse.json({ error: 'Invalid root format' }, { status: 400, headers: NO_STORE });
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(nullifierHash)) {
      return NextResponse.json({ error: 'Invalid nullifierHash format' }, { status: 400, headers: NO_STORE });
    }
    if (!/^0x[0-9a-fA-F]+$/.test(proof)) {
      return NextResponse.json({ error: 'Invalid proof format' }, { status: 400, headers: NO_STORE });
    }

    // Rate limiting per nullifierHash
    const nhKey = nullifierHash.toLowerCase();
    const lastWithdraw = withdrawCooldowns.get(nhKey);
    if (lastWithdraw && Date.now() - lastWithdraw < WITHDRAW_COOLDOWN_MS) {
      return NextResponse.json({ error: 'Please wait before withdrawing again' }, { status: 429 });
    }
    withdrawCooldowns.set(nhKey, Date.now());

    const provider = getServerProvider(chainId);
    const sponsor = getServerSponsor(chainId);

    const [feeData, block] = await Promise.all([
      provider.getFeeData(),
      provider.getBlock('latest'),
    ]);
    const baseFee = block.baseFeePerGas || feeData.gasPrice || ethers.utils.parseUnits('1', 'gwei');
    const maxPriorityFee = feeData.maxPriorityFeePerGas || ethers.utils.parseUnits('1.5', 'gwei');
    const maxFeePerGas = baseFee.add(maxPriorityFee).mul(2);

    if (maxFeePerGas.gt(getMaxGasPrice(chainId))) {
      return NextResponse.json({ error: 'Gas price too high' }, { status: 503 });
    }

    const poolContract = new ethers.Contract(config.contracts.dustPool, DUST_POOL_ABI, sponsor);

    console.log('[PoolWithdraw] Processing withdrawal, amount:', amount);

    const tx = await poolContract.withdraw(
      proof,
      root,
      nullifierHash,
      recipient,
      amount,
      {
        gasLimit: 500_000, // Groth16 verify ~350K + transfer
        type: 2,
        maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFee,
      },
    );
    const receipt = await waitForTx(tx);

    if (receipt.status === 0) {
      console.error('[PoolWithdraw] Transaction reverted:', receipt.transactionHash);
      return NextResponse.json({ error: 'Transaction reverted on-chain' }, { status: 500, headers: NO_STORE });
    }

    console.log('[PoolWithdraw] Success:', receipt.transactionHash);

    return NextResponse.json({
      success: true,
      txHash: receipt.transactionHash,
    }, { headers: NO_STORE });
  } catch (e) {
    console.error('[PoolWithdraw] Error:', e);
    // Sanitize — don't leak RPC URLs, contract addresses, or revert data
    const raw = e instanceof Error ? e.message : '';
    let message = 'Withdrawal failed';
    if (raw.includes('invalid proof') || raw.includes('InvalidProof')) message = 'Invalid proof';
    else if (raw.includes('nullifier') || raw.includes('already spent') || raw.includes('AlreadySpent')) message = 'Note already spent';
    else if (raw.includes('root') || raw.includes('InvalidRoot')) message = 'Invalid or expired Merkle root';
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
