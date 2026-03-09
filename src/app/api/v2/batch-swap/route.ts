import { ethers } from 'ethers'
import { NextResponse } from 'next/server'
import { getServerSponsor, getMaxGasPrice, waitForTx } from '@/lib/server-provider'
import { DEFAULT_CHAIN_ID } from '@/config/chains'
import { getDustSwapAdapterV2Config, getVanillaPoolKey, DUST_SWAP_ADAPTER_V2_ABI } from '@/lib/swap/contracts'
import { getDustPoolV2Address, DUST_POOL_V2_ABI } from '@/lib/dustpool/v2/contracts'
import { syncAndPostRoot } from '@/lib/dustpool/v2/relayer-tree'
import { toBytes32Hex } from '@/lib/dustpool/poseidon'
import { computeAssetId } from '@/lib/dustpool/v2/commitment'
import { acquireNullifier, releaseNullifier } from '@/lib/dustpool/v2/pending-nullifiers'
import { checkCooldown } from '@/lib/dustpool/v2/persistent-cooldown'
import { checkOrigin } from '@/lib/api-auth'

export const maxDuration = 120

const NO_STORE = { 'Cache-Control': 'no-store' } as const
const MIN_JITTER_MS = 2_000
const MAX_JITTER_MS = 15_000
const MAX_BATCH_SIZE = 12

interface SwapProof {
  proof: string
  publicSignals: string[]
  tokenIn: string
  tokenOut: string
  ownerPubKey: string
  blinding: string
  relayerFeeBps: number
  minAmountOut: string
}

interface BatchSwapResult {
  index: number
  txHash: string
  blockNumber: number
  gasUsed: string
  fee: string
  outputCommitment: string | null
  outputAmount: string | null
  queueIndex: number | null
}

/** Fisher-Yates shuffle — randomizes swap execution order */
function shuffle<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function randomJitter(): number {
  return MIN_JITTER_MS + Math.floor(Math.random() * (MAX_JITTER_MS - MIN_JITTER_MS))
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(req: Request) {
  try {
    const originError = checkOrigin(req)
    if (originError) return originError

    const body = await req.json()
    const chainId = typeof body.targetChainId === 'number' ? body.targetChainId : DEFAULT_CHAIN_ID
    const swaps: SwapProof[] = body.swaps

    if (!Array.isArray(swaps) || swaps.length === 0) {
      return NextResponse.json(
        { error: 'swaps must be a non-empty array' },
        { status: 400, headers: NO_STORE },
      )
    }
    if (swaps.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Batch too large (max ${MAX_BATCH_SIZE} swaps)` },
        { status: 400, headers: NO_STORE },
      )
    }

    const adapterConfig = getDustSwapAdapterV2Config(chainId)
    if (!adapterConfig) {
      return NextResponse.json(
        { error: 'DustSwapAdapterV2 not deployed on this chain' },
        { status: 404, headers: NO_STORE },
      )
    }

    const poolKey = getVanillaPoolKey(chainId)
    if (!poolKey) {
      return NextResponse.json(
        { error: 'Vanilla pool key not configured for this chain' },
        { status: 404, headers: NO_STORE },
      )
    }

    // Validate all swaps upfront before starting batch
    for (let i = 0; i < swaps.length; i++) {
      const s = swaps[i]
      if (!s.proof || !Array.isArray(s.publicSignals) || s.publicSignals.length !== 9) {
        return NextResponse.json(
          { error: `Swap [${i}]: missing or invalid fields` },
          { status: 400, headers: NO_STORE },
        )
      }
      if (!/^0x[0-9a-fA-F]+$/.test(s.proof)) {
        return NextResponse.json(
          { error: `Swap [${i}]: invalid proof format` },
          { status: 400, headers: NO_STORE },
        )
      }
      if (!s.tokenIn || !/^0x[0-9a-fA-F]{40}$/.test(s.tokenIn)) {
        return NextResponse.json(
          { error: `Swap [${i}]: invalid tokenIn` },
          { status: 400, headers: NO_STORE },
        )
      }
      if (!s.tokenOut || !/^0x[0-9a-fA-F]{40}$/.test(s.tokenOut)) {
        return NextResponse.json(
          { error: `Swap [${i}]: invalid tokenOut` },
          { status: 400, headers: NO_STORE },
        )
      }
      if (!s.ownerPubKey || !s.blinding) {
        return NextResponse.json(
          { error: `Swap [${i}]: missing ownerPubKey or blinding` },
          { status: 400, headers: NO_STORE },
        )
      }
      if (typeof s.relayerFeeBps !== 'number' || s.relayerFeeBps < 0 || s.relayerFeeBps > 500) {
        return NextResponse.json(
          { error: `Swap [${i}]: invalid relayerFeeBps (0-500)` },
          { status: 400, headers: NO_STORE },
        )
      }
      if (!s.minAmountOut || BigInt(s.minAmountOut) <= 0n) {
        return NextResponse.json(
          { error: `Swap [${i}]: minAmountOut must be > 0` },
          { status: 400, headers: NO_STORE },
        )
      }

      const expectedAsset = await computeAssetId(chainId, s.tokenIn)
      if (expectedAsset !== BigInt(s.publicSignals[6])) {
        return NextResponse.json(
          { error: `Swap [${i}]: tokenIn does not match proof asset` },
          { status: 400, headers: NO_STORE },
        )
      }
      if (BigInt(s.publicSignals[8]) !== BigInt(chainId)) {
        return NextResponse.json(
          { error: `Swap [${i}]: chainId mismatch` },
          { status: 400, headers: NO_STORE },
        )
      }
      // Recipient in proof must be the adapter contract
      if (BigInt(s.publicSignals[7]) !== BigInt(adapterConfig.address)) {
        return NextResponse.json(
          { error: `Swap [${i}]: proof recipient must be the swap adapter contract` },
          { status: 400, headers: NO_STORE },
        )
      }
    }

    // Sync tree once before the batch
    await syncAndPostRoot(chainId)

    const sponsor = getServerSponsor(chainId)
    const adapter = new ethers.Contract(
      adapterConfig.address,
      DUST_SWAP_ADAPTER_V2_ABI as unknown as ethers.ContractInterface,
      sponsor,
    )

    // Shuffle execution order to defeat FIFO timing analysis
    const indexed = swaps.map((s, i) => ({ ...s, originalIndex: i }))
    const shuffled = shuffle(indexed)

    const results: BatchSwapResult[] = []
    const errors: Array<{ index: number; error: string }> = []
    const acquiredNullifiers: string[] = []

    try {
      for (let si = 0; si < shuffled.length; si++) {
        const item = shuffled[si]

        if (si > 0) {
          const jitter = randomJitter()
          await sleep(jitter)
        }

        const nullifier0Hex = toBytes32Hex(BigInt(item.publicSignals[1]))
        const nullifier1Hex = toBytes32Hex(BigInt(item.publicSignals[2]))
        const nullifier1IsZero = BigInt(item.publicSignals[2]) === 0n

        if (!(await checkCooldown(nullifier0Hex))) {
          errors.push({ index: item.originalIndex, error: 'Rate limited' })
          continue
        }

        if (!acquireNullifier(nullifier0Hex)) {
          errors.push({ index: item.originalIndex, error: 'Nullifier already being processed' })
          continue
        }
        acquiredNullifiers.push(nullifier0Hex)

        if (!nullifier1IsZero && !acquireNullifier(nullifier1Hex)) {
          releaseNullifier(nullifier0Hex)
          acquiredNullifiers.pop()
          errors.push({ index: item.originalIndex, error: 'Nullifier already being processed' })
          continue
        }
        if (!nullifier1IsZero) acquiredNullifiers.push(nullifier1Hex)

        try {
          const merkleRoot = toBytes32Hex(BigInt(item.publicSignals[0]))
          const outCommitment0 = toBytes32Hex(BigInt(item.publicSignals[3]))
          const outCommitment1 = toBytes32Hex(BigInt(item.publicSignals[4]))
          const publicAmount = BigInt(item.publicSignals[5])
          const publicAsset = BigInt(item.publicSignals[6])
          const recipientBigInt = BigInt(item.publicSignals[7])
          const recipient = ethers.utils.getAddress(
            '0x' + recipientBigInt.toString(16).padStart(40, '0'),
          )

          // Swap outputs are UTXO commitments re-deposited into DustPoolV2 —
          // recipient is the adapter contract (validated at line 156), not an end-user.
          // Screening skipped intentionally (matches single swap route behavior).

          const feeData = await sponsor.provider.getFeeData()
          const maxFeePerGas = feeData.maxFeePerGas || ethers.utils.parseUnits('5', 'gwei')
          if (maxFeePerGas.gt(getMaxGasPrice(chainId))) {
            errors.push({ index: item.originalIndex, error: 'Gas price too high' })
            continue
          }

          // Determine swap direction from tokenIn vs pool currency0
          const zeroForOne = item.tokenIn.toLowerCase() === poolKey.currency0.toLowerCase()

          const tx = await adapter.executeSwap(
            item.proof,
            merkleRoot,
            nullifier0Hex,
            nullifier1Hex,
            outCommitment0,
            outCommitment1,
            publicAmount,
            publicAsset,
            item.tokenIn,
            {
              currency0: poolKey.currency0,
              currency1: poolKey.currency1,
              fee: poolKey.fee,
              tickSpacing: poolKey.tickSpacing,
              hooks: poolKey.hooks,
            },
            zeroForOne,
            BigInt(item.minAmountOut),
            BigInt(item.ownerPubKey),
            BigInt(item.blinding),
            item.tokenOut,
            await sponsor.getAddress(),
            item.relayerFeeBps,
            {
              gasLimit: 1_500_000,
              type: 2,
              maxFeePerGas,
              maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.utils.parseUnits('1.5', 'gwei'),
            },
          )

          const receipt = await waitForTx(tx)
          if (receipt.status !== 1) {
            throw new Error('Transaction reverted on-chain')
          }

          // Parse PrivateSwapExecuted event for output commitment and amount
          let outputCommitment: string | null = null
          let outputAmount: string | null = null
          let queueIndex: number | null = null
          try {
            const iface = new ethers.utils.Interface(DUST_SWAP_ADAPTER_V2_ABI as unknown as string[])
            for (const log of receipt.logs) {
              try {
                const parsed = iface.parseLog(log)
                if (parsed.name === 'PrivateSwapExecuted') {
                  outputCommitment = parsed.args.outputCommitment
                  outputAmount = parsed.args.outputAmount.toString()
                  break
                }
              } catch {
                // Log from a different contract — skip
              }
            }
          } catch (parseErr) {
            console.warn(`[V2/batch-swap] Event parsing failed for chunk ${si + 1}:`, parseErr)
          }

          // Parse DepositQueued from DustPoolV2 for the output UTXO queue index
          const poolAddress = getDustPoolV2Address(chainId)
          if (poolAddress) {
            const pool = new ethers.Contract(
              poolAddress,
              DUST_POOL_V2_ABI as unknown as ethers.ContractInterface,
              sponsor.provider,
            )
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
          }

          console.log(
            `[V2/batch-swap] Chunk ${si + 1}/${shuffled.length} success: tx=${receipt.transactionHash}`,
          )

          results.push({
            index: item.originalIndex,
            txHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            fee: receipt.effectiveGasPrice.mul(receipt.gasUsed).toString(),
            outputCommitment,
            outputAmount,
            queueIndex,
          })
        } catch (chunkErr) {
          const msg = chunkErr instanceof Error ? chunkErr.message : 'Unknown error'
          console.error(`[V2/batch-swap] Chunk ${si + 1} failed:`, msg)
          errors.push({ index: item.originalIndex, error: msg })
        }
      }

      try {
        await syncAndPostRoot(chainId)
      } catch (syncErr) {
        console.error('[V2/batch-swap] Post-batch tree sync failed (non-fatal):', syncErr)
      }

      results.sort((a, b) => a.index - b.index)
      errors.sort((a, b) => a.index - b.index)

      return NextResponse.json(
        { results, errors, total: swaps.length, succeeded: results.length },
        { headers: NO_STORE },
      )
    } finally {
      for (const n of acquiredNullifiers) {
        releaseNullifier(n)
      }
    }
  } catch (e) {
    console.error('[V2/batch-swap] Error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Batch swap failed' },
      { status: 500, headers: NO_STORE },
    )
  }
}
