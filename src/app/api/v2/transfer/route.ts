import { ethers } from 'ethers'
import { NextResponse } from 'next/server'
import { getServerSponsor, getTxGasOverrides, GasPriceTooHighError, waitForTx } from '@/lib/server-provider'
import { DEFAULT_CHAIN_ID } from '@/config/chains'
import { getDustPoolV2Address, DUST_POOL_V2_ABI } from '@/lib/dustpool/v2/contracts'
import { syncAndPostRoot } from '@/lib/dustpool/v2/relayer-tree'
import { toBytes32Hex } from '@/lib/dustpool/poseidon'
import { acquireNullifier, releaseNullifier } from '@/lib/dustpool/v2/pending-nullifiers'
import { checkCooldown } from '@/lib/dustpool/v2/persistent-cooldown'
import { screenRecipient } from '@/lib/dustpool/v2/relayer-compliance'
import { incrementTransfer, observeGasUsed, recordProofVerification } from '@/lib/metrics'
import { checkOrigin } from '@/lib/api-auth'

export const maxDuration = 60

const NO_STORE = { 'Cache-Control': 'no-store' } as const

// Transfers call the same contract.withdraw() as withdrawals.
// The difference: publicAmount = 0, so no funds are sent to recipient.
// Output commitments are still queued on-chain for the Merkle tree.
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

    const { proof, publicSignals } = body
    if (!proof || !Array.isArray(publicSignals) || publicSignals.length !== 9) {
      return NextResponse.json(
        { error: 'Missing or invalid fields: proof (hex), publicSignals (9 elements)' },
        { status: 400, headers: NO_STORE },
      )
    }
    if (!/^0x[0-9a-fA-F]+$/.test(proof)) {
      return NextResponse.json({ error: 'Invalid proof format' }, { status: 400, headers: NO_STORE })
    }

    // Transfers must have publicAmount=0 — reject any attempt to use transfer endpoint for withdrawals
    const publicAmount = BigInt(publicSignals[5])
    if (publicAmount !== 0n) {
      return NextResponse.json(
        { error: 'Transfer requires publicAmount=0' },
        { status: 400, headers: NO_STORE },
      )
    }

    // Verify chainId signal matches target chain (prevents cross-chain proof replay)
    const proofChainId = BigInt(publicSignals[8])
    if (proofChainId !== BigInt(chainId)) {
      return NextResponse.json(
        { error: 'Proof chainId does not match target chain' },
        { status: 400, headers: NO_STORE },
      )
    }

    const nullifier0Hex = toBytes32Hex(BigInt(publicSignals[1]))
    const nullifier1Hex = toBytes32Hex(BigInt(publicSignals[2]))
    const nullifier1IsZero = BigInt(publicSignals[2]) === 0n

    if (!(await checkCooldown(nullifier0Hex))) {
      return NextResponse.json({ error: 'Please wait before retrying' }, { status: 429, headers: NO_STORE })
    }

    // Cross-chain nullifier guard — prevent same nullifier being submitted to multiple chains
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
      const contract = new ethers.Contract(
        address,
        DUST_POOL_V2_ABI as unknown as ethers.ContractInterface,
        sponsor,
      )

      const merkleRoot = toBytes32Hex(BigInt(publicSignals[0]))
      const nullifier0 = nullifier0Hex
      const nullifier1 = nullifier1Hex
      const outCommitment0 = toBytes32Hex(BigInt(publicSignals[3]))
      const outCommitment1 = toBytes32Hex(BigInt(publicSignals[4]))
      const publicAsset = BigInt(publicSignals[6])
      const recipientBigInt = BigInt(publicSignals[7])
      const recipient = ethers.utils.getAddress(
        '0x' + recipientBigInt.toString(16).padStart(40, '0'),
      )

      // Defense-in-depth: screen recipient if publicAmount > 0 (shouldn't pass the check above, but guards against future changes)
      if (publicAmount > 0n && recipient !== ethers.constants.AddressZero) {
        const screenResult = await screenRecipient(recipient, chainId)
        if (screenResult.blocked) {
          return NextResponse.json(
            { error: 'Recipient address is sanctioned' },
            { status: 403, headers: NO_STORE },
          )
        }
      }

      // Transfers have publicAmount=0, no actual token transfer — use address(0)
      const tokenAddress = ethers.constants.AddressZero

      const gasOverrides = await getTxGasOverrides(chainId, 800_000)

      const tx = await contract.withdraw(
        proof,
        merkleRoot,
        nullifier0,
        nullifier1,
        outCommitment0,
        outCommitment1,
        publicAmount,
        publicAsset,
        recipient,
        tokenAddress,
        gasOverrides,
      )

      const receipt = await waitForTx(tx)

      if (receipt.status === 0) {
        throw new Error(`Transfer transaction reverted: ${receipt.transactionHash}`)
      }

      const chainStr = String(chainId)
      incrementTransfer(chainStr, 'v2')
      recordProofVerification(chainStr, 'v2_transaction', true)
      observeGasUsed(chainStr, 'transfer', receipt.gasUsed.toNumber())

      console.log(`[V2/transfer] Success: nullifier=${nullifier0.slice(0, 18)}... tx=${receipt.transactionHash}`)

      // Best-effort resync — don't lose the txHash if tree sync fails
      try {
        await syncAndPostRoot(chainId)
      } catch (syncErr) {
        console.error('[V2/transfer] Post-TX tree sync failed (non-fatal):', syncErr)
      }

      return NextResponse.json(
        { success: true, txHash: receipt.transactionHash },
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
    console.error('[V2/transfer] Error:', e)
    const raw = e instanceof Error ? e.message : ''
    let message = 'Transfer failed'
    if (raw.includes('InvalidProof')) message = 'Invalid proof'
    else if (raw.includes('NullifierAlreadySpent')) message = 'Note already spent'
    else if (raw.includes('UnknownRoot')) message = 'Invalid or expired Merkle root'
    else if (raw.includes('InvalidFieldElement')) message = 'Invalid field element in public signals'

    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE })
  }
}
