import { ethers } from 'ethers';
import { NextResponse } from 'next/server';
import { getChainConfig, getCanonicalNamingChain } from '@/config/chains';
import { getServerSponsor, parseChainId, waitForTx, getTxGasOverrides } from '@/lib/server-provider';
import { checkOrigin } from '@/lib/api-auth';

export const maxDuration = 60;

const SPONSOR_KEY = process.env.RELAYER_PRIVATE_KEY;

const NAME_REGISTRY_ABI = [
  'function getOwner(string calldata name) external view returns (address)',
  'function resolveName(string calldata name) external view returns (bytes)',
  'function transferName(string calldata name, address newOwner) external',
  'function updateMetaAddress(string calldata name, bytes calldata newMetaAddress) external',
];

const ERC6538_ABI = [
  'function stealthMetaAddressOf(address registrant, uint256 schemeId) external view returns (bytes)',
];

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function isValidName(name: string): boolean {
  return name.length > 0 && name.length <= 32 && /^[a-zA-Z0-9_-]+$/.test(name);
}

export async function POST(req: Request) {
  try {
    const originError = checkOrigin(req);
    if (originError) return originError;

    if (!SPONSOR_KEY) {
      return NextResponse.json({ error: 'Sponsor not configured' }, { status: 500 });
    }

    const body = await req.json();
    const requestedChainId = parseChainId(body);
    const requestedConfig = getChainConfig(requestedChainId);
    // Route to canonical chain when chain has no nameRegistry (L2s)
    const chainId = requestedConfig.contracts.nameRegistry ? requestedChainId : getCanonicalNamingChain().id;
    const config = getChainConfig(chainId);

    const { name, newOwner, metaAddress } = body;

    if (!name || !newOwner) {
      return NextResponse.json({ error: 'Missing name or newOwner' }, { status: 400 });
    }
    if (!isValidName(name)) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }
    if (!isValidAddress(newOwner)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }

    const sponsor = getServerSponsor(chainId);
    const registry = new ethers.Contract(config.contracts.nameRegistry, NAME_REGISTRY_ABI, sponsor);

    // Only transfer if sponsor/deployer owns the name
    const currentOwner = await registry.getOwner(name);
    if (currentOwner.toLowerCase() !== sponsor.address.toLowerCase()) {
      return NextResponse.json({ error: 'Name not owned by sponsor' }, { status: 403 });
    }

    // Verify newOwner's ERC-6538 metaAddress matches the name's resolved metaAddress
    // Prevents unauthorized name hijacking — attacker cannot transfer without matching on-chain registration
    const erc6538 = new ethers.Contract(config.contracts.registry, ERC6538_ABI, sponsor.provider);
    const [nameMetaAddress, ownerMetaAddress] = await Promise.all([
      registry.resolveName(name),
      erc6538.stealthMetaAddressOf(newOwner, 1),
    ]);
    if (!nameMetaAddress || !ownerMetaAddress ||
        nameMetaAddress === '0x' || ownerMetaAddress === '0x' ||
        nameMetaAddress.toLowerCase() !== ownerMetaAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'MetaAddress mismatch — newOwner must have matching ERC-6538 registration' },
        { status: 403 },
      );
    }

    // Transfer name to new owner
    const gasOverrides = await getTxGasOverrides(chainId, 400_000);
    const tx = await registry.transferName(name, newOwner, gasOverrides);
    const receipt = await waitForTx(tx);
    if (receipt.status === 0) {
      return NextResponse.json({ error: 'Name transfer reverted on-chain' }, { status: 500 });
    }

    return NextResponse.json({ success: true, txHash: receipt.transactionHash });
  } catch (e) {
    console.error('[SponsorNameTransfer] Error:', e);
    return NextResponse.json({ error: 'Transfer failed' }, { status: 500 });
  }
}
