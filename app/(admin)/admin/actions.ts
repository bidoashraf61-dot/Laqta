'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { decideReview, refundOrderItem } from '@/lib/admin'
import { settleOrder } from '@/lib/orders'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import type { Checklist } from '@/lib/review-checklist'

export async function submitReview(input: {
  taskId: string
  checklist: Checklist
  decision: 'approve' | 'request_changes' | 'reject'
  note: string
}) {
  const admin = await requireAdmin()
  const result = await decideReview({ ...input, reviewerId: admin.id })
  revalidatePath('/admin')
  return result
}

/** Mark a bank-transfer order settled. Same accounting path as any other rail. */
export async function markOrderPaid(orderId: string) {
  const admin = await requireAdmin()
  await settleOrder(orderId, `MANUAL-${admin.id.slice(0, 8)}`)
  await recordAudit({
    actorId: admin.id,
    action: 'order.settle_manual',
    entity: 'Order',
    entityId: orderId,
  })
  revalidatePath('/admin')
  return { ok: true, messageKey: 'actions.confirm' }
}

export async function refund(input: {
  orderItemId: string
  amount: number
  reason: string
  policyBasis: string
}) {
  const admin = await requireAdmin()
  const result = await refundOrderItem({ ...input, actorId: admin.id })
  revalidatePath('/admin')
  return result
}

/**
 * Approve a creator application.
 *
 * 2FA is mandatory for creators, but it is enrolled by the creator, not forced
 * by an admin — approving here grants the role and the studio prompts for it.
 */
export async function approveCreator(creatorId: string) {
  const admin = await requireAdmin()

  const creator = await db.creator.update({
    where: { id: creatorId },
    data: { status: 'approved', approvedAt: new Date() },
    select: { userId: true },
  })
  await db.user.update({ where: { id: creator.userId }, data: { role: 'creator' } })

  await recordAudit({
    actorId: admin.id,
    action: 'creator.approve',
    entity: 'Creator',
    entityId: creatorId,
  })
  revalidatePath('/admin')
  return { ok: true, messageKey: 'actions.approve' }
}

/**
 * Start a support impersonation.
 *
 * Always audited, always with a stated reason. An impersonation that cannot be
 * traced back to a ticket is indistinguishable from an admin reading a
 * customer's library for fun.
 */
export async function beginImpersonation(targetUserId: string, reason: string, ticketRef?: string) {
  const admin = await requireAdmin()
  if (!reason.trim()) return { ok: false, messageKey: 'admin.impersonateReason' }

  const session = await db.impersonation.create({
    data: { adminId: admin.id, targetUserId, reason, ticketRef: ticketRef ?? null },
  })
  await recordAudit({
    actorId: admin.id,
    action: 'user.impersonate.start',
    entity: 'User',
    entityId: targetUserId,
    detail: { reason, ticketRef, impersonationId: session.id },
  })

  return { ok: true, messageKey: 'actions.confirm' }
}

export async function endImpersonation(impersonationId: string) {
  const admin = await requireAdmin()
  await db.impersonation.update({
    where: { id: impersonationId },
    data: { endedAt: new Date() },
  })
  await recordAudit({
    actorId: admin.id,
    action: 'user.impersonate.end',
    entity: 'Impersonation',
    entityId: impersonationId,
  })
  return { ok: true, messageKey: 'actions.confirm' }
}
