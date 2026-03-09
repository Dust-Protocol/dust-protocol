import { NextResponse } from 'next/server'
import { registry } from '@/lib/metrics'

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.ADMIN_SECRET
  if (secret) {
    const url = new URL(req.url)
    const token = url.searchParams.get('token') ?? req.headers.get('authorization')?.replace('Bearer ', '')
    if (token !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const metrics = await registry.metrics()
  return new NextResponse(metrics, {
    headers: { 'Content-Type': registry.contentType },
  })
}
