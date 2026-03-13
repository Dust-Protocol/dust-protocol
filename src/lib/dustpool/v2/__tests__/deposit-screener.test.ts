import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ethers', () => {
  const mockContract = {
    filters: { DepositQueued: vi.fn().mockReturnValue({}) },
    queryFilter: vi.fn().mockResolvedValue([]),
    depositOriginator: vi.fn().mockResolvedValue('0x0000000000000000000000000000000000000000'),
  }
  return {
    ethers: {
      Contract: vi.fn().mockReturnValue(mockContract),
      constants: { AddressZero: '0x0000000000000000000000000000000000000000' },
      utils: { parseUnits: vi.fn() },
    },
  }
})

vi.mock('@/lib/server-provider', () => ({
  getServerProvider: vi.fn().mockReturnValue({
    getBlockNumber: vi.fn().mockResolvedValue(10000),
  }),
  getServerSponsor: vi.fn(),
}))

vi.mock('../contracts', () => ({
  getDustPoolV2Address: vi.fn().mockReturnValue('0xDEAD'),
  DUST_POOL_V2_ABI: [],
}))

const mockScreenRecipient = vi.fn().mockResolvedValue({ blocked: false })
vi.mock('../relayer-compliance', () => ({
  screenRecipient: (...args: unknown[]) => mockScreenRecipient(...args),
}))

const mockCheckSanctions = vi.fn().mockResolvedValue({ address: '0x0', sanctioned: false, identifications: [], checkedAt: Date.now() })
vi.mock('../chainalysis-api', () => ({
  checkSanctionsStatus: (...args: unknown[]) => mockCheckSanctions(...args),
}))

const mockAddFlagged = vi.fn().mockResolvedValue(999n)
const mockGetRoot = vi.fn().mockResolvedValue(999n)
vi.mock('../exclusion-tree', () => ({
  addFlaggedCommitment: (...args: unknown[]) => mockAddFlagged(...args),
  getExclusionRoot: (...args: unknown[]) => mockGetRoot(...args),
}))

vi.mock('@/lib/dustpool/poseidon', () => ({
  toBytes32Hex: vi.fn().mockReturnValue('0x' + '0'.repeat(64)),
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('not found')),
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

import { ethers } from 'ethers'
import { runDepositScreenerCycle } from '../deposit-screener'
import { getDustPoolV2Address } from '../contracts'

function getMockContract() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ethers.Contract as any)()
}

describe('deposit-screener', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockScreenRecipient.mockResolvedValue({ blocked: false })
    mockCheckSanctions.mockResolvedValue({ address: '0x0', sanctioned: false, identifications: [], checkedAt: Date.now() })
    mockAddFlagged.mockResolvedValue(999n)
  })

  it('returns early when pool is not deployed', async () => {
    // #given
    vi.mocked(getDustPoolV2Address).mockReturnValueOnce(null)

    // #when
    const result = await runDepositScreenerCycle(99999)

    // #then
    expect(result.eventsProcessed).toBe(0)
    expect(result.flaggedCount).toBe(0)
  })

  it('does not flag clean depositor', async () => {
    // #given
    const contract = getMockContract()
    contract.queryFilter.mockResolvedValue([
      { args: { commitment: '0x' + 'ab'.repeat(32) } },
    ])
    contract.depositOriginator.mockResolvedValue('0x1111111111111111111111111111111111111111')
    mockScreenRecipient.mockResolvedValue({ blocked: false })

    // #when
    const result = await runDepositScreenerCycle(11155111)

    // #then
    expect(result.newFlagged).toBe(0)
    expect(mockAddFlagged).not.toHaveBeenCalled()
  })

  it('flags blocked depositor commitment', async () => {
    // #given
    const contract = getMockContract()
    contract.queryFilter.mockResolvedValue([
      { args: { commitment: '0x' + 'cd'.repeat(32) } },
    ])
    contract.depositOriginator.mockResolvedValue('0x2222222222222222222222222222222222222222')
    mockScreenRecipient.mockResolvedValue({ blocked: true, reason: 'Sanctioned' })

    // #when
    const result = await runDepositScreenerCycle(11155111)

    // #then
    expect(result.newFlagged).toBe(1)
    expect(mockAddFlagged).toHaveBeenCalledWith(11155111, BigInt('0x' + 'cd'.repeat(32)))
  })

  it('processes multiple events in a batch', async () => {
    // #given
    const contract = getMockContract()
    contract.queryFilter.mockResolvedValue([
      { args: { commitment: '0x' + '01'.repeat(32) } },
      { args: { commitment: '0x' + '02'.repeat(32) } },
      { args: { commitment: '0x' + '03'.repeat(32) } },
    ])
    contract.depositOriginator.mockResolvedValue('0x3333333333333333333333333333333333333333')
    mockScreenRecipient.mockResolvedValue({ blocked: false })

    // #when
    const result = await runDepositScreenerCycle(11155111)

    // #then
    expect(result.eventsProcessed).toBe(3)
    expect(mockScreenRecipient).toHaveBeenCalledTimes(3)
  })

  it('flags depositor sanctioned by Chainalysis even if oracle says clean', async () => {
    // #given
    const contract = getMockContract()
    contract.queryFilter.mockResolvedValue([
      { args: { commitment: '0x' + 'ee'.repeat(32) } },
    ])
    contract.depositOriginator.mockResolvedValue('0x4444444444444444444444444444444444444444')
    mockScreenRecipient.mockResolvedValue({ blocked: false })
    mockCheckSanctions.mockResolvedValue({
      address: '0x4444444444444444444444444444444444444444',
      sanctioned: true,
      identifications: [{ category: 'OFAC', name: 'Test', description: '', url: '' }],
      checkedAt: Date.now(),
    })

    // #when
    const result = await runDepositScreenerCycle(11155111)

    // #then
    expect(result.newFlagged).toBe(1)
    expect(mockAddFlagged).toHaveBeenCalledWith(11155111, BigInt('0x' + 'ee'.repeat(32)))
  })

  it('allows deposit when Chainalysis API errors (fail-open)', async () => {
    // #given
    const contract = getMockContract()
    contract.queryFilter.mockResolvedValue([
      { args: { commitment: '0x' + 'dd'.repeat(32) } },
    ])
    contract.depositOriginator.mockResolvedValue('0x5555555555555555555555555555555555555555')
    mockScreenRecipient.mockResolvedValue({ blocked: false })
    mockCheckSanctions.mockRejectedValue(new Error('API timeout'))

    // #when
    const result = await runDepositScreenerCycle(11155111)

    // #then — not flagged because fail-open + oracle says clean
    expect(result.newFlagged).toBe(0)
    expect(mockAddFlagged).not.toHaveBeenCalled()
  })

  it('flags when both oracle and Chainalysis agree address is sanctioned', async () => {
    // #given
    const contract = getMockContract()
    contract.queryFilter.mockResolvedValue([
      { args: { commitment: '0x' + 'aa'.repeat(32) } },
    ])
    contract.depositOriginator.mockResolvedValue('0x6666666666666666666666666666666666666666')
    mockScreenRecipient.mockResolvedValue({ blocked: true, reason: 'Sanctioned' })
    mockCheckSanctions.mockResolvedValue({
      address: '0x6666666666666666666666666666666666666666',
      sanctioned: true,
      identifications: [{ category: 'OFAC', name: 'Test', description: '', url: '' }],
      checkedAt: Date.now(),
    })

    // #when
    const result = await runDepositScreenerCycle(11155111)

    // #then — flagged once (not double-flagged)
    expect(result.newFlagged).toBe(1)
    expect(mockAddFlagged).toHaveBeenCalledTimes(1)
  })

  it('skips events where originator is zero address', async () => {
    // #given
    const contract = getMockContract()
    contract.queryFilter.mockResolvedValue([
      { args: { commitment: '0x' + 'ff'.repeat(32) } },
    ])
    contract.depositOriginator.mockResolvedValue('0x0000000000000000000000000000000000000000')

    // #when
    const result = await runDepositScreenerCycle(11155111)

    // #then
    expect(mockScreenRecipient).not.toHaveBeenCalled()
    expect(result.newFlagged).toBe(0)
  })
})
