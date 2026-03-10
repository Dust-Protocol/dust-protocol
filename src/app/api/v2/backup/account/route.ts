import { NextResponse } from 'next/server'
import { upsertAccount } from '@/lib/dustpool/v2/backup-store'

export async function POST(req: Request) {
  const body = await req.json()
  const { ownerHash, ciphertext, iv } = body
  if (!ownerHash || !ciphertext || !iv) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  upsertAccount(ownerHash, ciphertext, iv)
  return NextResponse.json({ ok: true })
}
