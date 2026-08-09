import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { reverseCommission } from '@/lib/commission'
import {
  canApprove,
  clearedForCommercial,
  normaliseChecklist,
  type Checklist,
} from '@/lib/review-checklist'

/**
 * Admin operations.
 *
 * The review queue is the operational heart of the platform, and the refund
 * path is where the frozen-commission rule is finally cashed out. Both live
 * here rather than in a route handler so the rules are enforced once.
 */

/**
 * Duplicate detection.
 *
 * Perceptual hashes are compared, not checksums: a re-encode changes every
 * byte but barely moves a dHash. Matches are surfaced to the reviewer rather
 * than auto-rejected — a creator legitimately re-listing their own footage in
 * a new album looks identical to theft until a human reads the context.
 */
export async function findDuplicates(albumId: string) {
  const clips = await db.clip.findMany({
    where: { albumId, perceptualHash: { not: null } },
    select: { id: true, titleAr: true, perceptualHash: true },
  })
  if (clips.length === 0) return []

  const hashes = clips.map((clip) => clip.perceptualHash!) as string[]

  const matches = await db.clip.findMany({
    where: {
      perceptualHash: { in: hashes },
      albumId: { not: albumId },
    },
    select: {
      id: true,
      titleAr: true,
      perceptualHash: true,
      album: {
        select: { slug: true, titleAr: true, creator: { select: { handle: true } } },
      },
    },
  })

  return clips
    .map((clip) => ({
      clip,
      matches: matches.filter((match) => match.perceptualHash === clip.perceptualHash),
    }))
    .filter((row) => row.matches.length > 0)
}

export type ReviewDecisionInput = {
  taskId: string
  reviewerId: string
  checklist: Checklist
  decision: 'approve' | 'request_changes' | 'reject'
  note: string
}

/**
 * Record a review decision.
 *
 * Approval is refused unless every check is decided and no *blocking* check is
 * failing — releases and cultural appropriateness are both direct legal
 * exposure, so they cannot be waived by a reviewer in a hurry. The gate lives
 * in lib/review-checklist.ts and is re-run here rather than trusted from the
 * client.
 */
export async function decideReview(input: ReviewDecisionInput) {
  const task = await db.reviewTask.findUnique({
    where: { id: input.taskId },
    select: { id: true, albumId: true },
  })
  if (!task) return { ok: false as const, messageKey: 'state.notFound' }

  const checklist = normaliseChecklist(input.checklist)

  if (input.decision === 'approve') {
    const gate = canApprove(checklist)
    if (!gate.ok)
      return { ok: false as const, messageKey: 'admin.cannotApprove', detail: gate.reason }
  }

  if (input.decision !== 'approve' && !input.note.trim()) {
    // A rejection without a reason is a support ticket by another name.
    return { ok: false as const, messageKey: 'admin.decisionNote' }
  }

  const cleared = clearedForCommercial(checklist)

  await db.$transaction([
    db.reviewTask.update({
      where: { id: task.id },
      data: {
        reviewerId: input.reviewerId,
        status:
          input.decision === 'approve'
            ? 'approved'
            : input.decision === 'reject'
              ? 'rejected'
              : 'changes_requested',
        decision: input.decision,
        decisionNote: input.note || null,
        checklist: checklist as unknown as object,
        decidedAt: new Date(),
      },
    }),
    db.album.update({
      where: { id: task.albumId },
      data:
        input.decision === 'approve'
          ? {
              status: 'live',
              publishedAt: new Date(),
              clearedForCommercial: cleared,
              clearanceStatus: cleared ? 'full' : 'editorial_only',
            }
          : input.decision === 'reject'
            ? { status: 'delisted' }
            : // Changes requested reopens the album for editing — the creator
              // has to be able to act on the note.
              { status: 'changes_requested' },
    }),
  ])

  await recordAudit({
    actorId: input.reviewerId,
    action: `album.review.${input.decision}`,
    entity: 'Album',
    entityId: task.albumId,
    detail: { note: input.note, cleared },
  })

  return {
    ok: true as const,
    messageKey: `admin.${input.decision === 'approve' ? 'approved' : input.decision === 'reject' ? 'rejected' : 'changesSent'}`,
  }
}

/**
 * Refund an order line.
 *
 * The commission is reversed against the rate FROZEN on the OrderItem, never
 * a freshly resolved one. A creator promoted since the sale must not have that
 * promotion applied retroactively to a refund of an older order — the ledger
 * would stop netting to zero and the platform would silently absorb or claw
 * back the difference.
 */
export async function refundOrderItem({
  orderItemId,
  amount,
  reason,
  policyBasis,
  actorId,
}: {
  orderItemId: string
  amount: number
  reason: string
  policyBasis: string
  actorId: string
}) {
  const item = await db.orderItem.findUnique({
    where: { id: orderItemId },
    include: { order: true },
  })
  if (!item) return { ok: false as const, messageKey: 'state.notFound' }

  const gross = Number(item.grossAmount)
  const refundGross = Math.min(amount, gross - Number(item.refundedAmount))
  if (refundGross <= 0) return { ok: false as const, messageKey: 'state.error' }

  // THE frozen rate.
  const frozenRate = Number(item.commissionRate)
  const { commissionReversed, creatorNetReversed } = reverseCommission({ refundGross, frozenRate })

  const vatShare = Number(item.vatAmount) * (refundGross / gross)
  const isPartial = refundGross < gross

  await db.$transaction(async (tx) => {
    const refund = await tx.refund.create({
      data: {
        orderId: item.orderId,
        amount: refundGross,
        vatAmount: vatShare,
        reason,
        policyBasis,
        isPartial,
        processedById: actorId,
      },
    })

    await tx.refundLine.create({
      data: {
        refundId: refund.id,
        orderItemId: item.id,
        grossAmount: refundGross,
        vatAmount: vatShare,
        commissionReversed,
        creatorNetReversed,
      },
    })

    await tx.orderItem.update({
      where: { id: item.id },
      data: {
        refundedAmount: Number(item.refundedAmount) + refundGross,
        refundedAt: new Date(),
      },
    })

    await tx.order.update({
      where: { id: item.orderId },
      data: {
        refundedAmount: Number(item.order.refundedAmount) + refundGross,
        status: isPartial ? 'partially_refunded' : 'refunded',
      },
    })

    const previous = await tx.creatorLedger.findFirst({
      where: { creatorId: item.creatorId },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    })

    await tx.creatorLedger.create({
      data: {
        creatorId: item.creatorId,
        entryType: 'refund',
        amount: -creatorNetReversed,
        balanceAfter: Number(previous?.balanceAfter ?? 0) - creatorNetReversed,
        orderItemId: item.id,
        memo: reason,
      },
    })

    // A refunded entitlement stops working immediately — the download route
    // re-checks this on every redemption.
    if (!isPartial) {
      await tx.entitlement.updateMany({
        where: { orderItemId: item.id },
        data: { revokedAt: new Date(), revokeReason: reason },
      })
    }
  })

  await recordAudit({
    actorId,
    action: 'order.refund',
    entity: 'OrderItem',
    entityId: item.id,
    detail: { refundGross, frozenRate, commissionReversed, creatorNetReversed, policyBasis },
  })

  return { ok: true as const, messageKey: 'actions.confirm' }
}

/** Zero-result report — the content-acquisition roadmap. */
export async function zeroResultReport(limit = 50) {
  const rows = await db.searchQueryLog.groupBy({
    by: ['normalized'],
    where: { resultCount: 0 },
    _count: { normalized: true },
    _max: { createdAt: true },
    orderBy: { _count: { normalized: 'desc' } },
    take: limit,
  })

  const samples = await db.searchQueryLog.findMany({
    where: { normalized: { in: rows.map((row) => row.normalized) }, resultCount: 0 },
    distinct: ['normalized'],
    select: { normalized: true, query: true },
  })
  const byNormalised = new Map(samples.map((row) => [row.normalized, row.query]))

  return rows.map((row) => ({
    normalized: row.normalized,
    query: byNormalised.get(row.normalized) ?? row.normalized,
    searches: row._count.normalized,
    lastSeen: row._max.createdAt,
  }))
}
