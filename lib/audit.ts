import { headers } from 'next/headers'
import { db } from '@/lib/db'

/**
 * Append-only audit trail.
 *
 * Every state-changing admin action writes one row. Impersonation in
 * particular is required by Brief 06 to be audit-logged.
 */
export async function recordAudit({
  actorId,
  action,
  entity,
  entityId,
  detail,
}: {
  actorId: string | null
  action: string
  entity: string
  entityId?: string | null
  detail?: unknown
}) {
  let ip: string | null = null
  let userAgent: string | null = null
  try {
    const headerList = await headers()
    ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    userAgent = headerList.get('user-agent')
  } catch {
    // Called outside a request (seed, job runner) — headers are unavailable.
  }

  return db.auditLog.create({
    data: {
      actorId,
      action,
      entity,
      entityId: entityId ?? null,
      detail: detail === undefined ? undefined : JSON.parse(JSON.stringify(detail)),
      ip,
      userAgent,
    },
  })
}
