import { ethers } from 'ethers'
import { NextResponse } from 'next/server'
import { getServerSponsor, getTxGasOverrides, GasPriceTooHighError, waitForTx } from '@/lib/server-provider'
import { DEFAULT_CHAIN_ID, isChainSupported } from '@/config/chains'
import { getDustPoolV2Address, DUST_POOL_V2_ABI } from '@/lib/dustpool/v2/contracts'
import { toBytes32Hex } from '@/lib/dustpool/poseidon'
import {
  generateComplianceWitness,
  getExclusionRoot,
  isCommitmentFlagged,
} from '@/lib/dustpool/v2/exclusion-tree'
import { checkOrigin } from '@/lib/api-auth'

export const maxDuration = 60

const NO_STORE = { 'Cache-Control': 'no-store' } as const

/**
 * GET /api/v2/compliance?commitment=<bigint>&chainId=<number>
 *
 * Returns a non-membership witness for the DustV2Compliance circuit.
 * The client uses this to generate a ZK compliance proof off-chain.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const commitmentStr = url.searchParams.get('commitment')
    const chainId = Number(url.searchParams.get('chainId') ?? DEFAULT_CHAIN_ID)

    if (!isChainSupported(chainId)) {
      return NextResponse.json(
        { error: `Unsupported chain: ${chainId}` },
        { status: 400, headers: NO_STORE },
      )
    }

    if (!commitmentStr) {
      return NextResponse.json(
        { error: 'Missing commitment parameter' },
        { status: 400, headers: NO_STORE },
      )
    }

    let commitment: bigint
    try {
      commitment = BigInt(commitmentStr)
    } catch {
      return NextResponse.json(
        { error: 'Invalid commitment format (expected bigint-parseable string)' },
        { status: 400, headers: NO_STORE },
      )
    }

    const flagged = await isCommitmentFlagged(chainId, commitment)
    if (flagged) {
      return NextResponse.json(
        { error: 'Commitment is in the exclusion set', flagged: true },
        { status: 403, headers: NO_STORE },
      )
    }

    const witness = await generateComplianceWitness(chainId, commitment)

    return NextResponse.json(
      {
        exclusionRoot: witness.exclusionRoot.toString(),
        smtSiblings: witness.smtSiblings.map((s) => s.toString()),
        smtOldKey: witness.smtOldKey.toString(),
        smtOldValue: witness.smtOldValue.toString(),
        smtIsOld0: witness.smtIsOld0.toString(),
      },
      { headers: NO_STORE },
    )
  } catch (e) {
    console.error('[V2/compliance] GET error:', e)
    return NextResponse.json(
      { error: 'Failed to generate compliance witness' },
      { status: 500, headers: NO_STORE },
    )
  }
}

/**
 * POST /api/v2/compliance
 *
 * Submits a compliance proof to the contract (verifyComplianceProof).
 * Called by the client after generating the ZK proof.
 * Must be called before withdraw/withdrawSplit for each nullifier.
 *
 * Body: { proof: hex, exclusionRoot: string, nullifier: string, targetChainId?: number }
 */
export async function POST(req: Request) {
  try {
    const originError = checkOrigin(req)
    if (originError) return originError

    const body = await req.json()
    const chainId = typeof body.targetChainId === 'number' ? body.targetChainId : DEFAULT_CHAIN_ID

    const address = getDustPoolV2Address(chainId)
    if (!address) {
      return NextResponse.json(
        { error: 'DustPoolV2 not deployed on this chain' },
        { status: 404, headers: NO_STORE },
      )
    }

    const { proof, exclusionRoot, nullifier } = body

    if (!proof || !/^0x[0-9a-fA-F]+$/.test(proof)) {
      return NextResponse.json(
        { error: 'Invalid proof format (expected hex bytes)' },
        { status: 400, headers: NO_STORE },
      )
    }
    if (!exclusionRoot || !nullifier) {
      return NextResponse.json(
        { error: 'Missing exclusionRoot or nullifier' },
        { status: 400, headers: NO_STORE },
      )
    }

    const exclusionRootHex = toBytes32Hex(BigInt(exclusionRoot))
    const nullifierHex = toBytes32Hex(BigInt(nullifier))

    // Post current exclusion root on-chain if needed
    const currentRoot = await getExclusionRoot(chainId)
    const currentRootHex = toBytes32Hex(currentRoot)

    const sponsor = getServerSponsor(chainId)
    const contract = new ethers.Contract(
      address,
      DUST_POOL_V2_ABI as unknown as ethers.ContractInterface,
      sponsor,
    )

    // Ensure the exclusion root the client proved against is known on-chain
    const isKnown: boolean = await contract.isKnownExclusionRoot(exclusionRootHex)
    if (!isKnown) {
      // Try posting current root first, then recheck
      if (currentRootHex !== exclusionRootHex) {
        return NextResponse.json(
          { error: 'Exclusion root is stale — re-fetch witness and re-prove' },
          { status: 409, headers: NO_STORE },
        )
      }
      const tx = await contract.updateExclusionRoot(currentRootHex)
      await waitForTx(tx)
    }

    const gasOverrides = await getTxGasOverrides(chainId, 500_000)

    const tx = await contract.verifyComplianceProof(
      exclusionRootHex,
      nullifierHex,
      proof,
      gasOverrides,
    )
    const receipt = await waitForTx(tx)

    if (receipt.status === 0) {
      throw new Error(`Compliance verification reverted: ${receipt.transactionHash}`)
    }

    console.log(
      `[V2/compliance] Verified: nullifier=${nullifierHex.slice(0, 18)}... tx=${receipt.transactionHash}`,
    )

    return NextResponse.json(
      {
        txHash: receipt.transactionHash,
        verified: true,
      },
      { headers: NO_STORE },
    )
  } catch (e) {
    if (e instanceof GasPriceTooHighError) {
      return NextResponse.json({ error: 'Gas price too high, try again later' }, { status: 503, headers: NO_STORE })
    }
    console.error('[V2/compliance] POST error:', e)
    const raw = e instanceof Error ? e.message : ''
    let message = 'Compliance verification failed'
    if (raw.includes('InvalidComplianceProof')) message = 'Invalid compliance proof'
    else if (raw.includes('UnknownExclusionRoot')) message = 'Unknown exclusion root'
    else if (raw.includes('InvalidProofLength')) message = 'Invalid proof length'

    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE })
  }
}
