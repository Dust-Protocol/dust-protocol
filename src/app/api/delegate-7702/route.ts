import { ethers } from 'ethers';
import { NextResponse } from 'next/server';
import { getChainConfig } from '@/config/chains';
import { getServerProvider, getServerSponsor, parseChainId, acquireTxLock } from '@/lib/server-provider';
import { STEALTH_SUB_ACCOUNT_7702_ABI, DUST_POOL_ABI } from '@/lib/stealth/types';
import { checkOrigin } from '@/lib/api-auth';

export const maxDuration = 60;

const SPONSOR_KEY = process.env.RELAYER_PRIVATE_KEY;

// Rate limiting: 10s cooldown per stealth address
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 10_000;
const MAX_ENTRIES = 500;

function checkCooldown(key: string): boolean {
  const now = Date.now();
  if (cooldowns.size > MAX_ENTRIES) {
    for (const [k, t] of cooldowns) {
      if (now - t > COOLDOWN_MS) cooldowns.delete(k);
    }
  }
  const last = cooldowns.get(key);
  if (last && now - last < COOLDOWN_MS) return false;
  cooldowns.set(key, now);
  return true;
}

const NO_STORE = { 'Cache-Control': 'no-store' };

// viem WalletClient cache — reuse per chain to avoid per-request object churn + nonce conflicts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viemClientCache = new Map<number, { client: any; account: any }>();
async function getViemSponsor(chainId: number) {
  if (!SPONSOR_KEY) throw new Error('Sponsor not configured');
  const cached = viemClientCache.get(chainId);
  if (cached) return cached;
  const { createWalletClient, http } = await import('viem');
  const { privateKeyToAccount } = await import('viem/accounts');
  const config = getChainConfig(chainId);
  const key = SPONSOR_KEY.startsWith('0x') ? SPONSOR_KEY : `0x${SPONSOR_KEY}`;
  const account = privateKeyToAccount(key as `0x${string}`);
  const client = createWalletClient({ account, chain: config.viemChain, transport: http(config.rpcUrl) });
  const entry = { client, account };
  viemClientCache.set(chainId, entry);
  return entry;
}

/** GET /api/delegate-7702 — returns sponsor wallet address for client-side signing */
export async function GET() {
  try {
    if (!SPONSOR_KEY) {
      return NextResponse.json({ error: 'Sponsor not configured' }, { status: 500, headers: NO_STORE });
    }
    const sponsor = getServerSponsor();
    return NextResponse.json({ address: sponsor.address }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'Failed to derive sponsor address' }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(req: Request) {
  try {
    const originError = checkOrigin(req);
    if (originError) return originError;

    if (!SPONSOR_KEY) {
      return NextResponse.json({ error: 'Sponsor not configured' }, { status: 500, headers: NO_STORE });
    }

    const body = await req.json();
    const chainId = parseChainId(body);
    const config = getChainConfig(chainId);

    if (!config.supportsEIP7702 || !config.contracts.subAccount7702) {
      return NextResponse.json({ error: 'EIP-7702 not supported on this chain' }, { status: 400, headers: NO_STORE });
    }

    const { stealthAddress, authorization, mode } = body;
    if (!stealthAddress || !authorization || !mode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: NO_STORE });
    }

    if (!checkCooldown(stealthAddress.toLowerCase())) {
      return NextResponse.json({ error: 'Please wait before trying again' }, { status: 429, headers: NO_STORE });
    }

    const { encodeFunctionData, http } = await import('viem');
    const { client, account: sponsorAccount } = await getViemSponsor(chainId);

    // Serialize tx submissions to prevent nonce collisions with ethers sponsor wallet
    const releaseLock = await acquireTxLock(chainId);
    try {

    if (mode === 'drain') {
      const { drainTo, drainSig } = body;
      if (!drainTo || !drainSig) {
        return NextResponse.json({ error: 'Missing drain fields' }, { status: 400, headers: NO_STORE });
      }
      const calldata = encodeFunctionData({
        abi: [{
          name: 'drain',
          type: 'function',
          inputs: [{ name: 'to', type: 'address' }, { name: 'sig', type: 'bytes' }],
          outputs: [],
          stateMutability: 'nonpayable',
        }],
        functionName: 'drain',
        args: [drainTo, drainSig],
      });

      const txHash = await client.sendTransaction({
        authorizationList: [authorization],
        to: stealthAddress as `0x${string}`,
        data: calldata,
        gas: 200_000n,
      });

      console.log(`[7702] drain for ${stealthAddress} → tx: ${txHash}`);

      return NextResponse.json({ txHash }, { headers: NO_STORE });
    } else if (mode === 'initialize') {
      const { initializeOwner, initializeSig } = body;
      if (!initializeOwner || !initializeSig) {
        return NextResponse.json({ error: 'Missing initialize fields' }, { status: 400, headers: NO_STORE });
      }
      const calldata = encodeFunctionData({
        abi: [{
          name: 'initialize',
          type: 'function',
          inputs: [{ name: '_owner', type: 'address' }, { name: 'sig', type: 'bytes' }],
          outputs: [],
          stateMutability: 'nonpayable',
        }],
        functionName: 'initialize',
        args: [initializeOwner, initializeSig],
      });

      const txHash = await client.sendTransaction({
        authorizationList: [authorization],
        to: stealthAddress as `0x${string}`,
        data: calldata,
        gas: 200_000n,
      });

      console.log(`[7702] initialize for ${stealthAddress} → tx: ${txHash}`);

      return NextResponse.json({ txHash }, { headers: NO_STORE });
    } else if (mode === 'pool-deposit') {
      // Pool deposit: initialize (if needed) → execute(dustPool, balance, depositCalldata)
      const { initializeSig, commitment } = body;
      if (!commitment) {
        return NextResponse.json({ error: 'Missing commitment for pool deposit' }, { status: 400, headers: NO_STORE });
      }

      const dustPoolAddress = config.contracts.dustPool;
      if (!dustPoolAddress) {
        return NextResponse.json({ error: 'DustPool not available on this chain' }, { status: 400, headers: NO_STORE });
      }

      const provider = getServerProvider(chainId);
      const balance = await provider.getBalance(stealthAddress);
      if (balance.isZero()) {
        return NextResponse.json({ error: 'No funds in stealth address' }, { status: 400, headers: NO_STORE });
      }

      // Check if already initialized
      let isInitialized = false;
      try {
        const contract = new ethers.Contract(stealthAddress, STEALTH_SUB_ACCOUNT_7702_ABI, provider);
        isInitialized = await contract.initialized();
      } catch {
        // Not delegated yet or no code — needs initialization
      }

      // Step 1: Initialize with sponsor as owner (if not already)
      if (!isInitialized) {
        if (!initializeSig) {
          return NextResponse.json({ error: 'Missing initializeSig for uninitialized account' }, { status: 400, headers: NO_STORE });
        }

        const initCalldata = encodeFunctionData({
          abi: [{
            name: 'initialize',
            type: 'function',
            inputs: [{ name: '_owner', type: 'address' }, { name: 'sig', type: 'bytes' }],
            outputs: [],
            stateMutability: 'nonpayable',
          }],
          functionName: 'initialize',
          args: [sponsorAccount.address, initializeSig],
        });

        const initTxHash = await client.sendTransaction({
          authorizationList: [authorization],
          to: stealthAddress as `0x${string}`,
          data: initCalldata,
          gas: 200_000n,
        });
        console.log(`[7702/pool] Initialize ${stealthAddress} → tx: ${initTxHash}`);

        // Wait for confirmation
        const { createPublicClient } = await import('viem');
        const publicClient = createPublicClient({
          chain: config.viemChain,
          transport: http(config.rpcUrl),
        });
        await publicClient.waitForTransactionReceipt({
          hash: initTxHash,
          timeout: 120_000, // 120s for Sepolia testnet
        });
      }

      // Step 2: Execute DustPool.deposit(commitment, balance) via the stealth account
      const poolIface = new ethers.utils.Interface(DUST_POOL_ABI);
      const depositCalldata = poolIface.encodeFunctionData('deposit', [commitment, balance]);

      const executeCalldata = encodeFunctionData({
        abi: [{
          name: 'execute',
          type: 'function',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'data', type: 'bytes' },
          ],
          outputs: [],
          stateMutability: 'nonpayable',
        }],
        functionName: 'execute',
        args: [
          dustPoolAddress as `0x${string}`,
          balance.toBigInt(),
          depositCalldata as `0x${string}`,
        ],
      });

      const txHash = await client.sendTransaction({
        authorizationList: [authorization],
        to: stealthAddress as `0x${string}`,
        data: executeCalldata,
        gas: 500_000n,
      });
      console.log(`[7702/pool] Execute deposit ${stealthAddress} → tx: ${txHash}`);

      // Wait and parse Deposit event
      const { createPublicClient: createPub } = await import('viem');
      const pubClient = createPub({
        chain: config.viemChain,
        transport: http(config.rpcUrl),
      });
      const receipt = await pubClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 120_000, // 120s for Sepolia testnet
      });

      const poolContract = new ethers.Contract(dustPoolAddress, DUST_POOL_ABI, provider);
      let leafIndex = 0;
      for (const log of receipt.logs) {
        try {
          const parsed = poolContract.interface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed.name === 'Deposit') {
            leafIndex = parsed.args.leafIndex.toNumber();
            break;
          }
        } catch { /* skip non-matching logs */ }
      }

      console.log(`[7702/pool] Success, leafIndex: ${leafIndex}, amount: ${ethers.utils.formatEther(balance)}`);

      return NextResponse.json({
        txHash,
        leafIndex,
        amount: ethers.utils.formatEther(balance),
      }, { headers: NO_STORE });
    } else {
      return NextResponse.json({ error: 'Invalid mode (drain, initialize, or pool-deposit)' }, { status: 400, headers: NO_STORE });
    }

    } finally {
      releaseLock();
    }
  } catch (e) {
    console.error('[7702] Error:', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json(
      { error: message.includes('insufficient') ? 'Sponsor out of funds' : 'Transaction failed' },
      { status: 500, headers: NO_STORE }
    );
  }
}
