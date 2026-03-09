import { ethers } from 'ethers'
import { NextResponse } from 'next/server'
import { getServerSponsor, getMaxGasPrice, waitForTx } from '@/lib/server-provider'
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
    // Client sends targetChainId (not chainId) for V2 routes
    const chainId = typeof body.targetChainId === 'number' ? body.targetChainId : DEFAULT_CHAIN_ID

    const address = getDustPoolV2Address(chainId)
    if (!address) {
      return NextResponse.json(
        { error: 'DustPoolV2 not deployed on this chain' },
        { status: 404, headers: NO_STORE },
      )
    }

    const { proof, publicSignals, tokenAddress } = body
    if (!proof || !Array.isArray(publicSignals) || publicSignals.length !== 9) {
      return NextResponse.json(
        { error: 'Missing or invalid fields: proof (hex), publicSignals (9 elements), tokenAddress' },
        { status: 400, headers: NO_STORE },
      )
    }
    if (!/^0x[0-9a-fA-F]+$/.test(proof)) {
      return NextResponse.json({ error: 'Invalid proof format' }, { status: 400, headers: NO_STORE })
    }
    if (!tokenAddress || !/^0x[0-9a-fA-F]{40}$/.test(tokenAddress)) {
      return NextResponse.json({ error: 'Invalid tokenAddress' }, { status: 400, headers: NO_STORE })
    }

    // Verify tokenAddress matches the publicAsset in the ZK proof.
    // Without this check, an attacker could deposit dust ETH and withdraw a different token.
    const expectedAsset = await computeAssetId(chainId, tokenAddress)
    const proofAsset = BigInt(publicSignals[6])
    if (expectedAsset !== proofAsset) {
      return NextResponse.json(
        { error: 'tokenAddress does not match proof asset' },
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

    // Public signals: [merkleRoot, nullifier0, nullifier1, outCommitment0, outCommitment1, publicAmount, publicAsset, recipient, chainId]
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
      // Sync tree and post root before submitting (so isKnownRoot passes)
      await syncAndPostRoot(chainId)

      const sponsor = getServerSponsor(chainId)
      const contract = new ethers.Contract(
        address,
        DUST_POOL_V2_ABI as unknown as ethers.ContractInterface,
        sponsor,
      )

      // Convert public signals to contract parameters
      const merkleRoot = toBytes32Hex(BigInt(publicSignals[0]))
      const nullifier0 = nullifier0Hex
      const nullifier1 = nullifier1Hex
      const outCommitment0 = toBytes32Hex(BigInt(publicSignals[3]))
      const outCommitment1 = toBytes32Hex(BigInt(publicSignals[4]))
      const publicAmount = BigInt(publicSignals[5])
      const publicAsset = BigInt(publicSignals[6])
      // Recipient stored as uint256(uint160(address)) in circuit
      const recipientBigInt = BigInt(publicSignals[7])
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

      const feeData = await sponsor.provider.getFeeData()
      const maxFeePerGas = feeData.maxFeePerGas || ethers.utils.parseUnits('5', 'gwei')
      if (maxFeePerGas.gt(getMaxGasPrice(chainId))) {
        return NextResponse.json({ error: 'Gas price too high' }, { status: 503, headers: NO_STORE })
      }

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
        {
          gasLimit: 800_000, // FFLONK verify ~500K + state updates + transfer
          type: 2,
          maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.utils.parseUnits('1.5', 'gwei'),
        },
      )

      const receipt = await waitForTx(tx)

      if (receipt.status === 0) {
        throw new Error(`Withdraw transaction reverted: ${receipt.transactionHash}`)
      }

      const chainStr = String(chainId)
      incrementWithdrawal(chainStr, tokenAddress, 'v2')
      recordProofVerification(chainStr, 'v2_transaction', true)
      observeGasUsed(chainStr, 'withdraw', receipt.gasUsed.toNumber())

      console.log(
        `[V2/withdraw] Success: nullifier=${nullifier0.slice(0, 18)}... recipient=${recipient} tx=${receipt.transactionHash}`,
      )

      // Best-effort resync — don't lose the txHash if tree sync fails
      try {
        await syncAndPostRoot(chainId)
      } catch (syncErr) {
        console.error('[V2/withdraw] Post-TX tree sync failed (non-fatal):', syncErr)
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
    console.error('[V2/withdraw] Error:', e)
    const raw = e instanceof Error ? e.message : ''
    let message = 'Withdrawal failed'
    if (raw.includes('InvalidProof')) message = 'Invalid proof'
    else if (raw.includes('NullifierAlreadySpent')) message = 'Note already spent'
    else if (raw.includes('UnknownRoot')) message = 'Invalid or expired Merkle root'
    else if (raw.includes('InsufficientPoolBalance')) message = 'Insufficient pool balance'
    else if (raw.includes('InvalidProofLength')) message = 'Invalid proof length (expected 768 bytes)'
    else if (raw.includes('InvalidFieldElement')) message = 'Invalid field element in public signals'

    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE })
  }
}
