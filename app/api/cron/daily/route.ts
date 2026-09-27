import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { runDailyJobs } from '@/lib/jobs'

/**
 * `POST /api/cron/daily` — the daily jobs (lib/jobs.ts) for a hosted scheduler
 * that can call a URL but not run a command. Authorised by
 * `Authorization: Bearer <CRON_SECRET>` only; with no secret configured the
 * route is shut (503), never open. Idempotent: a second call the same day
 * sends nothing twice.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return NextResponse.json({ error: 'unconfigured' }, { status: 503 })

  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }

  const result = await runDailyJobs()
  return NextResponse.json(result)
}
