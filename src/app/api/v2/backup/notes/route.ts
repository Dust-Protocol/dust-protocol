import { NextResponse } from 'next/server'
import { upsertNote } from '@/lib/dustpool/v2/backup-store'

export async function POST(req: Request) {
  const body = await req.json()
  const { ownerHash, commitment, ciphertext, iv, chainId } = body
  if (!ownerHash || !commitment || !ciphertext || !iv) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  upsertNote(ownerHash, commitment, ciphertext, iv, chainId ?? 0)
  return NextResponse.json({ ok: true })
}
