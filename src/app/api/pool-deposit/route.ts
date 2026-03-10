import { ethers } from 'ethers';
import { NextResponse } from 'next/server';
import { DUST_POOL_ABI } from '@/lib/stealth/types';
import { getChainConfig } from '@/config/chains';
import { getServerProvider, getServerSponsor, parseChainId, getTxGasOverrides, GasPriceTooHighError, waitForTx } from '@/lib/server-provider';
import { checkOrigin } from '@/lib/api-auth';

export const maxDuration = 60;

const SPONSOR_KEY = process.env.RELAYER_PRIVATE_KEY;

const FACTORY_ABI = [
  'function deploy(address _owner) returns (address)',
  'function computeAddress(address) view returns (address)',
];
const STEALTH_WALLET_ABI = [
  'function execute(address to, uint256 value, bytes data, bytes sig)',
  'function nonce() view returns (uint256)',
];

// Rate limiting
const claimCooldowns = new Map<string, number>();
const CLAIM_COOLDOWN_MS = 10_000;
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

/**
 * Pool deposit — stealth wallet deposits DIRECTLY into DustPool.
 *
 * For CREATE2 wallets: uses StealthWallet.execute() to call DustPool.deposit()
 * so the deposit comes FROM the stealth wallet address (not the sponsor).
 *
 * For ERC-4337 accounts: handled client-side via bundle API (UserOp with
 * StealthAccount.execute() → DustPool.deposit()). This route is not used.
 */
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

    const { stealthAddress, owner, signature, commitment, walletType } = body;

    if (!stealthAddress || !commitment) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: NO_STORE });
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(commitment)) {
      return NextResponse.json({ error: 'Invalid commitment format' }, { status: 400, headers: NO_STORE });
    }
    if (!isValidAddress(stealthAddress)) {
      return NextResponse.json({ error: 'Invalid stealth address' }, { status: 400 });
    }

    // Rate limiting
    const addrKey = stealthAddress.toLowerCase();
    const lastClaim = claimCooldowns.get(addrKey);
    if (lastClaim && Date.now() - lastClaim < CLAIM_COOLDOWN_MS) {
      return NextResponse.json({ error: 'Please wait before claiming again' }, { status: 429 });
    }
    claimCooldowns.set(addrKey, Date.now());

    const provider = getServerProvider(chainId);
    const sponsor = getServerSponsor(chainId);

    const txOpts = await getTxGasOverrides(chainId, 300_000);
    const dustPoolAddress = config.contracts.dustPool;

    if (walletType === 'create2' && owner && signature) {
      // CREATE2 wallet: deploy if needed, then execute DustPool.deposit() directly
      const balance = await provider.getBalance(stealthAddress);
      if (balance.isZero()) {
        return NextResponse.json({ error: 'No funds in stealth address' }, { status: 400 });
      }

      const existingCode = await provider.getCode(stealthAddress);
      const alreadyDeployed = existingCode !== '0x';

      // Deploy wallet if not already deployed
      if (!alreadyDeployed) {
        const newFactory = new ethers.Contract(config.contracts.walletFactory, FACTORY_ABI, sponsor);
        const newFactoryAddr = await newFactory.computeAddress(owner);
        let factory;
        if (newFactoryAddr.toLowerCase() === stealthAddress.toLowerCase()) {
          factory = newFactory;
        } else if (config.contracts.legacyWalletFactory) {
          factory = new ethers.Contract(config.contracts.legacyWalletFactory, FACTORY_ABI, sponsor);
        } else {
          return NextResponse.json({ error: 'Stealth address does not match wallet factory' }, { status: 400 });
        }

        console.log('[PoolDeposit] Deploying CREATE2 wallet for', stealthAddress);
        const deployTx = await factory.deploy(owner, { ...txOpts, gasLimit: 300_000 });
        await waitForTx(deployTx);
      }

      // Encode DustPool.deposit(commitment) calldata
      const poolIface = new ethers.utils.Interface(DUST_POOL_ABI);
      const depositCalldata = poolIface.encodeFunctionData('deposit', [commitment, balance]);

      // Call wallet.execute(DustPool, balance, depositCalldata, sig)
      // The wallet makes an internal call to DustPool.deposit{value: balance}(commitment)
      // Deposit comes FROM the stealth wallet address, not the sponsor
      const wallet = new ethers.Contract(stealthAddress, STEALTH_WALLET_ABI, sponsor);

      console.log('[PoolDeposit] Stealth wallet', stealthAddress, 'depositing', ethers.utils.formatEther(balance), 'directly into DustPool');

      const executeTx = await wallet.execute(
        dustPoolAddress,
        balance,
        depositCalldata,
        signature,
        { ...txOpts, gasLimit: 8_000_000 },
      );
      const receipt = await waitForTx(executeTx);

      // Parse Deposit event to get leafIndex
      const poolContract = new ethers.Contract(dustPoolAddress, DUST_POOL_ABI, provider);
      const depositEvent = receipt.logs.find((log: ethers.providers.Log) => {
        try {
          const parsed = poolContract.interface.parseLog(log);
          return parsed.name === 'Deposit';
        } catch { return false; }
      });

      let leafIndex = 0;
      if (depositEvent) {
        const parsed = poolContract.interface.parseLog(depositEvent);
        leafIndex = parsed.args.leafIndex.toNumber();
      }

      console.log('[PoolDeposit] Success, leafIndex:', leafIndex);

      return NextResponse.json({
        success: true,
        txHash: receipt.transactionHash,
        leafIndex,
        amount: ethers.utils.formatEther(balance),
      }, { headers: NO_STORE });
    } else if (walletType === 'eoa') {
      return NextResponse.json({ error: 'EOA wallets not supported for pool deposit' }, { status: 400 });
    } else if (walletType === 'eip7702') {
      return NextResponse.json({ error: 'EIP-7702 pool deposits use the delegate-7702 API (pool-deposit mode)' }, { status: 400 });
    } else if (walletType === 'account') {
      return NextResponse.json({ error: 'ERC-4337 accounts should use the bundle API for direct pool deposits' }, { status: 400 });
    } else {
      return NextResponse.json({ error: 'Invalid wallet type or missing parameters' }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof GasPriceTooHighError) {
      return NextResponse.json({ error: 'Gas price too high' }, { status: 503 });
    }
    console.error('[PoolDeposit] Error:', e);
    return NextResponse.json({ error: 'Pool deposit failed' }, { status: 500 });
  }
}
