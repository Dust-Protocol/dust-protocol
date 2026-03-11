import { ethers } from 'ethers'
import { NextResponse } from 'next/server'
import { getServerSponsor, getTxGasOverrides, GasPriceTooHighError, waitForTx } from '@/lib/server-provider'
import { DEFAULT_CHAIN_ID, getChainConfig } from '@/config/chains'
import { getDustPoolV2Address, DUST_POOL_V2_ABI } from '@/lib/dustpool/v2/contracts'
import { DUST_SWAP_ADAPTER_GENERIC_ABI } from '@/lib/swap/contracts'
import { syncAndPostRoot } from '@/lib/dustpool/v2/relayer-tree'
import { toBytes32Hex } from '@/lib/dustpool/poseidon'
import { computeAssetId, poseidonHash } from '@/lib/dustpool/v2/commitment'
import { acquireNullifier, releaseNullifier } from '@/lib/dustpool/v2/pending-nullifiers'
import { checkCooldown } from '@/lib/dustpool/v2/persistent-cooldown'
import { incrementSwap, observeGasUsed, recordProofVerification } from '@/lib/metrics'
import { checkOrigin } from '@/lib/api-auth'

export const maxDuration = 60

const NO_STORE = { 'Cache-Control': 'no-store' } as const

const V2_ROUTER_IFACE = new ethers.utils.Interface([
  'function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[])',
  'function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])',
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])',
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])',
])

export async function POST(req: Request) {
  try {
    const originError = checkOrigin(req)
    if (originError) return originError

    const body = await req.json()
    const chainId = typeof body.targetChainId === 'number' ? body.targetChainId : DEFAULT_CHAIN_ID

    const config = getChainConfig(chainId)
    const adapterAddress = config.contracts.dustSwapAdapterV2
    if (!adapterAddress) {
      return NextResponse.json(
        { error: 'DustSwapAdapterV2 not deployed on this chain' },
        { status: 404, headers: NO_STORE },
      )
    }

    const poolAddress = getDustPoolV2Address(chainId)
    if (!poolAddress) {
      return NextResponse.json(
        { error: 'DustPoolV2 not deployed on this chain' },
        { status: 404, headers: NO_STORE },
      )
    }

    const routerAddress = config.contracts.dustSwapRouter
    const wflowAddress = config.contracts.dustSwapWflow
    if (!routerAddress || !wflowAddress) {
      return NextResponse.json(
        { error: 'Swap router not configured' },
        { status: 404, headers: NO_STORE },
      )
    }

    const {
      proof,
      publicSignals,
      tokenIn,
      tokenOut,
      ownerPubKey,
      blinding,
      relayerFeeBps = 100,
      minAmountOut,
    } = body

    if (!proof || !Array.isArray(publicSignals) || publicSignals.length !== 9) {
      return NextResponse.json(
        { error: 'Missing or invalid fields: proof (hex), publicSignals (9 elements)' },
        { status: 400, headers: NO_STORE },
      )
    }
    if (!/^0x[0-9a-fA-F]+$/.test(proof)) {
      return NextResponse.json({ error: 'Invalid proof format' }, { status: 400, headers: NO_STORE })
    }
    if (!tokenIn || !/^0x[0-9a-fA-F]{40}$/.test(tokenIn)) {
      return NextResponse.json({ error: 'Invalid tokenIn address' }, { status: 400, headers: NO_STORE })
    }
    if (!tokenOut || !/^0x[0-9a-fA-F]{40}$/.test(tokenOut)) {
      return NextResponse.json({ error: 'Invalid tokenOut address' }, { status: 400, headers: NO_STORE })
    }
    if (!ownerPubKey || !blinding) {
      return NextResponse.json(
        { error: 'Missing ownerPubKey or blinding' },
        { status: 400, headers: NO_STORE },
      )
    }
    if (typeof relayerFeeBps !== 'number' || relayerFeeBps < 0 || relayerFeeBps > 500) {
      return NextResponse.json(
        { error: 'relayerFeeBps must be a number between 0 and 500' },
        { status: 400, headers: NO_STORE },
      )
    }
    if (!minAmountOut || BigInt(minAmountOut) <= 0n) {
      return NextResponse.json(
        { error: 'minAmountOut must be > 0' },
        { status: 400, headers: NO_STORE },
      )
    }

    const expectedAsset = await computeAssetId(chainId, tokenIn)
    const proofAsset = BigInt(publicSignals[6])
    if (expectedAsset !== proofAsset) {
      return NextResponse.json(
        { error: 'tokenIn does not match proof asset' },
        { status: 400, headers: NO_STORE },
      )
    }

    const proofChainId = BigInt(publicSignals[8])
    if (proofChainId !== BigInt(chainId)) {
      return NextResponse.json(
        { error: 'Proof chainId does not match target chain' },
        { status: 400, headers: NO_STORE },
      )
    }

    const proofRecipient = BigInt(publicSignals[7])
    if (proofRecipient !== BigInt(adapterAddress)) {
      return NextResponse.json(
        { error: 'Proof recipient must be the swap adapter contract' },
        { status: 400, headers: NO_STORE },
      )
    }

    // Public signals: [merkleRoot, nullifier0, nullifier1, outCommitment0, outCommitment1, publicAmount, publicAsset, recipient, chainId]
    const nullifier0Hex = toBytes32Hex(BigInt(publicSignals[1]))
    const nullifier1Hex = toBytes32Hex(BigInt(publicSignals[2]))
    const nullifier1IsZero = BigInt(publicSignals[2]) === 0n

    if (!(await checkCooldown(nullifier0Hex))) {
      return NextResponse.json({ error: 'Please wait before retrying' }, { status: 429, headers: NO_STORE })
    }

    if (!acquireNullifier(nullifier0Hex)) {
      return NextResponse.json({ error: 'Nullifier already being processed' }, { status: 409, headers: NO_STORE })
    }
    if (!nullifier1IsZero && !acquireNullifier(nullifier1Hex)) {
      releaseNullifier(nullifier0Hex)
      return NextResponse.json({ error: 'Nullifier already being processed' }, { status: 409, headers: NO_STORE })
    }

    try {
      await syncAndPostRoot(chainId)

      const sponsor = getServerSponsor(chainId)
      const adapter = new ethers.Contract(
        adapterAddress,
        DUST_SWAP_ADAPTER_GENERIC_ABI as unknown as ethers.ContractInterface,
        sponsor,
      )

      const merkleRoot = toBytes32Hex(BigInt(publicSignals[0]))
      const nullifier0 = nullifier0Hex
      const nullifier1 = nullifier1Hex
      const outCommitment0 = toBytes32Hex(BigInt(publicSignals[3]))
      const outCommitment1 = toBytes32Hex(BigInt(publicSignals[4]))
      const publicAmount = BigInt(publicSignals[5])
      const publicAsset = BigInt(publicSignals[6])

      // Build V2 router swap calldata
      const isNativeIn = tokenIn.toLowerCase() === '0x0000000000000000000000000000000000000000'
      const isNativeOut = tokenOut.toLowerCase() === '0x0000000000000000000000000000000000000000'
      const deadline = Math.floor(Date.now() / 1000) + 300

      // Estimate swap output via getAmountsOut for commitment pre-computation
      const routerContract = new ethers.Contract(
        routerAddress,
        V2_ROUTER_IFACE,
        sponsor.provider,
      )
      const swapPath = isNativeIn
        ? [wflowAddress, tokenOut]
        : isNativeOut
          ? [tokenIn, wflowAddress]
          : [tokenIn, tokenOut]
      const amountsOut: ethers.BigNumber[] = await routerContract.getAmountsOut(publicAmount, swapPath)
      const estimatedOutput = amountsOut[amountsOut.length - 1]
      const estimatedFee = estimatedOutput.mul(relayerFeeBps).div(10_000)
      const estimatedUserAmount = estimatedOutput.sub(estimatedFee)

      // Validate user's minAmountOut against estimated output (after fee)
      if (estimatedUserAmount.lt(ethers.BigNumber.from(minAmountOut))) {
        releaseNullifier(nullifier0Hex)
        if (!nullifier1IsZero) releaseNullifier(nullifier1Hex)
        return NextResponse.json(
          { error: 'Estimated output below minAmountOut — pool may lack liquidity or slippage too high' },
          { status: 400, headers: NO_STORE },
        )
      }

      // Compute output commitment off-chain (Poseidon libraries too large for Flow EVM)
      const outputAssetId = await computeAssetId(chainId, tokenOut)
      const outputCommitmentBigInt = await poseidonHash([
        BigInt(ownerPubKey),
        estimatedUserAmount.toBigInt(),
        outputAssetId,
        BigInt(chainId),
        BigInt(blinding),
      ])
      const outputCommitmentHex = toBytes32Hex(outputCommitmentBigInt)

      // Router amountOutMin = estimatedOutput (pre-fee) to enforce the estimate on-chain.
      // This ensures actual swap output ≥ estimatedOutput so the commitment amount is correct.
      // Any positive slippage surplus stays in adapter (recoverable via emergencyWithdraw).
      let swapCalldata: string
      if (isNativeIn) {
        swapCalldata = V2_ROUTER_IFACE.encodeFunctionData('swapExactETHForTokens', [
          estimatedOutput,
          [wflowAddress, tokenOut],
          adapterAddress,
          deadline,
        ])
      } else if (isNativeOut) {
        swapCalldata = V2_ROUTER_IFACE.encodeFunctionData('swapExactTokensForETH', [
          publicAmount,
          estimatedOutput,
          [tokenIn, wflowAddress],
          adapterAddress,
          deadline,
        ])
      } else {
        swapCalldata = V2_ROUTER_IFACE.encodeFunctionData('swapExactTokensForTokens', [
          publicAmount,
          estimatedOutput,
          [tokenIn, tokenOut],
          adapterAddress,
          deadline,
        ])
      }

      const gasOverrides = await getTxGasOverrides(chainId, 900_000)

      // minAmountOut = estimated user amount (tight slippage — commitment must match deposit)
      const tx = await adapter.executeSwap(
        proof,
        merkleRoot,
        nullifier0,
        nullifier1,
        outCommitment0,
        outCommitment1,
        publicAmount,
        publicAsset,
        tokenIn,
        routerAddress,
        swapCalldata,
        estimatedUserAmount.toBigInt(),
        outputCommitmentHex,
        tokenOut,
        await sponsor.getAddress(),
        relayerFeeBps,
        gasOverrides,
      )

      const receipt = await waitForTx(tx)
      if (receipt.status !== 1) {
        throw new Error('Transaction reverted on-chain')
      }

      let outputCommitment: string | null = null
      let outputAmount: string | null = null
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === adapterAddress.toLowerCase()) {
          try {
            const parsed = adapter.interface.parseLog(log)
            if (parsed.name === 'PrivateSwapExecuted') {
              outputCommitment = parsed.args.outputCommitment
              outputAmount = parsed.args.outputAmount.toString()
            }
          } catch { /* not our event */ }
        }
      }

      if (!outputCommitment || !outputAmount) {
        return NextResponse.json(
          { error: 'PrivateSwapExecuted event not found in receipt' },
          { status: 500, headers: NO_STORE },
        )
      }

      const pool = new ethers.Contract(
        poolAddress,
        DUST_POOL_V2_ABI as unknown as ethers.ContractInterface,
        sponsor.provider,
      )
      let queueIndex: number | null = null
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === poolAddress.toLowerCase()) {
          try {
            const parsed = pool.interface.parseLog(log)
            if (parsed.name === 'DepositQueued') {
              queueIndex = parsed.args.queueIndex.toNumber()
            }
          } catch { /* not our event */ }
        }
      }

      const chainStr = String(chainId)
      incrementSwap(chainStr)
      recordProofVerification(chainStr, 'v2_transaction', true)
      observeGasUsed(chainStr, 'swap', receipt.gasUsed.toNumber())

      console.log(
        `[V2/swap-generic] Success: nullifier=${nullifier0.slice(0, 18)}... tx=${receipt.transactionHash}`,
      )

      try {
        await syncAndPostRoot(chainId)
      } catch (syncErr) {
        console.error('[V2/swap-generic] Post-TX tree sync failed (non-fatal):', syncErr)
      }

      return NextResponse.json(
        {
          txHash: receipt.transactionHash,
          outputCommitment,
          outputAmount,
          queueIndex,
          blockNumber: receipt.blockNumber,
        },
        { headers: NO_STORE },
      )
    } finally {
      releaseNullifier(nullifier0Hex)
      if (!nullifier1IsZero) releaseNullifier(nullifier1Hex)
    }
  } catch (e) {
    if (e instanceof GasPriceTooHighError) {
      return NextResponse.json({ error: 'Gas price too high' }, { status: 503, headers: NO_STORE })
    }
    console.error('[V2/swap-generic] Error:', e)
    const raw = e instanceof Error ? e.message : String(e)
    let message = 'Swap failed'
    if (raw.includes('InvalidProof')) message = 'Invalid proof'
    else if (raw.includes('NullifierAlreadySpent')) message = 'Note already spent'
    else if (raw.includes('UnknownRoot')) message = 'Invalid or expired Merkle root'
    else if (raw.includes('InsufficientPoolBalance')) message = 'Insufficient pool balance'
    else if (raw.includes('InvalidProofLength')) message = 'Invalid proof length (expected 768 bytes)'
    else if (raw.includes('InvalidFieldElement')) message = 'Invalid field element in public signals'
    else if (raw.includes('SlippageExceeded')) message = 'Swap slippage exceeded'
    else if (raw.includes('InvalidChainId')) message = 'Invalid chain ID in proof'
    else if (raw.includes('Sponsor not configured')) message = 'Relayer key not configured'
    else if (raw.includes('NotAllowedRouter')) message = 'Router not whitelisted on adapter'

    return NextResponse.json({ error: message, detail: raw.slice(0, 500) }, { status: 500, headers: NO_STORE })
  }
}
