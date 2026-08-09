'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireCreator } from '@/lib/auth'
import { db } from '@/lib/db'
import { getEarnings, submitForReview, MIN_PAYOUT_USD } from '@/lib/studio'
import { recordAudit } from '@/lib/audit'
import { t } from '@/lib/i18n'

type Result = { ok: boolean; message?: string }

/**
 * Every action here re-resolves the creator from the session and scopes the
 * query by `creatorId`. A server action is reachable by anyone who can guess
 * its id — rendering the page is not the authorisation boundary.
 */
async function ownedAlbum(albumId: string) {
  const user = await requireCreator()
  const album = await db.album.findFirst({
    where: { id: albumId, ...(user.role === 'admin' ? {} : { creatorId: user.creatorId ?? '' }) },
    select: { id: true, status: true, creatorId: true },
  })
  return { user, album }
}

/** Submit an album for review. */
export async function submitAlbum(albumId: string) {
  const { user, album } = await ownedAlbum(albumId)
  if (!album) return { ok: false, reasons: ['studio.albumMissing'] }
  if (album.status !== 'draft' && album.status !== 'changes_requested') {
    return { ok: false, reasons: ['studio.inReview'] }
  }

  const result = await submitForReview(albumId)
  if (result.ok) {
    await recordAudit({
      actorId: user.id,
      action: 'album.submit',
      entity: 'Album',
      entityId: albumId,
    })
    revalidatePath(`/studio/albums/${albumId}`)
    revalidatePath('/studio/albums')
  }
  return result
}

/**
 * Pause or resume a published album.
 *
 * The creator's own kill switch — a paused album leaves the catalogue
 * immediately without a review round trip. It only ever moves between `live`
 * and `paused`; anything re-entering the catalogue from another state has to
 * go through review again.
 */
export async function setAlbumVisibility(albumId: string, next: 'live' | 'paused'): Promise<Result> {
  const { user, album } = await ownedAlbum(albumId)
  if (!album) return { ok: false, message: t('studio.albumMissing') }
  if (album.status !== 'live' && album.status !== 'paused') {
    return { ok: false, message: t('state.error') }
  }

  await db.album.update({ where: { id: album.id }, data: { status: next } })
  await recordAudit({
    actorId: user.id,
    action: `album.${next === 'paused' ? 'pause' : 'resume'}`,
    entity: 'Album',
    entityId: album.id,
  })

  revalidatePath('/studio/albums')
  revalidatePath(`/studio/albums/${album.id}`)
  return { ok: true, message: t('actions.confirm') }
}

/**
 * Request a payout of the available balance.
 *
 * One open request at a time. Without that rule a creator could submit the
 * same balance twice before the first settles, because a `requested` payout
 * has not moved any money yet and so does not reduce the available figure.
 * The destination is snapshotted at approval, not here — bank details may
 * legitimately change while a request is queued.
 */
export async function requestPayout(): Promise<Result> {
  const user = await requireCreator()
  if (!user.creatorId) return { ok: false, message: t('state.forbidden') }

  const [creator, earnings, open] = await Promise.all([
    db.creator.findUnique({
      where: { id: user.creatorId },
      select: { payoutMethod: true, withholdingRate: true },
    }),
    getEarnings(user.creatorId),
    db.payout.findFirst({
      where: {
        creatorId: user.creatorId,
        status: { in: ['requested', 'approved', 'processing'] },
      },
      select: { id: true },
    }),
  ])

  if (!creator) return { ok: false, message: t('state.notFound') }
  if (open) return { ok: false, message: t('dash.payoutRequested') }
  if (earnings.available < MIN_PAYOUT_USD) {
    return { ok: false, message: t('dash.belowMinimum', { amount: MIN_PAYOUT_USD }) }
  }

  const amount = earnings.available
  const withholding = Number(creator.withholdingRate ?? 0) * amount

  await db.payout.create({
    data: {
      creatorId: user.creatorId,
      amount,
      method: creator.payoutMethod,
      withholdingAmount: withholding,
      netAmount: amount - withholding,
      status: 'requested',
    },
  })

  await recordAudit({
    actorId: user.id,
    action: 'payout.request',
    entity: 'Creator',
    entityId: user.creatorId,
    detail: { amount, withholding },
  })

  revalidatePath('/studio/payouts')
  revalidatePath('/studio/earnings')
  return { ok: true, message: t('dash.payoutRequested') }
}

/** ASCII slug from the English title, since the slug lives in a URL. */
function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

/**
 * Create a draft album.
 *
 * Price is never typed by the creator: it is read off the PriceBand for the
 * chosen tier, so the catalogue keeps one price per size of album and a
 * creator cannot undercut or inflate the band. Clips are added afterwards, and
 * the tier is re-derived from the real clip count before review.
 */
export async function createAlbum(_state: Result | null, formData: FormData): Promise<Result> {
  const user = await requireCreator()
  if (!user.creatorId) return { ok: false, message: t('state.forbidden') }

  const titleAr = String(formData.get('titleAr') ?? '').trim()
  const titleEn = String(formData.get('titleEn') ?? '').trim()
  const tier = String(formData.get('tier') ?? 'standard')

  if (!titleAr) return { ok: false, message: t('studio.titleArRequired') }
  if (!titleEn) return { ok: false, message: t('studio.titleEnRequired') }
  if (!['mini', 'standard', 'pro', 'signature'].includes(tier)) {
    return { ok: false, message: t('state.error') }
  }

  const band = await db.priceBand.findUnique({
    where: { tier: tier as 'mini' | 'standard' | 'pro' | 'signature' },
  })
  if (!band) return { ok: false, message: t('state.error') }

  const base = slugify(titleEn) || 'album'
  let slug = base
  for (let attempt = 2; await db.album.findUnique({ where: { slug }, select: { id: true } }); attempt++) {
    slug = `${base}-${attempt}`
  }

  const priceStandard = Number(band.priceStandard)
  const album = await db.album.create({
    data: {
      slug,
      creatorId: user.creatorId,
      titleAr,
      titleEn,
      descriptionAr: String(formData.get('descriptionAr') ?? '').trim() || null,
      descriptionEn: String(formData.get('descriptionEn') ?? '').trim() || null,
      tier: tier as 'mini' | 'standard' | 'pro' | 'signature',
      priceStandard,
      priceExtended: priceStandard * Number(band.extendedMultiplier),
      currency: band.currency,
      status: 'draft',
    },
    select: { id: true },
  })

  await recordAudit({
    actorId: user.id,
    action: 'album.create',
    entity: 'Album',
    entityId: album.id,
  })

  revalidatePath('/studio/albums')
  redirect(`/studio/albums/${album.id}`)
}

/**
 * Declare a release.
 *
 * The metadata is recorded now; the scanned document is attached once cloud
 * storage is switched on, which is why `fileKey` carries a `pending/` prefix
 * rather than a fake key. Verification stays `pending` regardless — only a
 * reviewer moves a release to `verified`, and that is the state the submission
 * gate actually reads.
 */
export async function createRelease(_state: Result | null, formData: FormData): Promise<Result> {
  const user = await requireCreator()
  if (!user.creatorId) return { ok: false, message: t('state.forbidden') }

  const type = String(formData.get('type') ?? 'model')
  if (!['model', 'property', 'permit'].includes(type)) {
    return { ok: false, message: t('state.error') }
  }

  const subjectName = String(formData.get('subjectName') ?? '').trim()
  if (!subjectName) return { ok: false, message: t('dash.releaseSubject') }

  const validFrom = String(formData.get('validFrom') ?? '')
  const validTo = String(formData.get('validTo') ?? '')

  const release = await db.release.create({
    data: {
      creatorId: user.creatorId,
      type: type as 'model' | 'property' | 'permit',
      fileKey: `pending/${user.creatorId}`,
      subjectName,
      authority: String(formData.get('authority') ?? '').trim() || null,
      referenceNumber: String(formData.get('referenceNumber') ?? '').trim() || null,
      validFrom: validFrom ? new Date(validFrom) : null,
      validTo: validTo ? new Date(validTo) : null,
      notes: String(formData.get('notes') ?? '').trim() || null,
      verification: 'pending',
    },
    select: { id: true },
  })

  await recordAudit({
    actorId: user.id,
    action: 'release.create',
    entity: 'Release',
    entityId: release.id,
    detail: { type },
  })

  revalidatePath('/studio/releases')
  return { ok: true, message: t('dash.saved') }
}

/**
 * Attach a release to clips.
 *
 * Replaces the whole link set rather than diffing it: the form posts the
 * complete selection, so a clip the creator unchecked has to lose its link or
 * an album would stay submittable on a release the creator believes they
 * removed. Both sides are ownership-checked — a release id and a clip id are
 * both guessable.
 */
export async function setReleaseClips(releaseId: string, clipIds: string[]): Promise<Result> {
  const user = await requireCreator()
  if (!user.creatorId) return { ok: false, message: t('state.forbidden') }

  const release = await db.release.findFirst({
    where: { id: releaseId, creatorId: user.creatorId },
    select: { id: true },
  })
  if (!release) return { ok: false, message: t('state.notFound') }

  const owned = await db.clip.findMany({
    where: { id: { in: clipIds }, album: { creatorId: user.creatorId } },
    select: { id: true },
  })

  await db.$transaction([
    db.releaseClip.deleteMany({ where: { releaseId } }),
    db.releaseClip.createMany({
      data: owned.map((clip) => ({ releaseId, clipId: clip.id })),
    }),
  ])

  await recordAudit({
    actorId: user.id,
    action: 'release.link_clips',
    entity: 'Release',
    entityId: releaseId,
    detail: { count: owned.length },
  })

  revalidatePath('/studio/releases')
  return { ok: true, message: t('dash.saved') }
}

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}$/

/** Public profile — what a buyer sees on the creator page. */
export async function updateProfile(_state: Result | null, formData: FormData): Promise<Result> {
  const user = await requireCreator()
  if (!user.creatorId) return { ok: false, message: t('state.forbidden') }

  const handle = String(formData.get('handle') ?? '')
    .trim()
    .toLowerCase()
  const displayNameAr = String(formData.get('displayNameAr') ?? '').trim()
  const displayNameEn = String(formData.get('displayNameEn') ?? '').trim()

  if (!displayNameAr || !displayNameEn) return { ok: false, message: t('dash.displayNameAr') }
  if (!HANDLE_PATTERN.test(handle)) return { ok: false, message: t('dash.handleHint') }

  const taken = await db.creator.findFirst({
    where: { handle, NOT: { id: user.creatorId } },
    select: { id: true },
  })
  if (taken) return { ok: false, message: t('dash.handleHint') }

  await db.creator.update({
    where: { id: user.creatorId },
    data: {
      handle,
      displayNameAr,
      displayNameEn,
      bioAr: String(formData.get('bioAr') ?? '').trim() || null,
      bioEn: String(formData.get('bioEn') ?? '').trim() || null,
      cityAr: String(formData.get('cityAr') ?? '').trim() || null,
      cityEn: String(formData.get('cityEn') ?? '').trim() || null,
      country:
        String(formData.get('country') ?? '')
          .trim()
          .toUpperCase() || 'SA',
      showreelUrl: String(formData.get('showreelUrl') ?? '').trim() || null,
    },
  })

  revalidatePath('/studio/settings')
  revalidatePath(`/creators/${handle}`)
  return { ok: true, message: t('dash.saved') }
}

/**
 * Payout rail.
 *
 * Editable at any time; what protects an in-flight transfer is that approval
 * freezes `destinationSnapshot` onto the Payout, not that this form is locked.
 */
export async function updatePayoutDetails(
  _state: Result | null,
  formData: FormData,
): Promise<Result> {
  const user = await requireCreator()
  if (!user.creatorId) return { ok: false, message: t('state.forbidden') }

  const method = String(formData.get('payoutMethod') ?? 'iban')
  if (!['iban', 'payoneer', 'wise'].includes(method)) {
    return { ok: false, message: t('state.error') }
  }

  const iban =
    String(formData.get('iban') ?? '')
      .replace(/\s+/g, '')
      .toUpperCase() || null
  const payoneerEmail = String(formData.get('payoneerEmail') ?? '').trim() || null
  const wiseEmail = String(formData.get('wiseEmail') ?? '').trim() || null

  // The chosen rail must actually be reachable, or the first payout run fails
  // inside an export file rather than here, where it can still be fixed.
  if (method === 'iban' && !iban) return { ok: false, message: t('dash.iban') }
  if (method === 'payoneer' && !payoneerEmail) return { ok: false, message: t('dash.payoneerEmail') }
  if (method === 'wise' && !wiseEmail) return { ok: false, message: t('dash.wiseEmail') }

  await db.creator.update({
    where: { id: user.creatorId },
    data: {
      payoutMethod: method as 'iban' | 'payoneer' | 'wise',
      iban,
      payoneerEmail,
      wiseEmail,
      bankName: String(formData.get('bankName') ?? '').trim() || null,
      beneficiaryName: String(formData.get('beneficiaryName') ?? '').trim() || null,
      taxResidency:
        String(formData.get('taxResidency') ?? '')
          .trim()
          .toUpperCase() || null,
    },
  })

  await recordAudit({
    actorId: user.id,
    action: 'creator.payout_details.update',
    entity: 'Creator',
    entityId: user.creatorId,
    detail: { method },
  })

  revalidatePath('/studio/settings')
  return { ok: true, message: t('dash.saved') }
}
