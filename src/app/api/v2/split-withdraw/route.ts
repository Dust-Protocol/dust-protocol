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
import { incrementWithdrawal, observeGasUsed, recordProofVerification } from '@/lib/metrics'
import { checkOrigin } from '@/lib/api-auth'

export const maxDuration = 60

const NO_STORE = { 'Cache-Control': 'no-store' } as const

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

    const { proof, publicSignals, tokenAddress } = body
    if (!proof || !Array.isArray(publicSignals) || publicSignals.length !== 15) {
      return NextResponse.json(
        { error: 'Missing or invalid fields: proof (hex), publicSignals (15 elements), tokenAddress' },
        { status: 400, headers: NO_STORE },
      )
    }
    if (!/^0x[0-9a-fA-F]+$/.test(proof)) {
      return NextResponse.json({ error: 'Invalid proof format' }, { status: 400, headers: NO_STORE })
    }
    if (!tokenAddress || !/^0x[0-9a-fA-F]{40}$/.test(tokenAddress)) {
      return NextResponse.json({ error: 'Invalid tokenAddress' }, { status: 400, headers: NO_STORE })
    }

    // Split signal layout: [merkleRoot, null0, null1, outCommit[0..7], publicAmount, publicAsset, recipient, chainId]
    const expectedAsset = await computeAssetId(chainId, tokenAddress)
    const proofAsset = BigInt(publicSignals[12])
    if (expectedAsset !== proofAsset) {
      return NextResponse.json(
        { error: 'tokenAddress does not match proof asset' },
        { status: 400, headers: NO_STORE },
      )
    }

    const proofChainId = BigInt(publicSignals[14])
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
      const outCommitments: string[] = []
      for (let i = 0; i < 8; i++) {
        outCommitments.push(toBytes32Hex(BigInt(publicSignals[3 + i])))
      }
      const publicAmount = BigInt(publicSignals[11])
      const publicAsset = BigInt(publicSignals[12])
      const recipientBigInt = BigInt(publicSignals[13])
      const recipient = ethers.utils.getAddress(
        '0x' + recipientBigInt.toString(16).padStart(40, '0'),
      )

      // Compliance: screen recipient against on-chain oracle
      const screenResult = await screenRecipient(recipient, chainId)
      if (screenResult.blocked) {
        return NextResponse.json(
          { error: 'Recipient address is sanctioned' },
          { status: 403, headers: NO_STORE },
        )
      }

      const gasOverrides = await getTxGasOverrides(chainId, 1_200_000)

      const tx = await contract.withdrawSplit(
        proof,
        merkleRoot,
        nullifier0,
        nullifier1,
        outCommitments,
        publicAmount,
        publicAsset,
        recipient,
        tokenAddress,
        gasOverrides,
      )

      const receipt = await waitForTx(tx)

      if (receipt.status === 0) {
        throw new Error(`Split-withdraw transaction reverted: ${receipt.transactionHash}`)
      }

      const chainStr = String(chainId)
      incrementWithdrawal(chainStr, tokenAddress, 'v2_split')
      recordProofVerification(chainStr, 'v2_split', true)
      observeGasUsed(chainStr, 'split_withdraw', receipt.gasUsed.toNumber())

      console.log(
        `[V2/split-withdraw] Success: nullifier=${nullifier0.slice(0, 18)}... recipient=${recipient} tx=${receipt.transactionHash}`,
      )

      try {
        await syncAndPostRoot(chainId)
      } catch (syncErr) {
        console.error('[V2/split-withdraw] Post-TX tree sync failed (non-fatal):', syncErr)
      }

      return NextResponse.json(
        {
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          fee: receipt.effectiveGasPrice.mul(receipt.gasUsed).toString(),
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
    console.error('[V2/split-withdraw] Error:', e)
    const raw = e instanceof Error ? e.message : ''
    let message = 'Split withdrawal failed'
    if (raw.includes('InvalidProof')) message = 'Invalid proof'
    else if (raw.includes('NullifierAlreadySpent')) message = 'Note already spent'
    else if (raw.includes('UnknownRoot')) message = 'Invalid or expired Merkle root'
    else if (raw.includes('InsufficientPoolBalance')) message = 'Insufficient pool balance'
    else if (raw.includes('InvalidProofLength')) message = 'Invalid proof length (expected 768 bytes)'
    else if (raw.includes('InvalidFieldElement')) message = 'Invalid field element in public signals'

    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE })
  }
}
