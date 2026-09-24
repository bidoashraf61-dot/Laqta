'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { decideReview, refundOrderItem } from '@/lib/admin'
import { settleOrder } from '@/lib/orders'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { actionT } from '@/lib/locale-request'
import type { Checklist } from '@/lib/review-checklist'
import { isPublicMediaKey, mediaUrl } from '@/lib/media'
import {
  createPayoutRun,
  excludeFromRun,
  markPayoutPaid as postSinglePayout,
  markRunPaid,
} from '@/lib/payouts'

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

// ─────────────────────────────────────────────────────────────────────────────
// Control panel actions.
//
// Everything below is reachable only by an admin, is audited, and returns the
// `{ ok, message }` shape the dashboard's ActionButton and SettingsForm both
// consume. Messages are resolved to Arabic here rather than returning a key,
// so a client component never has to know the dictionary.
// ─────────────────────────────────────────────────────────────────────────────

type Result = { ok: boolean; message?: string }

/** Suspend or reinstate a creator. Suspension hides their catalogue too. */
export async function setCreatorStatus(
  creatorId: string,
  status: 'approved' | 'suspended' | 'rejected',
): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()

  await db.creator.update({
    where: { id: creatorId },
    data: {
      status,
      suspendedAt: status === 'suspended' ? new Date() : null,
      ...(status === 'approved' ? { approvedAt: new Date() } : {}),
    },
  })

  // A suspended creator's live albums leave the catalogue. Paused rather than
  // delisted, so reinstating is one click and buyers' entitlements — which are
  // served from the order snapshot — are untouched either way.
  if (status === 'suspended') {
    await db.album.updateMany({ where: { creatorId, status: 'live' }, data: { status: 'paused' } })
  }

  await recordAudit({
    actorId: admin.id,
    action: `creator.${status}`,
    entity: 'Creator',
    entityId: creatorId,
  })

  revalidatePath('/admin/creators')
  return { ok: true, message: tr('actions.confirm') }
}

/**
 * Set a creator's tier or per-creator commission override.
 *
 * Changing either affects FUTURE sales only. Existing OrderItems carry their
 * own frozen `commissionRate`, and nothing here recomputes them — that is the
 * invariant the whole money model rests on.
 */
export async function setCreatorCommission(
  _state: Result | null,
  formData: FormData,
): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()

  const creatorId = String(formData.get('creatorId') ?? '')
  const tier = String(formData.get('tier') ?? 'standard')
  const rawOverride = String(formData.get('commissionRateOverride') ?? '').trim()

  if (!['standard', 'silver', 'gold'].includes(tier)) {
    return { ok: false, message: tr('state.error') }
  }

  let override: number | null = null
  if (rawOverride) {
    const parsed = Number(rawOverride)
    // Entered as a percentage the admin can read, stored as a fraction.
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 50) {
      return { ok: false, message: tr('dash.commissionOverrideHint') }
    }
    override = parsed / 100
  }

  await db.creator.update({
    where: { id: creatorId },
    data: { tier: tier as 'standard' | 'silver' | 'gold', commissionRateOverride: override },
  })

  await recordAudit({
    actorId: admin.id,
    action: 'creator.commission.update',
    entity: 'Creator',
    entityId: creatorId,
    detail: { tier, override },
  })

  revalidatePath('/admin/creators')
  return { ok: true, message: tr('dash.saved') }
}

/** Pause, resume or delist a published album from the catalogue. */
export async function setAlbumStatus(
  albumId: string,
  status: 'live' | 'paused' | 'delisted',
): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()

  await db.album.update({
    where: { id: albumId },
    data: { status, delistedAt: status === 'delisted' ? new Date() : null },
  })

  await recordAudit({
    actorId: admin.id,
    action: `album.${status}`,
    entity: 'Album',
    entityId: albumId,
  })

  revalidatePath('/admin/catalogue')
  return { ok: true, message: tr('actions.confirm') }
}

/** Feature or unfeature an album on the storefront. */
export async function toggleAlbumFeatured(albumId: string, featured: boolean): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()

  await db.album.update({
    where: { id: albumId },
    data: { isFeatured: featured, featureRank: featured ? 0 : null },
  })
  await recordAudit({
    actorId: admin.id,
    action: `album.${featured ? 'feature' : 'unfeature'}`,
    entity: 'Album',
    entityId: albumId,
  })

  revalidatePath('/admin/merchandising')
  revalidatePath('/')
  return { ok: true, message: tr('actions.confirm') }
}

/**
 * Set or clear an album's trailer.
 *
 * The value is a key in the PUBLIC media bucket (`trailers/<slug>.mp4`, as
 * `npm run media:upload` writes it), a URL on the media CDN, or — in
 * development — a "/"-rooted file under public/. Anything else is refused
 * here, at save time: a typo that saved would surface only as a storefront
 * that quietly shows a still, which nobody would connect back to this form.
 *
 * Empty clears it, and the album page leads with its cover still again.
 */
export async function saveAlbumTrailer(
  _state: Result | null,
  formData: FormData,
): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()

  const albumId = String(formData.get('albumId') ?? '').trim()
  const raw = String(formData.get('trailerKey') ?? '').trim()
  if (!albumId) return { ok: false, message: tr('state.error') }
  if (raw && !isPublicMediaKey(raw)) return { ok: false, message: tr('dash.trailerInvalid') }

  const album = await db.album.update({
    where: { id: albumId },
    data: { trailerKey: raw || null },
    select: { slug: true, creator: { select: { handle: true } } },
  })
  await recordAudit({
    actorId: admin.id,
    action: raw ? 'album.trailer_set' : 'album.trailer_cleared',
    entity: 'Album',
    entityId: albumId,
    detail: { trailerKey: raw || null },
  })

  revalidatePath('/admin/catalogue')
  revalidatePath(`/albums/${album.creator.handle}/${album.slug}`)

  if (!raw) return { ok: true, message: tr('dash.trailerCleared') }
  // Saved, but say so plainly when it cannot show yet: a bucket key with no
  // CDN configured resolves to nothing, and the page keeps its still.
  if (!mediaUrl(raw)) return { ok: true, message: tr('dash.trailerNoCdn') }
  return { ok: true, message: tr('dash.saved') }
}

// ── Taxonomy ────────────────────────────────────────────────────────────────

/**
 * Create or update a taxonomy term.
 *
 * Synonyms are the load-bearing field, not the name: they are what lets an
 * Arabic query reach English-tagged footage ("AlUla" ↔ "العلا") and what makes
 * a hamza or alef variant match. Comma-separated in, array out.
 */
export async function saveTaxonomy(_state: Result | null, formData: FormData): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()

  const id = String(formData.get('id') ?? '').trim()
  const kind = String(formData.get('kind') ?? 'category')
  const slug = String(formData.get('slug') ?? '')
    .trim()
    .toLowerCase()
  const nameAr = String(formData.get('nameAr') ?? '').trim()
  const nameEn = String(formData.get('nameEn') ?? '').trim()

  if (!['category', 'location', 'tag', 'theme'].includes(kind)) {
    return { ok: false, message: tr('state.error') }
  }
  if (!nameAr || !nameEn) return { ok: false, message: tr('dash.termAr') }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return { ok: false, message: tr('dash.termSlug') }

  // Splits on the Arabic comma as well as the Latin one — an Arabic keyboard
  // produces `،`, and silently keeping "الرياض، رياض" as a single synonym
  // would mean the whole phrase never matches anything.
  const list = (value: FormDataEntryValue | null) =>
    String(value ?? '')
      .split(/[,،]/)
      .map((entry) => entry.trim())
      .filter(Boolean)

  const parentId = String(formData.get('parentId') ?? '').trim() || null
  const data = {
    kind: kind as 'category' | 'location' | 'tag' | 'theme',
    slug,
    nameAr,
    nameEn,
    synonymsAr: list(formData.get('synonymsAr')),
    synonymsEn: list(formData.get('synonymsEn')),
    parentId: parentId === id ? null : parentId,
    isActive: formData.get('isActive') !== null,
    sortOrder: Number(formData.get('sortOrder') ?? 0) || 0,
  }

  const clash = await db.taxonomy.findFirst({
    where: { kind: data.kind, slug, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  })
  if (clash) return { ok: false, message: tr('dash.termSlug') }

  const term = id
    ? await db.taxonomy.update({ where: { id }, data })
    : await db.taxonomy.create({ data })

  await recordAudit({
    actorId: admin.id,
    action: id ? 'taxonomy.update' : 'taxonomy.create',
    entity: 'Taxonomy',
    entityId: term.id,
    detail: { kind, slug },
  })

  revalidatePath('/admin/taxonomy')
  return { ok: true, message: tr('dash.saved') }
}

/**
 * Retire a term.
 *
 * Deactivated, never deleted: a term with albums attached would take the
 * attachments with it, and a location that quietly vanishes breaks every
 * bookmarked URL pointing at it.
 */
export async function toggleTaxonomyActive(id: string, isActive: boolean): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()
  await db.taxonomy.update({ where: { id }, data: { isActive } })
  await recordAudit({
    actorId: admin.id,
    action: `taxonomy.${isActive ? 'activate' : 'deactivate'}`,
    entity: 'Taxonomy',
    entityId: id,
  })
  revalidatePath('/admin/taxonomy')
  return { ok: true, message: tr('actions.confirm') }
}

// ── Merchandising ───────────────────────────────────────────────────────────

/** Edit a homepage slot's copy, media and scheduling window. */
export async function saveSlot(_state: Result | null, formData: FormData): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()

  const id = String(formData.get('id') ?? '').trim()
  const key = String(formData.get('key') ?? '').trim()
  if (!id && !key) return { ok: false, message: tr('state.error') }

  const startsAt = String(formData.get('startsAt') ?? '')
  const endsAt = String(formData.get('endsAt') ?? '')

  const data = {
    titleAr: String(formData.get('titleAr') ?? '').trim() || null,
    titleEn: String(formData.get('titleEn') ?? '').trim() || null,
    subtitleAr: String(formData.get('subtitleAr') ?? '').trim() || null,
    subtitleEn: String(formData.get('subtitleEn') ?? '').trim() || null,
    ctaLabelAr: String(formData.get('ctaLabelAr') ?? '').trim() || null,
    ctaLabelEn: String(formData.get('ctaLabelEn') ?? '').trim() || null,
    linkUrl: String(formData.get('linkUrl') ?? '').trim() || null,
    mediaUrl: String(formData.get('mediaUrl') ?? '').trim() || null,
    sortOrder: Number(formData.get('sortOrder') ?? 0) || 0,
    startsAt: startsAt ? new Date(startsAt) : null,
    endsAt: endsAt ? new Date(endsAt) : null,
  }

  const slot = id
    ? await db.merchandisingSlot.update({ where: { id }, data })
    : await db.merchandisingSlot.create({ data: { ...data, key } })

  await recordAudit({
    actorId: admin.id,
    action: id ? 'slot.update' : 'slot.create',
    entity: 'MerchandisingSlot',
    entityId: slot.id,
  })

  revalidatePath('/admin/merchandising')
  revalidatePath('/')
  return { ok: true, message: tr('dash.saved') }
}

export async function toggleSlotActive(id: string, isActive: boolean): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()
  await db.merchandisingSlot.update({ where: { id }, data: { isActive } })
  await recordAudit({
    actorId: admin.id,
    action: `slot.${isActive ? 'activate' : 'deactivate'}`,
    entity: 'MerchandisingSlot',
    entityId: id,
  })
  revalidatePath('/admin/merchandising')
  revalidatePath('/')
  return { ok: true, message: tr('actions.confirm') }
}

export async function toggleCollection(
  id: string,
  field: 'isPublished' | 'isFeatured',
  value: boolean,
): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()
  await db.collection.update({ where: { id }, data: { [field]: value } })
  await recordAudit({
    actorId: admin.id,
    action: `collection.${field}.${value}`,
    entity: 'Collection',
    entityId: id,
  })
  revalidatePath('/admin/merchandising')
  revalidatePath('/collections')
  return { ok: true, message: tr('actions.confirm') }
}

// ── Promo codes ─────────────────────────────────────────────────────────────

/** Create or update a promo code. */
export async function savePromo(_state: Result | null, formData: FormData): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()

  const id = String(formData.get('id') ?? '').trim()
  const code = String(formData.get('code') ?? '')
    .trim()
    .toUpperCase()
  const kind = String(formData.get('kind') ?? 'percent')
  const value = Number(formData.get('value') ?? 0)

  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) return { ok: false, message: tr('dash.promoCode') }
  if (!['percent', 'fixed'].includes(kind)) return { ok: false, message: tr('state.error') }
  // A 100%-off percent code is a free catalogue; a negative one is a credit.
  if (!Number.isFinite(value) || value <= 0 || (kind === 'percent' && value > 90)) {
    return { ok: false, message: tr('dash.promoValue') }
  }

  const clash = await db.promoCode.findFirst({
    where: { code, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  })
  if (clash) return { ok: false, message: tr('dash.promoCode') }

  const startsAt = String(formData.get('startsAt') ?? '')
  const endsAt = String(formData.get('endsAt') ?? '')
  const maxRedemptions = String(formData.get('maxRedemptions') ?? '').trim()
  const minOrderTotal = String(formData.get('minOrderTotal') ?? '').trim()

  const data = {
    code,
    kind: kind as 'percent' | 'fixed',
    value,
    maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
    minOrderTotal: minOrderTotal ? Number(minOrderTotal) : null,
    startsAt: startsAt ? new Date(startsAt) : null,
    endsAt: endsAt ? new Date(endsAt) : null,
    isActive: formData.get('isActive') !== null,
  }

  const promo = id
    ? await db.promoCode.update({ where: { id }, data })
    : await db.promoCode.create({ data })

  await recordAudit({
    actorId: admin.id,
    action: id ? 'promo.update' : 'promo.create',
    entity: 'PromoCode',
    entityId: promo.id,
    detail: { code, kind, value },
  })

  revalidatePath('/admin/promos')
  return { ok: true, message: tr('dash.saved') }
}

export async function togglePromoActive(id: string, isActive: boolean): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()
  await db.promoCode.update({ where: { id }, data: { isActive } })
  await recordAudit({
    actorId: admin.id,
    action: `promo.${isActive ? 'activate' : 'deactivate'}`,
    entity: 'PromoCode',
    entityId: id,
  })
  revalidatePath('/admin/promos')
  return { ok: true, message: tr('actions.confirm') }
}

// ── Payouts ─────────────────────────────────────────────────────────────────

/**
 * Approve a payout request.
 *
 * Approval is where the destination is FROZEN onto the payout. Bank details
 * may legitimately change while a request sits in the queue, and an export
 * file generated days later must pay the account that was approved, not
 * whatever the creator's profile happens to say at export time.
 */
export async function approvePayout(payoutId: string): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()

  const payout = await db.payout.findUnique({
    where: { id: payoutId },
    select: { id: true, status: true, creator: true },
  })
  if (!payout) return { ok: false, message: tr('state.notFound') }
  if (payout.status !== 'requested') return { ok: false, message: tr('state.error') }

  const creator = payout.creator
  const destination =
    creator.payoutMethod === 'iban'
      ? { method: 'iban', iban: creator.iban, bankName: creator.bankName, beneficiary: creator.beneficiaryName }
      : creator.payoutMethod === 'payoneer'
        ? { method: 'payoneer', email: creator.payoneerEmail, beneficiary: creator.beneficiaryName ?? creator.displayNameEn }
        : { method: 'wise', email: creator.wiseEmail, beneficiary: creator.beneficiaryName ?? creator.displayNameEn }

  await db.payout.update({
    where: { id: payoutId },
    data: {
      status: 'approved',
      approvedById: admin.id,
      approvedAt: new Date(),
      destinationSnapshot: destination,
    },
  })

  await recordAudit({
    actorId: admin.id,
    action: 'payout.approve',
    entity: 'Payout',
    entityId: payoutId,
    detail: destination,
  })

  revalidatePath('/admin/payouts')
  return { ok: true, message: tr('actions.confirm') }
}

/**
 * Mark a payout paid.
 *
 * The posting itself is `lib/payouts#postPayoutPaid` — the same function a
 * whole run uses — so there is one accounting path. It writes the payout row
 * and its `payout` ledger entry in one transaction, and refuses a payout that
 * is already paid or that belongs to a run (the run is paid as a whole).
 */
export async function markPayoutPaid(payoutId: string, reference: string): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()

  const payout = await db.payout.findUnique({ where: { id: payoutId }, select: { id: true } })
  if (!payout) return { ok: false, message: tr('state.notFound') }

  const paid = await postSinglePayout(payoutId, reference)
  if (!paid) return { ok: false, message: tr('state.error') }

  await recordAudit({
    actorId: admin.id,
    action: 'payout.paid',
    entity: 'Payout',
    entityId: payoutId,
    detail: { reference },
  })

  revalidatePath('/admin/payouts')
  return { ok: true, message: tr('actions.confirm') }
}

/** Batch every approved payout into a new draft run. */
export async function createRun(): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()

  const run = await createPayoutRun(admin.id)
  if (!run) return { ok: false, message: tr('payoutRun.nothingToBatch') }

  await recordAudit({
    actorId: admin.id,
    action: 'payout_run.create',
    entity: 'PayoutRun',
    entityId: run.id,
    detail: { label: run.label, count: run.count },
  })

  revalidatePath('/admin/payouts')
  return { ok: true, message: tr('payoutRun.created', { count: String(run.count) }) }
}

/** Take a line out of a draft run; it returns to the queue as approved. */
export async function excludeRunLine(runId: string, payoutId: string, reason: string): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()

  const result = await excludeFromRun(runId, payoutId, reason)
  if (!result.ok) return { ok: false, message: tr('state.error') }

  await recordAudit({
    actorId: admin.id,
    action: 'payout_run.exclude',
    entity: 'Payout',
    entityId: payoutId,
    detail: { runId, reason },
  })

  revalidatePath('/admin/payouts')
  return { ok: true, message: tr('payoutRun.excluded') }
}

/** Close a draft run as paid. A second submit is a no-op, not an error. */
export async function payRun(runId: string, reference: string): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()

  const result = await markRunPaid(runId, reference, admin.id)
  if (!result.ok) {
    return {
      ok: false,
      message: result.reason === 'no-reference' ? tr('payoutRun.referenceRequired') : tr('state.error'),
    }
  }
  if (result.alreadyPaid) return { ok: true, message: tr('payoutRun.alreadyPaid') }

  await recordAudit({
    actorId: admin.id,
    action: 'payout_run.paid',
    entity: 'PayoutRun',
    entityId: runId,
    detail: { reference: reference.trim(), paid: result.paid },
  })

  revalidatePath('/admin/payouts')
  return { ok: true, message: tr('payoutRun.paid', { count: String(result.paid) }) }
}

// ── Disputes ────────────────────────────────────────────────────────────────

/**
 * Move a dispute along.
 *
 * `content_disabled` is the one that acts on the catalogue: the complained-of
 * album is paused immediately. Deliberately reversible — a counter-notice is
 * common and a delisted album with sold entitlements is far messier to undo.
 */
export async function setDisputeStatus(
  disputeId: string,
  status: 'open' | 'investigating' | 'content_disabled' | 'resolved' | 'rejected',
  resolution?: string,
): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()

  const dispute = await db.dispute.findUnique({
    where: { id: disputeId },
    select: { id: true, albumId: true },
  })
  if (!dispute) return { ok: false, message: tr('state.notFound') }

  await db.dispute.update({
    where: { id: disputeId },
    data: {
      status,
      assigneeId: admin.id,
      resolution: resolution?.trim() || undefined,
      contentDisabledAt: status === 'content_disabled' ? new Date() : null,
      resolvedAt: status === 'resolved' || status === 'rejected' ? new Date() : null,
    },
  })

  if (dispute.albumId) {
    if (status === 'content_disabled') {
      await db.album.updateMany({
        where: { id: dispute.albumId, status: 'live' },
        data: { status: 'paused' },
      })
    } else if (status === 'rejected') {
      // The claim failed — put the album back where it was.
      await db.album.updateMany({
        where: { id: dispute.albumId, status: 'paused' },
        data: { status: 'live' },
      })
    }
  }

  await recordAudit({
    actorId: admin.id,
    action: `dispute.${status}`,
    entity: 'Dispute',
    entityId: disputeId,
    detail: { resolution },
  })

  revalidatePath('/admin/disputes')
  return { ok: true, message: tr('actions.confirm') }
}

// ── Contact messages ────────────────────────────────────────────────────────

/**
 * Mark a /contact message handled, or reopen it.
 *
 * "Handled" means the operator dealt with it — replied, forwarded, or decided
 * no reply was owed. The message itself is never edited or deleted here: it is
 * the visitor's own words and the record of what was asked.
 */
export async function setContactMessageStatus(
  messageId: string,
  status: 'open' | 'handled',
): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()

  await db.contactMessage.update({
    where: { id: messageId },
    data:
      status === 'handled'
        ? { status, handledAt: new Date(), handledById: admin.id }
        : { status, handledAt: null, handledById: null },
  })

  await recordAudit({
    actorId: admin.id,
    action: `contact.${status}`,
    entity: 'ContactMessage',
    entityId: messageId,
  })

  revalidatePath('/admin/messages')
  return { ok: true, message: tr('actions.confirm') }
}
