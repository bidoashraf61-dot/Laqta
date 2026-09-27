import { requireAdmin } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'
import { waitlistCsv } from '@/lib/waitlist'

/** The waitlist as CSV (DEV-45) — admin only, audited, never cached. */
export async function GET() {
  const admin = await requireAdmin()
  const body = await waitlistCsv()
  await recordAudit({ actorId: admin.id, action: 'waitlist.export', entity: 'WaitlistEntry' })
  const date = new Date().toISOString().slice(0, 10)
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="laqta-waitlist-${date}.csv"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
