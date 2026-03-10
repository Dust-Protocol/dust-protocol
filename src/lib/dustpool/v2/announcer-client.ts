import { ethers } from 'ethers'
import { getChainConfig } from '@/config/chains'
import { getChainProvider } from '@/lib/providers'

const NOTE_ANNOUNCER_ABI = [
  'function announce(bytes32 commitment, bytes ciphertext) external',
  'function announceBatch(bytes32[] commitments, bytes[] ciphertexts) external',
  'event EncryptedNote(bytes32 indexed commitment, bytes ciphertext)',
]

function getAnnouncerAddress(chainId: number): string | null {
  try {
    const config = getChainConfig(chainId)
    return config.contracts.noteAnnouncer ?? null
  } catch {
    return null
  }
}

export async function announceNote(
  commitment: string,
  ciphertext: string,
  walletClient: { sendTransaction: (args: { to: string; data: string }) => Promise<string> },
  chainId: number,
): Promise<string | null> {
  const addr = getAnnouncerAddress(chainId)
  if (!addr) return null

  const iface = new ethers.utils.Interface(NOTE_ANNOUNCER_ABI)
  const encoded = ethers.utils.hexlify(ethers.utils.toUtf8Bytes(ciphertext))
  const data = iface.encodeFunctionData('announce', [commitment, encoded])

  try {
    return await walletClient.sendTransaction({ to: addr, data })
  } catch {
    return null
  }
}

export async function announceBatch(
  commitments: string[],
  ciphertexts: string[],
  walletClient: { sendTransaction: (args: { to: string; data: string }) => Promise<string> },
  chainId: number,
): Promise<string | null> {
  const addr = getAnnouncerAddress(chainId)
  if (!addr) return null

  const iface = new ethers.utils.Interface(NOTE_ANNOUNCER_ABI)
  const encodedTexts = ciphertexts.map(ct => ethers.utils.hexlify(ethers.utils.toUtf8Bytes(ct)))
  const data = iface.encodeFunctionData('announceBatch', [commitments, encodedTexts])

  try {
    return await walletClient.sendTransaction({ to: addr, data })
  } catch {
    return null
  }
}

export async function scanEncryptedNotes(
  chainId: number,
  fromBlock: number,
  onProgress?: (scanned: number, total: number) => void,
): Promise<Array<{ commitment: string; ciphertext: string }>> {
  const addr = getAnnouncerAddress(chainId)
  if (!addr) return []

  const provider = getChainProvider(chainId)
  const contract = new ethers.Contract(addr, NOTE_ANNOUNCER_ABI, provider)

  const latestBlock = await provider.getBlockNumber()
  const results: Array<{ commitment: string; ciphertext: string }> = []
  const BATCH_SIZE = 5000

  for (let from = fromBlock; from <= latestBlock; from += BATCH_SIZE) {
    const to = Math.min(from + BATCH_SIZE - 1, latestBlock)
    const events = await contract.queryFilter(contract.filters.EncryptedNote(), from, to)

    for (const ev of events) {
      if (ev.args) {
        results.push({
          commitment: ev.args.commitment,
          ciphertext: ethers.utils.toUtf8String(ev.args.ciphertext),
        })
      }
    }

    onProgress?.(to - fromBlock, latestBlock - fromBlock)
  }

  return results
}
