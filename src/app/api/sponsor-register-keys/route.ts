import { ethers } from 'ethers';
import { NextResponse } from 'next/server';
import { getChainConfig } from '@/config/chains';
import { getServerSponsor, parseChainId, waitForTx, getTxGasOverrides } from '@/lib/server-provider';
import { checkOrigin } from '@/lib/api-auth';

export const maxDuration = 60;

const SPONSOR_KEY = process.env.RELAYER_PRIVATE_KEY;

const REGISTRY_ABI = [
  'function registerKeysOnBehalf(address registrant, uint256 schemeId, bytes calldata signature, bytes calldata stealthMetaAddress) external',
];

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function isValidHex(hex: string): boolean {
  return /^0x[0-9a-fA-F]+$/.test(hex);
}

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const registerKeyCooldowns = new Map<string, number>();
const KEY_REGISTER_COOLDOWN_MS = 30_000;
const MAX_KEY_REGISTER_ENTRIES = 500;

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

    const { registrant, metaAddress, signature } = body;

    if (!registrant || !metaAddress || !signature) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!isValidAddress(registrant)) {
      return NextResponse.json({ error: 'Invalid registrant address' }, { status: 400 });
    }
    if (!isValidHex(signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400, headers: NO_STORE });
    }

    // Rate limiting per registrant
    const now = Date.now();
    if (registerKeyCooldowns.size > MAX_KEY_REGISTER_ENTRIES) {
      for (const [k, t] of registerKeyCooldowns) {
        if (now - t > KEY_REGISTER_COOLDOWN_MS) registerKeyCooldowns.delete(k);
      }
    }
    const addrKey = registrant.toLowerCase();
    const lastRegister = registerKeyCooldowns.get(addrKey);
    if (lastRegister && now - lastRegister < KEY_REGISTER_COOLDOWN_MS) {
      return NextResponse.json({ error: 'Please wait before registering again' }, { status: 429, headers: NO_STORE });
    }
    registerKeyCooldowns.set(addrKey, now);

    const metaBytes = metaAddress.startsWith('st:')
      ? '0x' + (metaAddress.match(/st:[a-z]+:0x([0-9a-fA-F]+)/)?.[1] || '')
      : metaAddress.startsWith('0x') ? metaAddress : '0x' + metaAddress;

    if (!metaBytes || metaBytes === '0x') {
      return NextResponse.json({ error: 'Invalid meta-address' }, { status: 400 });
    }

    const sponsor = getServerSponsor(chainId);
    const registry = new ethers.Contract(config.contracts.registry, REGISTRY_ABI, sponsor);

    const gasOverrides = await getTxGasOverrides(chainId, 600_000);
    const tx = await registry.registerKeysOnBehalf(registrant, 1, signature, metaBytes, gasOverrides);
    const receipt = await waitForTx(tx);
    if (receipt.status === 0) {
      return NextResponse.json({ error: 'Key registration reverted on-chain' }, { status: 500, headers: NO_STORE });
    }

    console.log('[SponsorRegisterKeys] Success:', receipt.transactionHash);

    return NextResponse.json({
      success: true,
      txHash: receipt.transactionHash,
    }, { headers: NO_STORE });
  } catch (e) {
    console.error('[SponsorRegisterKeys] Error:', e);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500, headers: NO_STORE });
  }
}
