import { NextResponse } from 'next/server'
import { markSpent } from '@/lib/dustpool/v2/backup-store'

export async function PUT(req: Request) {
  const body = await req.json()
  const { ownerHash, commitment } = body
  if (!ownerHash || !commitment) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  markSpent(ownerHash, commitment)
  return NextResponse.json({ ok: true })
}
