import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * `GET /api/health` (DEV-14) — what the host's health check and the uptime
 * monitor (DEV-59) call. 200 only when the app can reach its database; 503
 * otherwise, so a host restarts a container that lost it. Says nothing else:
 * no version, no counts, nothing a stranger could use.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
