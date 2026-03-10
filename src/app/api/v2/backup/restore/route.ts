import { NextResponse } from 'next/server'
import { getRestore } from '@/lib/dustpool/v2/backup-store'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const owner = searchParams.get('owner')
  if (!owner) {
    return NextResponse.json({ error: 'Missing owner param' }, { status: 400 })
  }
  const data = getRestore(owner)
  return NextResponse.json(data)
}
