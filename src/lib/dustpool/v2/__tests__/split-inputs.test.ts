import { describe, it, expect } from 'vitest'
import { parseEther } from 'viem'
import { computeNoteCommitment } from '../commitment'
import { buildSplitInputs } from '../proof-inputs'
import { mockNote, dummyMerkleProof, MOCK_KEYS, TEST_CHAIN_ID } from './test-helpers'

describe('buildSplitInputs', () => {
  it('splits 1.37 ETH into [1.0, 0.3, 0.05, 0.02] with correct output amounts', async () => {
    // #given
    const noteCommitment = await mockNote(parseEther('1.37'))
    const chunks = [
      parseEther('1.0'),
      parseEther('0.3'),
      parseEther('0.05'),
      parseEther('0.02'),
    ]

    // #when
    const result = await buildSplitInputs(
      noteCommitment,
      chunks,
      MOCK_KEYS,
      dummyMerkleProof(),
      TEST_CHAIN_ID
    )

    // #then — outputNotes has 4 real notes matching chunks, no change (sum = 1.37)
    expect(result.outputNotes).toHaveLength(4)
    expect(result.outputNotes[0].amount).toBe(parseEther('1.0'))
    expect(result.outputNotes[1].amount).toBe(parseEther('0.3'))
    expect(result.outputNotes[2].amount).toBe(parseEther('0.05'))
    expect(result.outputNotes[3].amount).toBe(parseEther('0.02'))

    // Circuit inputs have 8 output slots (padded with dummies)
    const amounts = result.circuitInputs.outAmount as string[]
    expect(amounts).toHaveLength(8)
    for (let i = 4; i < 8; i++) {
      expect(BigInt(amounts[i])).toBe(0n)
    }

    // Internal split: publicAmount = 0
    expect(BigInt(result.circuitInputs.publicAmount as string)).toBe(0n)
  })

  it('computes output commitments matching Poseidon(owner, amount, asset, chainId, blinding)', async () => {
    // #given
    const noteCommitment = await mockNote(parseEther('1.0'))
    const chunks = [parseEther('0.5'), parseEther('0.3')]

    // #when
    const result = await buildSplitInputs(
      noteCommitment,
      chunks,
      MOCK_KEYS,
      dummyMerkleProof(),
      TEST_CHAIN_ID
    )

    // #then — each real output's commitment matches recomputation
    const owners = result.circuitInputs.outOwner as string[]
    const amounts = result.circuitInputs.outAmount as string[]
    const assets = result.circuitInputs.outAsset as string[]
    const chainIds = result.circuitInputs.outChainId as string[]
    const blindings = result.circuitInputs.outBlinding as string[]
    const commitments = result.circuitInputs.outputCommitment as string[]

    for (let i = 0; i < 8; i++) {
      const expected = await computeNoteCommitment({
        owner: BigInt(owners[i]),
        amount: BigInt(amounts[i]),
        asset: BigInt(assets[i]),
        chainId: Number(chainIds[i]),
        blinding: BigInt(blindings[i]),
      })
      expect(BigInt(commitments[i])).toBe(expected)
    }
  })

  it('balance conservation: sum(inputs) + publicAmount === sum(outputs)', async () => {
    // #given — internal split with change
    const noteCommitment = await mockNote(parseEther('2.0'))
    const chunks = [parseEther('1.0'), parseEther('0.5'), parseEther('0.3')]

    // #when
    const result = await buildSplitInputs(
      noteCommitment,
      chunks,
      MOCK_KEYS,
      dummyMerkleProof(),
      TEST_CHAIN_ID
    )

    // #then
    const inAmounts = result.circuitInputs.inAmount as string[]
    const outAmounts = result.circuitInputs.outAmount as string[]
    const publicAmount = BigInt(result.circuitInputs.publicAmount as string)

    const sumIn = BigInt(inAmounts[0]) + BigInt(inAmounts[1]) + publicAmount
    const sumOut = outAmounts.reduce((s: bigint, a: string) => s + BigInt(a), 0n)
    expect(sumIn).toBe(sumOut)
  })

  it('pads dummy outputs with zeros to length 8', async () => {
    // #given
    const noteCommitment = await mockNote(parseEther('1.0'))
    const chunks = [parseEther('0.5'), parseEther('0.5')]

    // #when
    const result = await buildSplitInputs(
      noteCommitment,
      chunks,
      MOCK_KEYS,
      dummyMerkleProof(),
      TEST_CHAIN_ID
    )

    // #then — all 8 circuit input arrays have length 8
    const amounts = result.circuitInputs.outAmount as string[]
    const owners = result.circuitInputs.outOwner as string[]
    const blindings = result.circuitInputs.outBlinding as string[]
    expect(amounts).toHaveLength(8)
    expect(owners).toHaveLength(8)

    // Slots 2-7 are zero-padded dummies
    for (let i = 2; i < 8; i++) {
      expect(BigInt(amounts[i])).toBe(0n)
      expect(BigInt(owners[i])).toBe(0n)
      expect(BigInt(blindings[i])).toBe(0n)
    }

    // outputNotes only contains real notes
    expect(result.outputNotes).toHaveLength(2)
  })

  it('includes change note when chunks do not sum to input amount', async () => {
    // #given
    const noteCommitment = await mockNote(parseEther('2.0'))
    const chunks = [parseEther('1.0'), parseEther('0.5')]

    // #when
    const result = await buildSplitInputs(
      noteCommitment,
      chunks,
      MOCK_KEYS,
      dummyMerkleProof(),
      TEST_CHAIN_ID
    )

    // #then — 3 real output notes: 2 chunks + 1 change (0.5 ETH)
    expect(result.outputNotes).toHaveLength(3)
    expect(result.outputNotes[2].amount).toBe(parseEther('0.5'))
    // Change note owned by the sender
    expect(result.outputNotes[2].owner).toBe(noteCommitment.note.owner)
  })

  it('always sets publicAmount=0 and non-zero recipient (internal split only)', async () => {
    // #given
    const noteCommitment = await mockNote(parseEther('1.37'))
    const chunks = [
      parseEther('1.0'),
      parseEther('0.3'),
      parseEther('0.05'),
      parseEther('0.02'),
    ]

    // #when
    const result = await buildSplitInputs(
      noteCommitment,
      chunks,
      MOCK_KEYS,
      dummyMerkleProof(),
      TEST_CHAIN_ID
    )

    // #then — splits are internal but contract requires non-zero recipient
    expect(BigInt(result.circuitInputs.publicAmount as string)).toBe(0n)
    expect(BigInt(result.circuitInputs.recipient as string)).not.toBe(0n)
  })

  it('throws when chunks exceed input note amount', async () => {
    const noteCommitment = await mockNote(parseEther('1.0'))
    const chunks = [parseEther('0.8'), parseEther('0.5')]

    await expect(
      buildSplitInputs(
        noteCommitment,
        chunks,
        MOCK_KEYS,
        dummyMerkleProof(),
        TEST_CHAIN_ID
      )
    ).rejects.toThrow(/exceeds note balance/)
  })

  it('throws when more than 8 chunks', async () => {
    const noteCommitment = await mockNote(parseEther('10.0'))
    const chunks = new Array(9).fill(parseEther('1.0'))

    await expect(
      buildSplitInputs(
        noteCommitment,
        chunks,
        MOCK_KEYS,
        dummyMerkleProof(),
        TEST_CHAIN_ID
      )
    ).rejects.toThrow(/Too many chunks/)
  })

  it('throws when no room for change note (8 chunks + remainder)', async () => {
    // #given — 8 chunks that don't sum to input amount
    const noteCommitment = await mockNote(parseEther('10.0'))
    const chunks = new Array(8).fill(parseEther('1.0')) // sum=8, input=10, change=2

    // #when / #then
    await expect(
      buildSplitInputs(
        noteCommitment,
        chunks,
        MOCK_KEYS,
        dummyMerkleProof(),
        TEST_CHAIN_ID
      )
    ).rejects.toThrow(/No room for change note/)
  })
})

describe('buildSplitInputs — two-step flow invariants', () => {
  it('publicAmount is always 0 regardless of input amount', async () => {
    // Two-step design: split is always internal, withdrawal is a separate step
    const amounts = [
      parseEther('0.01'),
      parseEther('1.0'),
      parseEther('10.0'),
      parseEther('29.99'),
    ]

    for (const amount of amounts) {
      const noteCommitment = await mockNote(amount)
      const chunks = [amount] // single chunk, no change
      const result = await buildSplitInputs(
        noteCommitment,
        chunks,
        MOCK_KEYS,
        dummyMerkleProof(),
        TEST_CHAIN_ID
      )
      expect(BigInt(result.circuitInputs.publicAmount as string)).toBe(0n)
    }
  })

  it('recipient is non-zero burn address regardless of input', async () => {
    // Internal split: no value leaves pool, but contract requires non-zero recipient
    const noteCommitment = await mockNote(parseEther('5.0'))
    const chunks = [parseEther('3.0'), parseEther('1.0')]

    const result = await buildSplitInputs(
      noteCommitment,
      chunks,
      MOCK_KEYS,
      dummyMerkleProof(),
      TEST_CHAIN_ID
    )
    const recipient = BigInt(result.circuitInputs.recipient as string)
    expect(recipient).not.toBe(0n)
    expect(recipient).toBe(BigInt('0x000000000000000000000000000000000000dEaD'))
  })

  it('balance conservation: sum(input amounts) = sum(output amounts) when publicAmount=0', async () => {
    // #given — split with change
    const noteCommitment = await mockNote(parseEther('5.5'))
    const chunks = [parseEther('3.0'), parseEther('1.0'), parseEther('0.5')]
    // expected change: 5.5 - 4.5 = 1.0

    // #when
    const result = await buildSplitInputs(
      noteCommitment,
      chunks,
      MOCK_KEYS,
      dummyMerkleProof(),
      TEST_CHAIN_ID
    )

    // #then
    const inAmounts = result.circuitInputs.inAmount as string[]
    const outAmounts = result.circuitInputs.outAmount as string[]
    const sumIn = inAmounts.reduce((s, a) => s + BigInt(a), 0n)
    const sumOut = outAmounts.reduce((s, a) => s + BigInt(a), 0n)
    expect(sumIn).toBe(sumOut)
  })

  it('change note = input total - sum(denomination chunks)', async () => {
    // #given
    const noteCommitment = await mockNote(parseEther('3.0'))
    const chunks = [parseEther('1.0'), parseEther('0.5'), parseEther('0.3')]
    const expectedChange = parseEther('3.0') - parseEther('1.8')

    // #when
    const result = await buildSplitInputs(
      noteCommitment,
      chunks,
      MOCK_KEYS,
      dummyMerkleProof(),
      TEST_CHAIN_ID
    )

    // #then — last real output note is the change note
    const changeNote = result.outputNotes[result.outputNotes.length - 1]
    expect(changeNote.amount).toBe(expectedChange)
  })

  it('no change note when chunks exactly equal input amount', async () => {
    // #given
    const noteCommitment = await mockNote(parseEther('1.3'))
    const chunks = [parseEther('1.0'), parseEther('0.3')]

    // #when
    const result = await buildSplitInputs(
      noteCommitment,
      chunks,
      MOCK_KEYS,
      dummyMerkleProof(),
      TEST_CHAIN_ID
    )

    // #then — only chunk notes, no change
    expect(result.outputNotes).toHaveLength(2)
    expect(result.outputNotes[0].amount).toBe(parseEther('1.0'))
    expect(result.outputNotes[1].amount).toBe(parseEther('0.3'))
  })

  it('balance conservation holds with maximum output slots (7 chunks + change)', async () => {
    // #given — 7 chunks with a remainder that creates a change note
    const noteCommitment = await mockNote(parseEther('8.0'))
    const chunks = [
      parseEther('1.0'),
      parseEther('1.0'),
      parseEther('1.0'),
      parseEther('1.0'),
      parseEther('1.0'),
      parseEther('1.0'),
      parseEther('1.0'),
    ] // sum=7, change=1

    // #when
    const result = await buildSplitInputs(
      noteCommitment,
      chunks,
      MOCK_KEYS,
      dummyMerkleProof(),
      TEST_CHAIN_ID
    )

    // #then
    expect(result.outputNotes).toHaveLength(8) // 7 chunks + 1 change
    const totalOutput = result.outputNotes.reduce((s, n) => s + n.amount, 0n)
    expect(totalOutput).toBe(parseEther('8.0'))

    // Circuit-level conservation
    const inAmounts = result.circuitInputs.inAmount as string[]
    const outAmounts = result.circuitInputs.outAmount as string[]
    const sumIn = inAmounts.reduce((s, a) => s + BigInt(a), 0n)
    const sumOut = outAmounts.reduce((s, a) => s + BigInt(a), 0n)
    expect(sumIn).toBe(sumOut)
  })
})
