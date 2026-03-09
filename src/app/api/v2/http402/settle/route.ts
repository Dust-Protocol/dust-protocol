import { ethers } from 'ethers'
import { NextResponse } from 'next/server'
import { getServerProvider, getServerSponsor, getMaxGasPrice, waitForTx } from '@/lib/server-provider'
import { isChainSupported } from '@/config/chains'
import { getDustPoolV2Address, DUST_POOL_V2_ABI } from '@/lib/dustpool/v2/contracts'
import { toBytes32Hex } from '@/lib/dustpool/poseidon'
import { computeAssetId } from '@/lib/dustpool/v2/commitment'
import { syncAndPostRoot } from '@/lib/dustpool/v2/relayer-tree'
import { acquireNullifier, releaseNullifier } from '@/lib/dustpool/v2/pending-nullifiers'
import { screenRecipient } from '@/lib/dustpool/v2/relayer-compliance'
import { incrementHttp402Payment, observeGasUsed } from '@/lib/metrics'
import type { PaymentProof, PrivacyLevel } from '@/types/http402'
import { receiptStore } from '../receipt-store'

export const maxDuration = 60

const NO_STORE = { 'Cache-Control': 'no-store' } as const

const VALID_PRIVACY_LEVELS: ReadonlySet<PrivacyLevel> = new Set(['transparent', 'stealth', 'private'])

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json()
    const { proof } = body as { proof: PaymentProof }

    if (!proof) {
      return NextResponse.json(
        { error: 'Missing required field: proof' },
        { status: 400, headers: NO_STORE },
      )
    }

    if (!proof.nonce || !proof.privacy || !proof.chainId) {
      return NextResponse.json(
        { error: 'Proof must include nonce, privacy, and chainId' },
        { status: 400, headers: NO_STORE },
      )
    }

    if (!VALID_PRIVACY_LEVELS.has(proof.privacy)) {
      return NextResponse.json(
        { error: `Invalid privacy level: ${proof.privacy}` },
        { status: 400, headers: NO_STORE },
      )
    }

    if (!isChainSupported(proof.chainId)) {
      return NextResponse.json(
        { error: `Unsupported chain: ${proof.chainId}` },
        { status: 400, headers: NO_STORE },
      )
    }

    const chainStr = String(proof.chainId)

    // Transparent and stealth payments are settled at payment time — nothing to do
    if (proof.privacy === 'transparent' || proof.privacy === 'stealth') {
      if (!proof.txHash) {
        return NextResponse.json(
          { error: 'txHash required for transparent/stealth settlement' },
          { status: 400, headers: NO_STORE },
        )
      }

      const provider = getServerProvider(proof.chainId)
      const receipt = await provider.getTransactionReceipt(proof.txHash)
      if (!receipt || receipt.status !== 1) {
        return NextResponse.json(
          { error: 'Transaction not confirmed or reverted' },
          { status: 400, headers: NO_STORE },
        )
      }

      const existing = receiptStore.get(proof.nonce)
      if (existing) {
        if (existing.txHash && existing.txHash !== proof.txHash) {
          return NextResponse.json(
            { error: 'txHash does not match verified receipt' },
            { status: 400, headers: NO_STORE },
          )
        }
        existing.status = 'settled'
        existing.txHash = proof.txHash
        receiptStore.set(proof.nonce, existing)
      }

      incrementHttp402Payment(chainStr, proof.privacy, 'settled')

      return NextResponse.json(
        { settled: true, txHash: proof.txHash },
        { headers: NO_STORE },
      )
    }

    // Private settlement: execute withdraw via DustPoolV2
    if (!proof.proof || !proof.publicSignals || proof.publicSignals.length !== 9) {
      return NextResponse.json(
        { error: 'Private settlement requires proof and publicSignals (9 elements)' },
        { status: 400, headers: NO_STORE },
      )
    }

    if (!proof.recipient) {
      return NextResponse.json(
        { error: 'Private settlement requires recipient address' },
        { status: 400, headers: NO_STORE },
      )
    }

    if (!proof.asset) {
      return NextResponse.json(
        { error: 'Private settlement requires asset address' },
        { status: 400, headers: NO_STORE },
      )
    }

    const poolAddress = getDustPoolV2Address(proof.chainId)
    if (!poolAddress) {
      return NextResponse.json(
        { error: 'DustPoolV2 not deployed on this chain' },
        { status: 404, headers: NO_STORE },
      )
    }

    // Require prior verification via the verify endpoint
    const verified = receiptStore.get(proof.nonce)
    if (!verified || verified.status !== 'verified') {
      return NextResponse.json(
        { error: 'Must call verify before settlement' },
        { status: 400, headers: NO_STORE },
      )
    }

    // Compliance: screen recipient against on-chain oracle
    const screenResult = await screenRecipient(proof.recipient, proof.chainId)
    if (screenResult.blocked) {
      return NextResponse.json(
        { error: 'Recipient address is sanctioned' },
        { status: 403, headers: NO_STORE },
      )
    }

    // Verify asset/proof consistency: Poseidon(chainId, tokenAddress) must match publicAsset signal
    const expectedAssetId = await computeAssetId(proof.chainId, proof.asset)
    const proofAssetId = BigInt(proof.publicSignals[6])
    if (expectedAssetId !== proofAssetId) {
      return NextResponse.json(
        { error: 'Asset address does not match proof' },
        { status: 400, headers: NO_STORE },
      )
    }

    const nullifier0Hex = toBytes32Hex(BigInt(proof.publicSignals[1]))
    const nullifier1Hex = toBytes32Hex(BigInt(proof.publicSignals[2]))
    const nullifier1IsZero = BigInt(proof.publicSignals[2]) === 0n

    if (!acquireNullifier(nullifier0Hex)) {
      return NextResponse.json(
        { error: 'Nullifier already being processed' },
        { status: 409, headers: NO_STORE },
      )
    }
    if (!nullifier1IsZero && !acquireNullifier(nullifier1Hex)) {
      releaseNullifier(nullifier0Hex)
      return NextResponse.json(
        { error: 'Nullifier already being processed' },
        { status: 409, headers: NO_STORE },
      )
    }

    try {
      await syncAndPostRoot(proof.chainId)

      const sponsor = getServerSponsor(proof.chainId)
      const contract = new ethers.Contract(
        poolAddress,
        DUST_POOL_V2_ABI as unknown as ethers.ContractInterface,
        sponsor,
      )

      const merkleRoot = toBytes32Hex(BigInt(proof.publicSignals[0]))
      const outCommitment0 = toBytes32Hex(BigInt(proof.publicSignals[3]))
      const outCommitment1 = toBytes32Hex(BigInt(proof.publicSignals[4]))
      const publicAmount = BigInt(proof.publicSignals[5])
      const publicAsset = BigInt(proof.publicSignals[6])

      const feeData = await sponsor.provider.getFeeData()
      const maxFeePerGas = feeData.maxFeePerGas || ethers.utils.parseUnits('5', 'gwei')
      if (maxFeePerGas.gt(getMaxGasPrice(proof.chainId))) {
        return NextResponse.json(
          { error: 'Gas price too high, try again later' },
          { status: 503, headers: NO_STORE },
        )
      }

      const tx = await contract.withdraw(
        proof.proof,
        merkleRoot,
        nullifier0Hex,
        nullifier1Hex,
        outCommitment0,
        outCommitment1,
        publicAmount,
        publicAsset,
        proof.recipient,
        proof.asset,
        {
          gasLimit: 700_000,
          type: 2,
          maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.utils.parseUnits('1.5', 'gwei'),
        },
      )

      const receipt = await waitForTx(tx)
      if (receipt.status !== 1) {
        throw new Error('Transaction reverted on-chain')
      }

      observeGasUsed(chainStr, 'http402_settle', receipt.gasUsed.toNumber())
      incrementHttp402Payment(chainStr, proof.privacy, 'settled')

      const existing = receiptStore.get(proof.nonce)
      if (existing) {
        existing.status = 'settled'
        existing.txHash = receipt.transactionHash
        receiptStore.set(proof.nonce, existing)
      }

      // Best-effort resync
      try {
        await syncAndPostRoot(proof.chainId)
      } catch (syncErr) {
        console.error('[http402/settle] Post-TX tree sync failed (non-fatal):', syncErr)
      }

      return NextResponse.json(
        { settled: true, txHash: receipt.transactionHash },
        { headers: NO_STORE },
      )
    } finally {
      releaseNullifier(nullifier0Hex)
      if (!nullifier1IsZero) releaseNullifier(nullifier1Hex)
    }
  } catch (e) {
    console.error('[http402/settle] Error:', e)
    const raw = e instanceof Error ? e.message : String(e)
    let message = 'Settlement failed'
    if (raw.includes('InvalidProof')) message = 'Invalid proof'
    else if (raw.includes('NullifierAlreadySpent')) message = 'Note already spent'
    else if (raw.includes('UnknownRoot')) message = 'Invalid or expired Merkle root'
    else if (raw.includes('Sponsor not configured')) message = 'Relayer key not configured'

    return NextResponse.json(
      { error: message, detail: raw.slice(0, 500) },
      { status: 500, headers: NO_STORE },
    )
  }
}
