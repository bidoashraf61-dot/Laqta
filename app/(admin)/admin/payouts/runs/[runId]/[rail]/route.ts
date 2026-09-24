import { requireAdmin } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { buildRunExport, isRail } from '@/lib/payouts'

/**
 * One rail's export file for a payout run, as an attachment.
 *
 * Guarded twice, like every admin surface: middleware refuses a non-admin on
 * /admin/*, and this handler checks again because a route handler does not
 * sit under the (admin) layout's guard.
 *
 * The file carries account numbers, so it is never cached and every download
 * is audited.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string; rail: string }> },
) {
  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch {
    return new Response('Forbidden', { status: 403 })
  }

  const { runId, rail } = await params
  if (!isRail(rail)) return new Response('Not found', { status: 404 })

  const file = await buildRunExport(runId, rail)
  if (!file) return new Response('Not found', { status: 404 })

  // First download stamps the run as exported; later ones leave it alone.
  await db.payoutRun.updateMany({ where: { id: runId, exportedAt: null }, data: { exportedAt: new Date() } })
  await recordAudit({
    actorId: admin.id,
    action: 'payout_run.export',
    entity: 'PayoutRun',
    entityId: runId,
    detail: { rail, rows: file.rows },
  })

  return new Response(file.body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
