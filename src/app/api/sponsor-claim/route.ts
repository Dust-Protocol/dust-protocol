import { ethers } from 'ethers';
import { NextResponse } from 'next/server';
import { getChainConfig, isL2Chain } from '@/config/chains';
import { isKnownToken } from '@/config/tokens';
import { getServerProvider, getServerSponsor, parseChainId, getMaxGasPrice, waitForTx } from '@/lib/server-provider';
import { canUseGelato, sponsoredRelay, waitForRelay } from '@/lib/relay/gelato';
import { checkOrigin } from '@/lib/api-auth';

export const maxDuration = 60;

const SPONSOR_KEY = process.env.RELAYER_PRIVATE_KEY;

// Rate limiting: per-address cooldown + global request counter
const claimCooldowns = new Map<string, number>();
const CLAIM_COOLDOWN_MS = 10_000; // 10 seconds between claims per stealth address

// Global rate limiting: max claims per time window across all addresses
const GLOBAL_WINDOW_MS = 60_000; // 1 minute window
const GLOBAL_MAX_CLAIMS = 10; // max 10 claims per minute globally
let globalClaimTimestamps: number[] = [];

// Sponsor balance monitoring — per-chain to avoid one low-balance chain pausing all
const sponsorBalanceState = new Map<number, { paused: boolean; lastCheck: number }>();
function getMinSponsorBalance(chainId: number): ethers.BigNumber {
  return isL2Chain(chainId) ? ethers.utils.parseEther('0.01') : ethers.utils.parseEther('0.1');
}
const BALANCE_CHECK_INTERVAL_MS = 30_000;

function checkGlobalRateLimit(): boolean {
  const now = Date.now();
  globalClaimTimestamps = globalClaimTimestamps.filter(t => now - t < GLOBAL_WINDOW_MS);
  if (globalClaimTimestamps.length >= GLOBAL_MAX_CLAIMS) return false;
  globalClaimTimestamps.push(now);
  return true;
}

async function checkSponsorBalance(provider: ethers.providers.Provider, sponsorAddress: string, chainId: number): Promise<boolean> {
  const now = Date.now();
  const state = sponsorBalanceState.get(chainId) ?? { paused: false, lastCheck: 0 };
  if (now - state.lastCheck < BALANCE_CHECK_INTERVAL_MS) return !state.paused;
  state.lastCheck = now;
  try {
    const balance = await provider.getBalance(sponsorAddress);
    state.paused = balance.lt(getMinSponsorBalance(chainId));
    if (state.paused) console.error(`[Sponsor] Chain ${chainId}: balance below threshold — pausing claims`);
    sponsorBalanceState.set(chainId, state);
    return !state.paused;
  } catch {
    sponsorBalanceState.set(chainId, state);
    return !state.paused;
  }
}

const FACTORY_ABI = [
  'function deployAndDrain(address _owner, address _to, bytes _sig)',
  'function deploy(address _owner) returns (address)',
  'function computeAddress(address) view returns (address)',
];
const STEALTH_WALLET_ABI = [
  'function drain(address to, bytes sig)',
  'function execute(address to, uint256 value, bytes data, bytes sig)',
];

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
];

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

    // Global rate limiting
    if (!checkGlobalRateLimit()) {
      return NextResponse.json({ error: 'Service busy, please try again shortly' }, { status: 429 });
    }

    const body = await req.json();
    const chainId = parseChainId(body);
    const config = getChainConfig(chainId);

    // Sponsor balance monitoring
    const provider = getServerProvider(chainId);
    const sponsor = getServerSponsor(chainId);
    if (!(await checkSponsorBalance(provider, sponsor.address, chainId))) {
      return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
    }

    // Token sweep for already-deployed CREATE2 wallets
    if (body.tokenSweeps && body.stealthAddress && body.owner) {
      return handleTokenSweep(body, chainId);
    }

    // Signature-based claim (CREATE2)
    if (body.signature && body.owner) {
      return handleCreate2Claim(body, chainId);
    }
    // Legacy EOA claim path REMOVED — private keys must never be sent to the server.
    // EOA stealth addresses should be claimed via CREATE2 or ERC-4337 flows.
    return NextResponse.json(
      { error: 'Legacy EOA claims are no longer supported. Use CREATE2 or ERC-4337 claim flow.' },
      { status: 400 }
    );
  } catch (e) {
    console.error('[Sponsor] Error:', e);
    return NextResponse.json({ error: 'Withdrawal failed' }, { status: 500 });
  }
}

// CREATE2 wallet claim: owner signs drain message client-side, sponsor calls factory.deployAndDrain
async function handleCreate2Claim(body: { stealthAddress: string; owner: string; recipient: string; signature: string }, chainId: number) {
  const { stealthAddress, owner, recipient, signature } = body;
  const config = getChainConfig(chainId);

  if (!stealthAddress || !owner || !recipient || !signature) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!isValidAddress(stealthAddress) || !isValidAddress(owner) || !isValidAddress(recipient)) {
    return NextResponse.json({ error: 'Invalid address format' }, { status: 400 });
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

  const balance = await provider.getBalance(stealthAddress);
  if (balance.isZero()) {
    return NextResponse.json({ error: 'No funds in stealth address' }, { status: 400 });
  }

  const [feeData, block] = await Promise.all([
    provider.getFeeData(),
    provider.getBlock('latest'),
  ]);
  const baseFee = block.baseFeePerGas || feeData.gasPrice || ethers.utils.parseUnits('1', 'gwei');
  const maxPriorityFee = feeData.maxPriorityFeePerGas || ethers.utils.parseUnits('1.5', 'gwei');
  const maxFeePerGas = baseFee.mul(3).lt(baseFee.add(maxPriorityFee))
    ? baseFee.add(maxPriorityFee).mul(2)
    : baseFee.mul(3);

  if (maxFeePerGas.gt(getMaxGasPrice(chainId))) {
    return NextResponse.json({ error: 'Gas price too high, try again later' }, { status: 503 });
  }

  console.log('[Sponsor/CREATE2] Processing claim');

  const gasLimit = ethers.BigNumber.from(600_000);

  // Check if wallet is already deployed (e.g. from a previous partial claim)
  const existingCode = await provider.getCode(stealthAddress);
  const alreadyDeployed = existingCode !== '0x';

  // Build calldata and target for both Gelato and sponsor wallet paths
  const factoryIface = new ethers.utils.Interface(FACTORY_ABI);
  const walletIface = new ethers.utils.Interface(STEALTH_WALLET_ABI);

  let target: string;
  let calldata: string;

  if (alreadyDeployed) {
    console.log('[Sponsor/CREATE2] Wallet already deployed, calling drain directly');
    target = stealthAddress;
    calldata = walletIface.encodeFunctionData('drain', [recipient, signature]);
  } else {
    // Determine which factory deployed the CREATE2 address
    const newFactory = new ethers.Contract(config.contracts.walletFactory, FACTORY_ABI, provider);
    const newFactoryAddr = await newFactory.computeAddress(owner);
    if (newFactoryAddr.toLowerCase() === stealthAddress.toLowerCase()) {
      target = config.contracts.walletFactory;
    } else if (config.contracts.legacyWalletFactory) {
      target = config.contracts.legacyWalletFactory;
    } else {
      return NextResponse.json({ error: 'Stealth address does not match wallet factory' }, { status: 400 });
    }
    calldata = factoryIface.encodeFunctionData('deployAndDrain', [owner, recipient, signature]);
  }

  // Primary path: Gelato Relay (gasless via 1Balance)
  if (canUseGelato(chainId)) {
    try {
      console.log('[Claim] Using Gelato relay');
      const relayResult = await sponsoredRelay(chainId, target, calldata);
      const { txHash } = await waitForRelay(relayResult.taskId);

      console.log('[Sponsor/CREATE2] Claim complete via Gelato');

      return NextResponse.json({
        success: true,
        txHash,
        amount: ethers.utils.formatEther(balance),
        gasFunded: '0',
      }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (gelatoError) {
      console.warn('[Claim] Gelato relay failed, falling back to sponsor wallet:', gelatoError);
    }
  }

  // Fallback path: sponsor wallet sends tx directly
  console.log('[Claim] Using sponsor wallet');

  let tx;
  if (alreadyDeployed) {
    const wallet = new ethers.Contract(stealthAddress, STEALTH_WALLET_ABI, sponsor);
    tx = await wallet.drain(recipient, signature, {
      gasLimit,
      type: 2,
      maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFee,
    });
  } else {
    const factory = new ethers.Contract(target, FACTORY_ABI, sponsor);
    tx = await factory.deployAndDrain(owner, recipient, signature, {
      gasLimit,
      type: 2,
      maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFee,
    });
  }
  const receipt = await waitForTx(tx);

  if (receipt.status === 0) {
    console.error('[Sponsor/CREATE2] Transaction reverted:', receipt.transactionHash);
    return NextResponse.json({ error: 'Claim transaction reverted on-chain' }, { status: 500 });
  }

  console.log('[Sponsor/CREATE2] Claim complete via sponsor wallet');

  return NextResponse.json({
    success: true,
    txHash: receipt.transactionHash,
    amount: ethers.utils.formatEther(balance),
    gasFunded: '0',
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// Sweep ERC-20 tokens from a deployed CREATE2 stealth wallet via execute()
interface TokenSweepEntry {
  tokenAddress: string;
  signature: string; // signature for execute(tokenAddr, 0, transfer(recipient, amount))
}

async function handleTokenSweep(
  body: {
    stealthAddress: string;
    owner: string;
    recipient: string;
    tokenSweeps: TokenSweepEntry[];
    chainId?: number;
  },
  chainId: number,
) {
  const { stealthAddress, owner, recipient, tokenSweeps } = body;

  if (!stealthAddress || !owner || !recipient || !Array.isArray(tokenSweeps) || tokenSweeps.length === 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!isValidAddress(stealthAddress) || !isValidAddress(owner) || !isValidAddress(recipient)) {
    return NextResponse.json({ error: 'Invalid address format' }, { status: 400 });
  }
  if (tokenSweeps.length > 10) {
    return NextResponse.json({ error: 'Too many tokens (max 10)' }, { status: 400 });
  }

  // Rate limiting
  const addrKey = `sweep_${stealthAddress.toLowerCase()}`;
  const lastClaim = claimCooldowns.get(addrKey);
  if (lastClaim && Date.now() - lastClaim < CLAIM_COOLDOWN_MS) {
    return NextResponse.json({ error: 'Please wait before sweeping again' }, { status: 429 });
  }
  claimCooldowns.set(addrKey, Date.now());

  const provider = getServerProvider(chainId);
  const sponsor = getServerSponsor(chainId);

  // Wallet must already be deployed for token sweeps
  const code = await provider.getCode(stealthAddress);
  if (code === '0x') {
    return NextResponse.json({ error: 'Wallet not deployed — drain native balance first' }, { status: 400 });
  }

  const [feeData, block] = await Promise.all([
    provider.getFeeData(),
    provider.getBlock('latest'),
  ]);
  const baseFee = block.baseFeePerGas || feeData.gasPrice || ethers.utils.parseUnits('1', 'gwei');
  const maxPriorityFee = feeData.maxPriorityFeePerGas || ethers.utils.parseUnits('1.5', 'gwei');
  const maxFeePerGas = baseFee.mul(3).lt(baseFee.add(maxPriorityFee))
    ? baseFee.add(maxPriorityFee).mul(2)
    : baseFee.mul(3);

  if (maxFeePerGas.gt(getMaxGasPrice(chainId))) {
    return NextResponse.json({ error: 'Gas price too high, try again later' }, { status: 503 });
  }

  const walletIface = new ethers.utils.Interface(STEALTH_WALLET_ABI);
  const erc20Iface = new ethers.utils.Interface(ERC20_ABI);
  const results: { token: string; txHash: string; amount: string }[] = [];
  const useGelato = canUseGelato(chainId);

  for (const sweep of tokenSweeps) {
    if (!isValidAddress(sweep.tokenAddress)) {
      console.warn(`[TokenSweep] Skipping invalid token address: ${sweep.tokenAddress}`);
      continue;
    }

    // H4: Verify token is in known registry to prevent sweeping arbitrary contracts
    if (!isKnownToken(chainId, sweep.tokenAddress)) {
      console.warn(`[TokenSweep] Skipping unknown token ${sweep.tokenAddress} on chain ${chainId}`);
      continue;
    }

    try {
      // H4: Verify the stealth wallet actually holds a non-zero balance of this token
      const token = new ethers.Contract(sweep.tokenAddress, ERC20_ABI, provider);
      const balance: ethers.BigNumber = await token.balanceOf(stealthAddress);
      if (balance.isZero()) {
        console.warn(`[TokenSweep] Skipping ${sweep.tokenAddress}: zero balance`);
        continue;
      }

      const transferData = erc20Iface.encodeFunctionData('transfer', [recipient, balance]);
      let txHash: string;

      // Primary: Gelato relay
      if (useGelato) {
        try {
          const calldata = walletIface.encodeFunctionData('execute', [
            sweep.tokenAddress, 0, transferData, sweep.signature,
          ]);
          const relayResult = await sponsoredRelay(chainId, stealthAddress, calldata);
          const result = await waitForRelay(relayResult.taskId);
          txHash = result.txHash;
        } catch (gelatoErr) {
          console.warn(`[TokenSweep/Gelato] Failed for ${sweep.tokenAddress}, falling back:`, gelatoErr);
          // Fallback to sponsor wallet
          const wallet = new ethers.Contract(stealthAddress, STEALTH_WALLET_ABI, sponsor);
          const tx = await wallet.execute(sweep.tokenAddress, 0, transferData, sweep.signature, {
            gasLimit: ethers.BigNumber.from(200_000),
            type: 2,
            maxFeePerGas,
            maxPriorityFeePerGas: maxPriorityFee,
          });
          const receipt = await waitForTx(tx);
          if (receipt.status === 0) throw new Error(`Token sweep reverted: ${receipt.transactionHash}`);
          txHash = receipt.transactionHash;
        }
      } else {
        // Sponsor wallet path
        const wallet = new ethers.Contract(stealthAddress, STEALTH_WALLET_ABI, sponsor);
        const tx = await wallet.execute(sweep.tokenAddress, 0, transferData, sweep.signature, {
          gasLimit: ethers.BigNumber.from(200_000),
          type: 2,
          maxFeePerGas,
          maxPriorityFeePerGas: maxPriorityFee,
        });
        const receipt = await waitForTx(tx);
        if (receipt.status === 0) throw new Error(`Token sweep reverted: ${receipt.transactionHash}`);
        txHash = receipt.transactionHash;
      }

      // C4: Verify the transfer actually succeeded by checking post-transfer balance
      try {
        const postBalance: ethers.BigNumber = await token.balanceOf(stealthAddress);
        if (!postBalance.isZero()) {
          console.warn(`[TokenSweep] Transfer may have partially failed for ${sweep.tokenAddress}: post-balance=${postBalance.toString()}`);
        }
      } catch {
        // Non-critical: just log and continue
        console.warn(`[TokenSweep] Could not verify post-transfer balance for ${sweep.tokenAddress}`);
      }

      results.push({
        token: sweep.tokenAddress,
        txHash,
        amount: balance.toString(),
      });
    } catch (e) {
      console.warn(`[Sponsor/TokenSweep] Failed for ${sweep.tokenAddress}:`, e);
    }
  }

  console.log(`[Sponsor/TokenSweep] Swept ${results.length}/${tokenSweeps.length} tokens`);

  return NextResponse.json({
    success: true,
    swept: results,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

