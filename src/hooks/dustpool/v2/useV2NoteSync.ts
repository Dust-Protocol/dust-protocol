import { useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { openV2Database, getPendingNotes, updateNoteLeafIndex, markNoteSpent } from '@/lib/dustpool/v2/storage'

const POLL_INTERVAL_MS = 15_000
// Notes pending longer than 30 minutes are considered failed (tx reverted or never submitted)
const PENDING_TIMEOUT_MS = 30 * 60 * 1000

/**
 * Background poller that resolves pending V2 notes (leafIndex === -1) by
 * querying the relayer's deposit status endpoint. Without this, notes stay
 * 'pending' forever and withdrawals fail (need valid leafIndex for Merkle proof).
 */
export function useV2NoteSync(chainId: number) {
  const { address } = useAccount()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!address) return
    let cancelled = false

    async function syncPendingNotes() {
      try {
        const db = await openV2Database()
        const pending = await getPendingNotes(db, address!, chainId)
        if (pending.length === 0 || cancelled) return

        const now = Date.now()

        for (const note of pending) {
          if (cancelled) return
          try {
            // Notes pending too long are considered failed — mark spent to stop polling
            if (note.createdAt && now - note.createdAt > PENDING_TIMEOUT_MS) {
              await markNoteSpent(db, note.id).catch(() => {})
              continue
            }

            const commitmentHex = '0x' + BigInt(note.commitment).toString(16).padStart(64, '0')
            const res = await fetch(
              `/api/v2/deposit/status/${commitmentHex}?chainId=${chainId}`
            )
            if (cancelled) return
            if (!res.ok) continue

            const data = await res.json()
            if (data.confirmed && typeof data.leafIndex === 'number' && data.leafIndex >= 0) {
              await updateNoteLeafIndex(db, note.id, data.leafIndex)
            }
          } catch {
            // Individual note failure — continue with others
          }
        }
      } catch {
        // DB open failure — will retry on next interval
      }
    }

    syncPendingNotes()
    intervalRef.current = setInterval(syncPendingNotes, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [address, chainId])
}
