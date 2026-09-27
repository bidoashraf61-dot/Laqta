import { db } from '@/lib/db'
import { currentLicenceId } from '@/lib/licence'
import { bandForCount, parseAlbumPrice } from '@/lib/price-bands'
import { loadPricingConfig } from '@/lib/pricing-config'
import { recordAudit } from '@/lib/audit'
import { notifyAlbumDecision } from '@/lib/notifications'
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
  /**
   * USD. Used to approve ONLY an album with no creator recommendation (saved
   * before the calculator); otherwise approval sells at the recommendation.
   */
  price?: number | string | null
  /** USD, optional: the owner's counter-price sent with request-changes (DEV-09b). */
  proposedPrice?: number | string | null
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
    select: {
      id: true,
      albumId: true,
      album: { select: { clipCount: true, recommendedPrice: true } },
    },
  })
  if (!task) return { ok: false as const, messageKey: 'state.notFound' }

  // A counter-price travels with the feedback (owner, 2026-09-27): only on
  // request-changes, optional, and in range when given.
  const pricing = await loadPricingConfig()
  let proposedPrice: number | null = null
  if (input.decision === 'request_changes' && String(input.proposedPrice ?? '').trim() !== '') {
    proposedPrice = parseAlbumPrice(input.proposedPrice, pricing)
    if (proposedPrice === null)
      return {
        ok: false as const,
        messageKey: 'admin.proposedPriceInvalid',
        vars: { min: pricing.priceMin, max: pricing.priceMax },
      }
  }

  const checklist = normaliseChecklist(input.checklist)

  // An approved album goes on sale, so it must carry the licence it is sold
  // under — set here as well as at creation, for albums made before DEV-06.
  let licenceVersionId: string | null = null
  let price: number | null = null
  let tier: 'mini' | 'standard' | 'pro' | 'signature' | undefined
  if (input.decision === 'approve') {
    // Approving the album approves its price (owner, 2026-09-27): the
    // creator's recommendation, which already passed the calculator or equals
    // the owner's last proposal. A different price goes back as a proposal
    // with «طلب تعديل», never straight live. Legacy albums with no
    // recommendation take the price typed on the page. $49–$249 either way;
    // the tier is only a record of which band the count fell in.
    price = parseAlbumPrice(
      task.album.recommendedPrice !== null ? Number(task.album.recommendedPrice) : input.price,
      pricing,
    )
    if (price === null)
      return {
        ok: false as const,
        messageKey: 'admin.priceRequired',
        vars: { min: pricing.priceMin, max: pricing.priceMax },
      }
    const bands = await db.priceBand.findMany({ select: { tier: true, minClips: true, maxClips: true } })
    tier = bandForCount(task.album.clipCount, bands)?.tier
    const gate = canApprove(checklist)
    if (!gate.ok)
      return { ok: false as const, messageKey: 'admin.cannotApprove', detail: gate.reason }
    licenceVersionId = await currentLicenceId()
    if (!licenceVersionId)
      return {
        ok: false as const,
        messageKey: 'admin.cannotApprove',
        detail: 'No licence is marked current.',
      }
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
        proposedPrice,
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
              licenceVersionId,
              priceStandard: price!,
              currency: 'USD',
              ...(tier ? { tier } : {}),
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

  /*
   * Tell the creator what happened.
   *
   * Queued after the decision commits rather than inside it: the decision is
   * the operator's action and must stand whether or not mail is reachable.
   * All three outcomes are told, rejection included — a creator whose album
   * silently turns "delisted" learns it from a status chip with no reason.
   * `admin.decisionNote` already forced the written reason the message quotes.
   * `notifyAlbumDecision` never throws and is keyed on the review task.
   */
  await notifyAlbumDecision(task.albumId)

  await recordAudit({
    actorId: input.reviewerId,
    action: `album.review.${input.decision}`,
    entity: 'Album',
    entityId: task.albumId,
    detail: {
      note: input.note,
      cleared,
      ...(price !== null ? { price } : {}),
      ...(proposedPrice !== null ? { proposedPrice } : {}),
    },
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
  let { commissionReversed, creatorNetReversed } = reverseCommission({ refundGross, frozenRate })

  // The refund that empties the line reverses exactly what is left of the
  // frozen amounts, so a line always nets to zero. The rate is stored to four
  // places; on a bundled line (DEV-62) it is derived from the amounts, and
  // rate × gross could land a cent off the creator's frozen net.
  const closesLine = Math.round((Number(item.refundedAmount) + refundGross) * 100) >= Math.round(gross * 100)
  if (closesLine) {
    const before = await db.refundLine.aggregate({
      where: { orderItemId: item.id },
      _sum: { commissionReversed: true, creatorNetReversed: true },
    })
    const cents = (value: number) => Math.round(value * 100) / 100
    commissionReversed = cents(Number(item.commissionAmount) - Number(before._sum.commissionReversed ?? 0))
    creatorNetReversed = cents(Number(item.creatorNetAmount) - Number(before._sum.creatorNetReversed ?? 0))
  }

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
