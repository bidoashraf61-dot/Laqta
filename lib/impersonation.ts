import type { Role } from '@prisma/client'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import {
  IMPERSONATION_MINUTES,
  restoreAdmin,
  type ImpersonationClaim,
} from '@/lib/impersonation-shared'

/**
 * View-as-user — the database half. See `lib/impersonation-shared.ts` for how
 * a view works and how read-only is enforced.
 *
 * ── Who can be viewed (decided 2026-09-24) ──────────────────────────────────
 * Buyers only. An admin is never viewable — a view of an admin would be an
 * admin session with a different name on it. Creators are refused by default
 * too: their account is protected by mandatory 2FA and their studio holds
 * payout details (IBAN, Payoneer, tax residency), and a support view does not
 * need either. A creator's albums, sales and payouts are already readable on
 * `/admin/catalogue`, `/admin/orders` and `/admin/payouts`.
 */

export type ViewRefusal =
  | 'dash.viewAsReasonRequired'
  | 'dash.viewAsRefusedAdmin'
  | 'dash.viewAsRefusedCreator'
  | 'dash.viewAsRefusedSelf'
  | 'state.notFound'

export function viewRefusal(
  adminId: string,
  target: { id: string; role: Role; twoFactorEnabled: boolean } | null,
): ViewRefusal | null {
  if (!target) return 'state.notFound'
  if (target.id === adminId) return 'dash.viewAsRefusedSelf'
  if (target.role === 'admin') return 'dash.viewAsRefusedAdmin'
  if (target.role === 'creator' || target.twoFactorEnabled) return 'dash.viewAsRefusedCreator'
  return null
}

/** Open an audited view. The caller has already proved the actor is an admin. */
export async function openImpersonation(input: {
  adminId: string
  targetUserId: string
  reason: string
  ticketRef?: string | null
  ip?: string | null
}): Promise<{ ok: true; id: string } | { ok: false; messageKey: ViewRefusal }> {
  const reason = input.reason.trim()
  if (!reason) return { ok: false, messageKey: 'dash.viewAsReasonRequired' }

  const target = await db.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, role: true, twoFactorEnabled: true },
  })
  const refusal = viewRefusal(input.adminId, target)
  if (refusal) return { ok: false, messageKey: refusal }

  await closeExpiredImpersonations()

  const expiresAt = new Date(Date.now() + IMPERSONATION_MINUTES * 60_000)
  const row = await db.impersonation.create({
    data: {
      adminId: input.adminId,
      targetUserId: input.targetUserId,
      reason: reason.slice(0, 500),
      ticketRef: input.ticketRef?.trim().slice(0, 120) || null,
      expiresAt,
      ip: input.ip ?? null,
    },
    select: { id: true },
  })
  await recordAudit({
    actorId: input.adminId,
    action: 'user.impersonate.start',
    entity: 'User',
    entityId: input.targetUserId,
    detail: {
      impersonationId: row.id,
      reason,
      ticketRef: input.ticketRef || null,
      expiresAt: expiresAt.toISOString(),
    },
  })
  return { ok: true, id: row.id }
}

/** Close one view. Idempotent: a second close changes nothing and audits nothing. */
export async function closeImpersonation(id: string, endReason: 'ended' | 'expired') {
  const row = await db.impersonation.findUnique({
    where: { id },
    select: { id: true, adminId: true, targetUserId: true, endedAt: true, expiresAt: true },
  })
  if (!row || row.endedAt) return
  const endedAt = endReason === 'expired' && row.expiresAt ? row.expiresAt : new Date()
  const { count } = await db.impersonation.updateMany({
    where: { id, endedAt: null },
    data: { endedAt, endReason },
  })
  if (!count) return
  await recordAudit({
    actorId: row.adminId,
    action: endReason === 'expired' ? 'user.impersonate.expired' : 'user.impersonate.end',
    entity: 'User',
    entityId: row.targetUserId,
    detail: { impersonationId: id },
  })
}

/**
 * Close every view whose clock ran out without anyone pressing "end". The
 * cookie already stopped being a view at `expiresAt` (middleware restores the
 * admin); this makes the row and the audit trail say so too.
 */
export async function closeExpiredImpersonations() {
  const due = await db.impersonation.findMany({
    where: { endedAt: null, expiresAt: { lte: new Date() } },
    select: { id: true },
    take: 50,
  })
  for (const row of due) await closeImpersonation(row.id, 'expired')
}

type Token = Record<string, unknown> & { imp?: ImpersonationClaim }

/**
 * Turn the admin's token into a view of the target. Every fact is re-read
 * from the database: the row must exist, belong to THIS admin, be open and in
 * date, and the target must still be viewable. Anything else leaves the token
 * untouched, so a forged `update()` from a browser does nothing.
 */
export async function applyImpersonationStart(token: Token, impersonationId: string) {
  if (token.imp || typeof token.uid !== 'string') return token

  const row = await db.impersonation.findUnique({
    where: { id: impersonationId },
    select: {
      adminId: true,
      endedAt: true,
      expiresAt: true,
      admin: { select: { role: true, status: true } },
      target: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          image: true,
          role: true,
          locale: true,
          twoFactorEnabled: true,
          creator: { select: { id: true } },
        },
      },
    },
  })
  if (!row || row.adminId !== token.uid || row.endedAt || !row.expiresAt) return token
  if (row.expiresAt.getTime() <= Date.now()) return token
  if (row.admin.role !== 'admin' || row.admin.status !== 'active') return token
  if (viewRefusal(row.adminId, row.target)) return token

  const target = row.target
  token.imp = {
    id: impersonationId,
    expiresAt: row.expiresAt.getTime(),
    targetName: target.name || target.email || target.phone || target.id,
    admin: {
      uid: token.uid,
      role: String(token.role ?? 'admin'),
      locale: String(token.locale ?? 'ar'),
      creatorId: (token.creatorId as string | null) ?? null,
      name: (token.name as string | null) ?? null,
      email: (token.email as string | null) ?? null,
      picture: (token.picture as string | null) ?? null,
      ...(typeof token.tfa === 'boolean' ? { twoFactorEnabled: token.tfa } : {}),
    },
  }
  token.impersonatedBy = row.adminId
  token.uid = target.id
  token.sub = target.id
  token.role = target.role
  token.locale = target.locale
  token.creatorId = target.creator?.id ?? null
  token.name = target.name
  token.email = target.email
  token.picture = target.image
  token.tfa = target.twoFactorEnabled
  return token
}

/** End the view carried by this token and hand the admin their identity back. */
export async function applyImpersonationEnd(token: Token) {
  const imp = token.imp
  if (!imp) return token
  await closeImpersonation(imp.id, Date.now() >= imp.expiresAt ? 'expired' : 'ended')
  return restoreAdmin(token)
}
