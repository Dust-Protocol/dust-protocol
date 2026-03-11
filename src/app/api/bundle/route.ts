import { ethers } from 'ethers';
import { NextResponse } from 'next/server';
import { getChainConfig } from '@/config/chains';
import { getServerProvider, getServerSponsor, parseChainId, getTxGasOverrides } from '@/lib/server-provider';
import { ENTRY_POINT_ABI, DUST_PAYMASTER_ABI } from '@/lib/stealth/types';

const NO_STORE = { 'Cache-Control': 'no-store' };

const bundleCooldowns = new Map<string, number>();
const BUNDLE_COOLDOWN_MS = 3_000;
const MAX_BUNDLE_ENTRIES = 500;

interface PartialUserOp {
  sender: string;
  nonce?: string;
  initCode: string;
  callData: string;
  callGasLimit?: string;
  verificationGasLimit?: string;
  preVerificationGas?: string;
}

/**
 * POST /api/bundle — Prepare a UserOperation
 *
 * Receives a partial UserOp (sender, initCode, callData) + chainId.
 * Fills gas fields, builds paymasterAndData with sponsor signature,
 * computes userOpHash, and returns the completed UserOp for client signing.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const chainId = parseChainId(body);
    const config = getChainConfig(chainId);
    const { sender, initCode, callData } = body as PartialUserOp & { chainId?: number };

    if (!sender || !callData) {
      return NextResponse.json({ error: 'Missing sender or callData' }, { status: 400, headers: NO_STORE });
    }

    // Rate limiting per sender
    const now = Date.now();
    if (bundleCooldowns.size > MAX_BUNDLE_ENTRIES) {
      for (const [k, t] of bundleCooldowns) {
        if (now - t > BUNDLE_COOLDOWN_MS) bundleCooldowns.delete(k);
      }
    }
    const senderKey = sender.toLowerCase();
    const lastBundle = bundleCooldowns.get(senderKey);
    if (lastBundle && now - lastBundle < BUNDLE_COOLDOWN_MS) {
      return NextResponse.json({ error: 'Please wait before preparing another bundle' }, { status: 429, headers: NO_STORE });
    }
    bundleCooldowns.set(senderKey, now);

    // Whitelist callData selectors to prevent arbitrary contract calls
    const DRAIN_SELECTOR = '0xece53132';   // drain(address)
    const EXECUTE_SELECTOR = '0xb61d27f6'; // execute(address,uint256,bytes)
    const selector = callData.slice(0, 10).toLowerCase();

    if (selector === EXECUTE_SELECTOR) {
      // For execute(), only allow calls targeting DustPool or DustPoolV2
      const dustPool = config.contracts.dustPool;
      const dustPoolV2 = config.contracts.dustPoolV2;
      if (!dustPool && !dustPoolV2) {
        return NextResponse.json({ error: 'No pool available on this chain' }, { status: 400, headers: NO_STORE });
      }
      try {
        const decoded = ethers.utils.defaultAbiCoder.decode(
          ['address', 'uint256', 'bytes'], '0x' + callData.slice(10)
        );
        const target = decoded[0].toLowerCase();
        const allowed = [dustPool, dustPoolV2].filter((a): a is string => !!a).map(a => a.toLowerCase());
        if (!allowed.includes(target)) {
          return NextResponse.json({ error: 'Execute target not allowed' }, { status: 400, headers: NO_STORE });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid execute calldata' }, { status: 400, headers: NO_STORE });
      }
    } else if (selector !== DRAIN_SELECTOR) {
      return NextResponse.json({ error: 'Unsupported operation' }, { status: 400, headers: NO_STORE });
    }

    const provider = getServerProvider(chainId);
    const sponsor = getServerSponsor(chainId);
    const entryPoint = new ethers.Contract(config.contracts.entryPoint, ENTRY_POINT_ABI, provider);

    // Get nonce from EntryPoint
    const nonce = body.nonce || (await entryPoint.getNonce(sender, 0)).toString();

    // Gas params — higher for pool deposits (Poseidon Merkle tree ~6.8M gas)
    const isPoolDeposit = selector === EXECUTE_SELECTOR;
    const callGasLimit = body.callGasLimit || (isPoolDeposit ? '8000000' : '200000');
    const verificationGasLimit = body.verificationGasLimit || (initCode && initCode !== '0x' ? '500000' : '200000');
    // L2s require higher preVerificationGas to cover L1 data posting costs
    const L2_PRE_VERIFICATION: Record<number, string> = {
      421614: '500000',   // Arbitrum Sepolia (L1 calldata overhead)
      11155420: '300000', // OP Sepolia (L1 data fee via EIP-4844)
      84532: '300000',    // Base Sepolia (same OP Stack model)
    };
    const preVerificationGas = body.preVerificationGas || L2_PRE_VERIFICATION[chainId] || '50000';

    // Fee estimation — UserOp maxFeePerGas must be >= outer tx gasPrice (EntryPoint enforces this).
    // Get the actual gas price that handleOps will use, then set UserOp fields to match.
    const outerGasOverrides = await getTxGasOverrides(chainId, 21000);
    let maxFeePerGas: ethers.BigNumber;
    let maxPriorityFeePerGas: ethers.BigNumber;

    if (outerGasOverrides.gasPrice) {
      // Legacy chain (Flow): outer tx uses gasPrice — UserOp fields must match
      const gp = outerGasOverrides.gasPrice as ethers.BigNumber;
      maxFeePerGas = gp;
      maxPriorityFeePerGas = gp;
    } else {
      maxFeePerGas = outerGasOverrides.maxFeePerGas as ethers.BigNumber;
      maxPriorityFeePerGas = outerGasOverrides.maxPriorityFeePerGas as ethers.BigNumber;
    }

    // Build partial UserOp (without paymasterAndData and signature)
    const userOp = {
      sender,
      nonce,
      initCode: initCode || '0x',
      callData,
      callGasLimit,
      verificationGasLimit,
      preVerificationGas,
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
      paymasterAndData: '0x',
      signature: '0x',
    };

    // Build paymaster signature
    const validUntil = Math.floor(Date.now() / 1000) + 600;
    const validAfter = Math.floor(Date.now() / 1000) - 60;

    const paymasterHash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'address', 'uint48', 'uint48'],
      [
        sender, nonce,
        ethers.utils.keccak256(userOp.initCode),
        ethers.utils.keccak256(userOp.callData),
        callGasLimit, verificationGasLimit, preVerificationGas,
        maxFeePerGas.toString(), maxPriorityFeePerGas.toString(),
        config.id,
        config.contracts.paymaster,
        validUntil, validAfter,
      ]
    ));

    const sponsorSig = await sponsor.signMessage(ethers.utils.arrayify(paymasterHash));

    const timeRange = ethers.utils.defaultAbiCoder.encode(['uint48', 'uint48'], [validUntil, validAfter]);
    const paymasterAndData = ethers.utils.hexConcat([config.contracts.paymaster, timeRange, sponsorSig]);

    userOp.paymasterAndData = paymasterAndData;

    const userOpHash = await entryPoint.getUserOpHash(userOp);

    console.log(`[Bundle] Prepared UserOp on chain ${config.name}`);

    return NextResponse.json({ userOp, userOpHash }, { headers: NO_STORE });
  } catch (e) {
    console.error('[Bundle] Error:', e);
    return NextResponse.json({ error: 'Bundle preparation failed' }, { status: 500, headers: NO_STORE });
  }
}
