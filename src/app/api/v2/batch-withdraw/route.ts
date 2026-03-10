import { ethers } from 'ethers'
import { NextResponse } from 'next/server'
import { getServerSponsor, getTxGasOverrides, GasPriceTooHighError, waitForTx } from '@/lib/server-provider'
import { DEFAULT_CHAIN_ID } from '@/config/chains'
import { getDustPoolV2Address, DUST_POOL_V2_ABI } from '@/lib/dustpool/v2/contracts'
import { syncAndPostRoot } from '@/lib/dustpool/v2/relayer-tree'
import { toBytes32Hex } from '@/lib/dustpool/poseidon'
import { computeAssetId } from '@/lib/dustpool/v2/commitment'
import { acquireNullifier, releaseNullifier } from '@/lib/dustpool/v2/pending-nullifiers'
import { checkCooldown } from '@/lib/dustpool/v2/persistent-cooldown'
import { screenRecipient } from '@/lib/dustpool/v2/relayer-compliance'
import { checkOrigin } from '@/lib/api-auth'

export const maxDuration = 120

const NO_STORE = { 'Cache-Control': 'no-store' } as const
// Jitter range: 2-15s between chunks (defeats FIFO timing correlation)
const MIN_JITTER_MS = 2_000
const MAX_JITTER_MS = 15_000
const MAX_BATCH_SIZE = 12

interface WithdrawalProof {
  proof: string
  publicSignals: string[]
  tokenAddress: string
}

interface BatchResult {
  index: number
  txHash: string
  blockNumber: number
  gasUsed: string
  fee: string
}

/** Fisher-Yates shuffle — randomizes withdrawal execution order */
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
    const proofs: WithdrawalProof[] = body.proofs

    if (!Array.isArray(proofs) || proofs.length === 0) {
      return NextResponse.json(
        { error: 'proofs must be a non-empty array' },
        { status: 400, headers: NO_STORE },
      )
    }
    if (proofs.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Batch too large (max ${MAX_BATCH_SIZE} proofs)` },
        { status: 400, headers: NO_STORE },
      )
    }

    const address = getDustPoolV2Address(chainId)
    if (!address) {
      return NextResponse.json(
        { error: 'DustPoolV2 not deployed on this chain' },
        { status: 404, headers: NO_STORE },
      )
    }

    // Validate all proofs upfront before starting batch
    for (let i = 0; i < proofs.length; i++) {
      const p = proofs[i]
      if (!p.proof || !Array.isArray(p.publicSignals) || p.publicSignals.length !== 9) {
        return NextResponse.json(
          { error: `Proof [${i}]: missing or invalid fields` },
          { status: 400, headers: NO_STORE },
        )
      }
      if (!/^0x[0-9a-fA-F]+$/.test(p.proof)) {
        return NextResponse.json(
          { error: `Proof [${i}]: invalid proof format` },
          { status: 400, headers: NO_STORE },
        )
      }
      if (!p.tokenAddress || !/^0x[0-9a-fA-F]{40}$/.test(p.tokenAddress)) {
        return NextResponse.json(
          { error: `Proof [${i}]: invalid tokenAddress` },
          { status: 400, headers: NO_STORE },
        )
      }

      const expectedAsset = await computeAssetId(chainId, p.tokenAddress)
      if (expectedAsset !== BigInt(p.publicSignals[6])) {
        return NextResponse.json(
          { error: `Proof [${i}]: tokenAddress does not match proof asset` },
          { status: 400, headers: NO_STORE },
        )
      }
      if (BigInt(p.publicSignals[8]) !== BigInt(chainId)) {
        return NextResponse.json(
          { error: `Proof [${i}]: chainId mismatch` },
          { status: 400, headers: NO_STORE },
        )
      }
    }

    // Sync tree once before the batch
    await syncAndPostRoot(chainId)

    const sponsor = getServerSponsor(chainId)
    const contract = new ethers.Contract(
      address,
      DUST_POOL_V2_ABI as unknown as ethers.ContractInterface,
      sponsor,
    )

    // Shuffle execution order to defeat FIFO timing analysis
    const indexed = proofs.map((p, i) => ({ ...p, originalIndex: i }))
    const shuffled = shuffle(indexed)

    const results: BatchResult[] = []
    const errors: Array<{ index: number; error: string }> = []
    const acquiredNullifiers: string[] = []

    try {
      for (let si = 0; si < shuffled.length; si++) {
        const item = shuffled[si]

        // Add jitter between chunks (not before the first one)
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

          // Compliance: screen recipient against on-chain oracle
          const screenResult = await screenRecipient(recipient, chainId)
          if (screenResult.blocked) {
            errors.push({ index: item.originalIndex, error: 'Recipient address is sanctioned' })
            continue
          }

          const gasOverrides = await getTxGasOverrides(chainId, 800_000)

          const tx = await contract.withdraw(
            item.proof,
            merkleRoot,
            nullifier0Hex,
            nullifier1Hex,
            outCommitment0,
            outCommitment1,
            publicAmount,
            publicAsset,
            recipient,
            item.tokenAddress,
            gasOverrides,
          )

          const receipt = await waitForTx(tx)

          if (receipt.status === 0) {
            throw new Error(`Batch-withdraw chunk reverted: ${receipt.transactionHash}`)
          }

          console.log(
            `[V2/batch-withdraw] Chunk ${si + 1}/${shuffled.length} success: tx=${receipt.transactionHash}`,
          )

          results.push({
            index: item.originalIndex,
            txHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            fee: receipt.effectiveGasPrice.mul(receipt.gasUsed).toString(),
          })
        } catch (chunkErr) {
          const msg = chunkErr instanceof Error ? chunkErr.message : 'Unknown error'
          console.error(`[V2/batch-withdraw] Chunk ${si + 1} failed:`, msg)
          errors.push({ index: item.originalIndex, error: msg })
        }
      }

      // Best-effort tree sync after batch completes
      try {
        await syncAndPostRoot(chainId)
      } catch (syncErr) {
        console.error('[V2/batch-withdraw] Post-batch tree sync failed (non-fatal):', syncErr)
      }

      // Sort results by original index so client can correlate
      results.sort((a, b) => a.index - b.index)
      errors.sort((a, b) => a.index - b.index)

      return NextResponse.json(
        { results, errors, total: proofs.length, succeeded: results.length },
        { headers: NO_STORE },
      )
    } finally {
      for (const n of acquiredNullifiers) {
        releaseNullifier(n)
      }
    }
  } catch (e) {
    console.error('[V2/batch-withdraw] Error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Batch withdrawal failed' },
      { status: 500, headers: NO_STORE },
    )
  }
}
