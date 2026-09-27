'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireCreator } from '@/lib/auth'
import { db } from '@/lib/db'
import { currentLicenceId } from '@/lib/licence'
import { getEarnings, submitForReview, MIN_PAYOUT_USD } from '@/lib/studio'
import { recordAudit } from '@/lib/audit'
import { actionT, requestLocale } from '@/lib/locale-request'
import { countIn } from '@/lib/i18n'
import { destroyClip, editableAlbum, editableClip, renumberClips } from '@/lib/uploads'
import { parseAlbumDetailsForm, saveAlbumDetails } from '@/lib/album-details'

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

/**
 * Save the album details form (DEV-08). Only while the album is editable —
 * an album in review is frozen for the creator (an admin corrects it from the
 * review page instead, `adminSaveAlbumDetails`).
 */
export async function saveAlbumDetailsAction(
  albumId: string,
  _state: Result | null,
  formData: FormData,
): Promise<Result> {
  const tr = await actionT()
  const user = await requireCreator()
  const { error } = await editableAlbum(user, albumId)
  if (error === 'not_found') return { ok: false, message: tr('state.notFound') }
  if (error === 'not_editable') return { ok: false, message: tr('studio.upload.frozen') }

  const parsed = parseAlbumDetailsForm(formData)
  if (!parsed.ok) return { ok: false, message: tr(parsed.error) }
  const saved = await saveAlbumDetails(albumId, parsed.input)
  if (!saved.ok) return { ok: false, message: tr(saved.error) }

  await recordAudit({
    actorId: user.id,
    action: 'album.details',
    entity: 'Album',
    entityId: albumId,
    detail: parsed.input,
  })
  revalidatePath(`/studio/albums/${albumId}`)
  return { ok: true, message: tr('studio.details.saved') }
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
export async function setAlbumVisibility(
  albumId: string,
  next: 'live' | 'paused',
): Promise<Result> {
  const tr = await actionT()
  const { user, album } = await ownedAlbum(albumId)
  if (!album) return { ok: false, message: tr('studio.albumMissing') }
  if (album.status !== 'live' && album.status !== 'paused') {
    return { ok: false, message: tr('state.error') }
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
  return { ok: true, message: tr('actions.confirm') }
}

/**
 * ── Clip management ─────────────────────────────────────────────────────────
 * Titles, order, cover and delete — every one re-checks, through
 * `editableClip` / `editableAlbum`, that the caller owns the album and that it
 * is still `draft` or `changes_requested`. An album in review is frozen: the
 * reviewer must decide on what was submitted, not on what it became since.
 */
async function clipRefusal(error: string | null) {
  const tr = await actionT()
  if (error === 'not_editable') return { ok: false, message: tr('studio.upload.frozen') }
  return { ok: false, message: tr('state.notFound') }
}

/** Rename a clip, both languages at once. */
export async function updateClipTitles(clipId: string, formData: FormData): Promise<Result> {
  const tr = await actionT()
  const user = await requireCreator()
  const { error, clip } = await editableClip(user, clipId)
  if (error || !clip) return clipRefusal(error)

  const titleAr = String(formData.get('titleAr') ?? '').trim().slice(0, 160)
  const titleEn = String(formData.get('titleEn') ?? '').trim().slice(0, 160)
  if (!titleAr) return { ok: false, message: tr('studio.titleArRequired') }
  if (!titleEn) return { ok: false, message: tr('studio.titleEnRequired') }

  await db.clip.update({ where: { id: clip.id }, data: { titleAr, titleEn } })
  await recordAudit({ actorId: user.id, action: 'clip.rename', entity: 'Clip', entityId: clip.id })
  revalidatePath(`/studio/albums/${clip.albumId}`)
  return { ok: true, message: tr('dash.saved') }
}

/**
 * Whether a clip shows people, and whether their faces are identifiable
 * (DEV-10). The creator is the one who knows; nothing else set these, so the
 * model-release gate never fired and the release linker had nothing to show.
 * The two stay consistent: clear faces imply people; no people means no faces.
 */
export async function setClipPeople(
  clipId: string,
  field: 'hasPeople' | 'identifiableFaces',
  value: boolean,
): Promise<Result> {
  const tr = await actionT()
  const user = await requireCreator()
  const { error, clip } = await editableClip(user, clipId)
  if (error || !clip) return clipRefusal(error)
  if (field !== 'hasPeople' && field !== 'identifiableFaces') return { ok: false, message: tr('state.error') }

  const data =
    field === 'identifiableFaces'
      ? { identifiableFaces: value, ...(value ? { hasPeople: true } : {}) }
      : { hasPeople: value, ...(value ? {} : { identifiableFaces: false }) }

  await db.clip.update({ where: { id: clip.id }, data })
  await recordAudit({ actorId: user.id, action: 'clip.people', entity: 'Clip', entityId: clip.id, detail: data })
  revalidatePath(`/studio/albums/${clip.albumId}`)
  revalidatePath('/studio/releases')
  return { ok: true, message: tr('dash.saved') }
}

/**
 * Rename many clips at once (DEV-12). Every clip starts titled after its file
 * name («DJI_0042»), and renaming fifty one row at a time is where creators
 * gave up. One transaction: either every title saves or none does, so the
 * list the creator sees after saving is exactly what they typed.
 */
export async function updateClipTitlesBulk(
  albumId: string,
  rows: Array<{ id: string; titleAr: string; titleEn: string }>,
): Promise<Result & { invalid?: string[] }> {
  const tr = await actionT()
  const user = await requireCreator()
  const { error } = await editableAlbum(user, albumId)
  if (error) return clipRefusal(error)
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 200) return { ok: false, message: tr('state.error') }

  const clean = rows.map((row) => ({
    id: String(row?.id ?? ''),
    titleAr: String(row?.titleAr ?? '').trim().slice(0, 160),
    titleEn: String(row?.titleEn ?? '').trim().slice(0, 160),
  }))
  const invalid = clean.filter((row) => !row.titleAr || !row.titleEn).map((row) => row.id)
  if (invalid.length > 0) return { ok: false, message: tr('studio.upload.bulkMissing'), invalid }

  // Only this album's clips — ids in the payload are guessable.
  const owned = await db.clip.findMany({
    where: { id: { in: clean.map((row) => row.id) }, albumId },
    select: { id: true, titleAr: true, titleEn: true },
  })
  const current = new Map(owned.map((clip) => [clip.id, clip]))
  const changed = clean.filter((row) => {
    const was = current.get(row.id)
    return was && (was.titleAr !== row.titleAr || was.titleEn !== row.titleEn)
  })
  if (changed.length === 0) return { ok: true, message: tr('studio.upload.bulkNothing') }

  await db.$transaction(
    changed.map((row) => db.clip.update({ where: { id: row.id }, data: { titleAr: row.titleAr, titleEn: row.titleEn } })),
  )
  await recordAudit({ actorId: user.id, action: 'clip.rename_bulk', entity: 'Album', entityId: albumId, detail: { count: changed.length } })
  revalidatePath(`/studio/albums/${albumId}`)
  const locale = await requestLocale()
  return { ok: true, message: tr('studio.upload.bulkSaved', { count: countIn(locale, 'clip', changed.length) }) }
}

/** Swap a clip with its neighbour. Order is what the album page and the ZIP follow. */
export async function moveClip(clipId: string, direction: 'up' | 'down'): Promise<Result> {
  const tr = await actionT()
  const user = await requireCreator()
  const { error, clip } = await editableClip(user, clipId)
  if (error || !clip) return clipRefusal(error)

  await renumberClips(clip.albumId)
  const siblings = await db.clip.findMany({
    where: { albumId: clip.albumId },
    orderBy: { orderIndex: 'asc' },
    select: { id: true, orderIndex: true },
  })
  const at = siblings.findIndex((row) => row.id === clip.id)
  const to = direction === 'up' ? at - 1 : at + 1
  if (at < 0 || to < 0 || to >= siblings.length) return { ok: true }

  await db.$transaction([
    db.clip.update({ where: { id: siblings[at].id }, data: { orderIndex: siblings[to].orderIndex } }),
    db.clip.update({ where: { id: siblings[to].id }, data: { orderIndex: siblings[at].orderIndex } }),
  ])
  revalidatePath(`/studio/albums/${clip.albumId}`)
  return { ok: true, message: tr('dash.saved') }
}

/** The album's cover — only a READY clip, because the cover is its poster. */
export async function setAlbumCover(clipId: string): Promise<Result> {
  const tr = await actionT()
  const user = await requireCreator()
  const { error, clip } = await editableClip(user, clipId)
  if (error || !clip) return clipRefusal(error)
  if (clip.ingestStatus !== 'ready') return { ok: false, message: tr('studio.upload.coverNotReady') }

  await db.album.update({ where: { id: clip.albumId }, data: { coverClipId: clip.id } })
  await recordAudit({ actorId: user.id, action: 'album.set_cover', entity: 'Album', entityId: clip.albumId })
  revalidatePath(`/studio/albums/${clip.albumId}`)
  return { ok: true, message: tr('studio.upload.coverSet') }
}

/** Delete a clip and, best effort, its master, preview and poster. */
export async function deleteClip(clipId: string): Promise<Result> {
  const tr = await actionT()
  const user = await requireCreator()
  const { error, clip } = await editableClip(user, clipId)
  if (error || !clip) return clipRefusal(error)

  const result = await destroyClip(clip)
  if (result === 'sold') return { ok: false, message: tr('studio.upload.sold') }
  await recordAudit({ actorId: user.id, action: 'clip.delete', entity: 'Clip', entityId: clip.id })
  revalidatePath(`/studio/albums/${clip.albumId}`)
  revalidatePath('/studio/albums')
  return { ok: true, message: tr('studio.upload.deleted') }
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
  const tr = await actionT()
  const user = await requireCreator()
  if (!user.creatorId) return { ok: false, message: tr('state.forbidden') }

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

  if (!creator) return { ok: false, message: tr('state.notFound') }
  if (open) return { ok: false, message: tr('dash.payoutRequested') }
  if (earnings.available < MIN_PAYOUT_USD) {
    return { ok: false, message: tr('dash.belowMinimum', { amount: MIN_PAYOUT_USD }) }
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
  return { ok: true, message: tr('dash.payoutRequested') }
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
 * No price and no band: the album is created UNPRICED (`priceStandard = 0`)
 * and the operator sets the price at approval, $49–$249, with the band for
 * its clip count as the suggestion (DEV-09, lib/price-bands.ts). Checkout
 * refuses an unpriced album, so a draft can never sell at zero.
 */
export async function createAlbum(_state: Result | null, formData: FormData): Promise<Result> {
  const tr = await actionT()
  const user = await requireCreator()
  if (!user.creatorId) return { ok: false, message: tr('state.forbidden') }

  const titleAr = String(formData.get('titleAr') ?? '').trim()
  const titleEn = String(formData.get('titleEn') ?? '').trim()

  if (!titleAr) return { ok: false, message: tr('studio.titleArRequired') }
  if (!titleEn) return { ok: false, message: tr('studio.titleEnRequired') }

  const base = slugify(titleEn) || 'album'
  let slug = base
  for (
    let attempt = 2;
    await db.album.findUnique({ where: { slug }, select: { id: true } });
    attempt++
  ) {
    slug = `${base}-${attempt}`
  }

  // Every album carries the licence it will be sold under from its first
  // moment — a draft with none once reached checkout and sold blank (DEV-06).
  const licenceVersionId = await currentLicenceId()
  const album = await db.album.create({
    data: {
      slug,
      creatorId: user.creatorId,
      titleAr,
      titleEn,
      descriptionAr: String(formData.get('descriptionAr') ?? '').trim() || null,
      descriptionEn: String(formData.get('descriptionEn') ?? '').trim() || null,
      // Unpriced until approval; the tier is set from the clip count then.
      priceStandard: 0,
      currency: 'USD',
      status: 'draft',
      licenceVersionId,
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
 * The metadata is recorded here; the scanned document is attached afterwards
 * from the release's card (`/api/studio/releases/<id>/document` — a server
 * action body is capped at 1 MB, a scan is not). Until then `fileKey` carries
 * the `pending/` prefix rather than a fake key. Verification stays `pending`
 * regardless — only a reviewer moves a release to `verified`, and that is the
 * state the submission gate actually reads.
 */
export async function createRelease(_state: Result | null, formData: FormData): Promise<Result> {
  const tr = await actionT()
  const user = await requireCreator()
  if (!user.creatorId) return { ok: false, message: tr('state.forbidden') }

  const type = String(formData.get('type') ?? 'model')
  if (!['model', 'property', 'permit'].includes(type)) {
    return { ok: false, message: tr('state.error') }
  }

  const subjectName = String(formData.get('subjectName') ?? '').trim()
  if (!subjectName) return { ok: false, message: tr('dash.releaseSubject') }

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
  return { ok: true, message: tr('dash.saved') }
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
  const tr = await actionT()
  const user = await requireCreator()
  if (!user.creatorId) return { ok: false, message: tr('state.forbidden') }

  const release = await db.release.findFirst({
    where: { id: releaseId, creatorId: user.creatorId },
    select: { id: true },
  })
  if (!release) return { ok: false, message: tr('state.notFound') }

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
  return { ok: true, message: tr('dash.saved') }
}

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}$/

/** Public profile — what a buyer sees on the creator page. */
export async function updateProfile(_state: Result | null, formData: FormData): Promise<Result> {
  const tr = await actionT()
  const user = await requireCreator()
  if (!user.creatorId) return { ok: false, message: tr('state.forbidden') }

  const handle = String(formData.get('handle') ?? '')
    .trim()
    .toLowerCase()
  const displayNameAr = String(formData.get('displayNameAr') ?? '').trim()
  const displayNameEn = String(formData.get('displayNameEn') ?? '').trim()

  if (!displayNameAr || !displayNameEn) return { ok: false, message: tr('dash.displayNameAr') }
  if (!HANDLE_PATTERN.test(handle)) return { ok: false, message: tr('dash.handleHint') }

  const taken = await db.creator.findFirst({
    where: { handle, NOT: { id: user.creatorId } },
    select: { id: true },
  })
  if (taken) return { ok: false, message: tr('dash.handleHint') }

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
  return { ok: true, message: tr('dash.saved') }
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
  const tr = await actionT()
  const user = await requireCreator()
  if (!user.creatorId) return { ok: false, message: tr('state.forbidden') }

  const method = String(formData.get('payoutMethod') ?? 'iban')
  if (!['iban', 'payoneer', 'wise'].includes(method)) {
    return { ok: false, message: tr('state.error') }
  }

  const iban =
    String(formData.get('iban') ?? '')
      .replace(/\s+/g, '')
      .toUpperCase() || null
  const payoneerEmail = String(formData.get('payoneerEmail') ?? '').trim() || null
  const wiseEmail = String(formData.get('wiseEmail') ?? '').trim() || null

  // The chosen rail must actually be reachable, or the first payout run fails
  // inside an export file rather than here, where it can still be fixed.
  if (method === 'iban' && !iban) return { ok: false, message: tr('dash.iban') }
  if (method === 'payoneer' && !payoneerEmail)
    return { ok: false, message: tr('dash.payoneerEmail') }
  if (method === 'wise' && !wiseEmail) return { ok: false, message: tr('dash.wiseEmail') }

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
  return { ok: true, message: tr('dash.saved') }
}
