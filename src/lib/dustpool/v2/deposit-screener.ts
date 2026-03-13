// Server-side deposit screener: scans DepositQueued events, checks each
// depositor against the Chainalysis compliance oracle, and adds flagged
// commitments to the exclusion SMT. Designed to run during the relayer
// health cycle (one cycle per health check).
//
// Cursor is persisted to /tmp so the screener resumes where it left off
// across cold starts.

import { ethers } from 'ethers'
import { readFile, writeFile } from 'fs/promises'
import { getServerProvider } from '@/lib/server-provider'
import { getDustPoolV2Address, DUST_POOL_V2_ABI } from './contracts'
import { screenRecipient } from './relayer-compliance'
import { checkSanctionsStatus } from './chainalysis-api'
import { addFlaggedCommitment, getExclusionRoot, getFlaggedCount } from './exclusion-tree'
import { toBytes32Hex } from '@/lib/dustpool/poseidon'
import { pinToIPFS } from '@/lib/ipfs/storacha-client'

const BATCH_SIZE = 100
const MAX_BLOCK_RANGE = 5000

interface ScreenerCursor {
  lastBlock: number
  flaggedCount: number
  updatedAt: number
}

export interface ScreenerCycleResult {
  lastBlock: number
  flaggedCount: number
  newFlagged: number
  eventsProcessed: number
}

function cursorPath(chainId: number): string {
  return `/tmp/dust-v2-screener-${chainId}.json`
}

async function loadCursor(chainId: number): Promise<ScreenerCursor | null> {
  try {
    const data = await readFile(cursorPath(chainId), 'utf-8')
    return JSON.parse(data) as ScreenerCursor
  } catch {
    return null
  }
}

async function saveCursor(chainId: number, cursor: ScreenerCursor): Promise<void> {
  await writeFile(cursorPath(chainId), JSON.stringify(cursor)).catch(() => {})
}

/**
 * Run one screening cycle: scan new DepositQueued events, check each
 * depositor's originator address against the compliance oracle, flag
 * blocked commitments in the SMT, and post the updated exclusion root.
 */
export async function runDepositScreenerCycle(
  chainId: number
): Promise<ScreenerCycleResult> {
  const poolAddress = getDustPoolV2Address(chainId)
  if (!poolAddress) {
    return { lastBlock: 0, flaggedCount: 0, newFlagged: 0, eventsProcessed: 0 }
  }

  const provider = getServerProvider(chainId)
  const pool = new ethers.Contract(
    poolAddress,
    DUST_POOL_V2_ABI as unknown as ethers.ContractInterface,
    provider
  )

  const latestBlock = await provider.getBlockNumber()
  const cursor = await loadCursor(chainId)
  const fromBlock = cursor ? cursor.lastBlock + 1 : latestBlock - 1000

  if (fromBlock > latestBlock) {
    return {
      lastBlock: cursor?.lastBlock ?? latestBlock,
      flaggedCount: cursor?.flaggedCount ?? 0,
      newFlagged: 0,
      eventsProcessed: 0,
    }
  }

  // Limit block range to avoid RPC timeouts
  const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, latestBlock)

  const depositFilter = pool.filters.DepositQueued()
  let events: ethers.Event[]
  try {
    events = await pool.queryFilter(depositFilter, fromBlock, toBlock)
  } catch (e) {
    console.error(`[Screener] Failed to query DepositQueued events: ${e instanceof Error ? e.message : e}`)
    return {
      lastBlock: cursor?.lastBlock ?? fromBlock - 1,
      flaggedCount: cursor?.flaggedCount ?? 0,
      newFlagged: 0,
      eventsProcessed: 0,
    }
  }

  let newFlagged = 0
  let processed = 0

  // Process in batches
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE)

    for (const event of batch) {
      if (!event.args) continue
      const commitment: string = event.args.commitment
      processed++

      // Read the originator (depositor) from the contract's depositOriginator mapping
      let originator: string
      try {
        originator = await pool.depositOriginator(commitment)
      } catch {
        continue
      }

      if (originator === ethers.constants.AddressZero) continue

      // On-chain oracle check (fail-closed — oracle errors block the depositor)
      const screenResult = await screenRecipient(originator, chainId)

      // Chainalysis API check (fail-open — API errors log but don't block,
      // the on-chain oracle is the backstop)
      let chainalysisFlagged = false
      try {
        const sanctionsResult = await checkSanctionsStatus(originator)
        chainalysisFlagged = sanctionsResult.sanctioned
        if (chainalysisFlagged) {
          console.log(
            `[Screener] Chainalysis flagged depositor ${originator}: ${sanctionsResult.identifications.map(i => i.category).join(', ')}`
          )
        }
      } catch (e) {
        console.error(
          `[Screener] Chainalysis API error for ${originator} (fail-open):`,
          e instanceof Error ? e.message : e
        )
      }

      if (screenResult.blocked || chainalysisFlagged) {
        const commitmentBigint = BigInt(commitment)
        await addFlaggedCommitment(chainId, commitmentBigint)
        newFlagged++
        const source = screenResult.blocked && chainalysisFlagged
          ? 'oracle+chainalysis'
          : screenResult.blocked ? 'oracle' : 'chainalysis'
        console.log(
          `[Screener] Flagged commitment ${commitment.slice(0, 18)}... from blocked depositor ${originator} (${source})`
        )
      }
    }
  }

  // Post updated exclusion root on-chain if new flags were added
  if (newFlagged > 0) {
    try {
      const { getServerSponsor } = await import('@/lib/server-provider')
      const sponsor = getServerSponsor(chainId)
      const poolWriter = new ethers.Contract(
        poolAddress,
        DUST_POOL_V2_ABI as unknown as ethers.ContractInterface,
        sponsor
      )
      const root = await getExclusionRoot(chainId)
      const rootHex = toBytes32Hex(root)
      const totalFlaggedCount = await getFlaggedCount(chainId)

      // Pin exclusion tree snapshot to IPFS before posting root on-chain
      try {
        const snapshot: Record<string, unknown> = {
          version: 1,
          chainId,
          timestamp: new Date().toISOString(),
          exclusionRoot: rootHex,
          newFlaggedCount: newFlagged,
          totalFlagged: totalFlaggedCount,
          source: 'deposit-screener',
          blockRange: { from: fromBlock, to: toBlock },
        }
        const { cid } = await pinToIPFS(snapshot)
        console.log(`[IPFS] Exclusion snapshot pinned: ${cid}`)
      } catch (e) {
        console.warn(`[IPFS] Failed to pin exclusion snapshot (continuing): ${e instanceof Error ? e.message : e}`)
      }

      const tx = await poolWriter.updateExclusionRoot(rootHex, { gasLimit: 100_000 })
      await tx.wait()
      console.log(`[Screener] Posted exclusion root: ${rootHex.slice(0, 18)}... (${newFlagged} new flags)`)
    } catch (e) {
      console.error(`[Screener] Failed to post exclusion root: ${e instanceof Error ? e.message : e}`)
    }
  }

  const totalFlagged = (cursor?.flaggedCount ?? 0) + newFlagged
  const newCursor: ScreenerCursor = {
    lastBlock: toBlock,
    flaggedCount: totalFlagged,
    updatedAt: Date.now(),
  }
  await saveCursor(chainId, newCursor)

  return {
    lastBlock: toBlock,
    flaggedCount: totalFlagged,
    newFlagged,
    eventsProcessed: processed,
  }
}
