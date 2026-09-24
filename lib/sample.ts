import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

/**
 * The free sample album — owner decision 2026-09-24.
 *
 * Signed-in users only, one claim each, made of clips the operator picks from
 * live albums. Which clips go in is the owner's call and has not been made, so
 * every reader here treats "no sample yet", "not published" and "no clips" as
 * the same ordinary state: nothing is shown, nothing breaks.
 *
 * ── The shape ───────────────────────────────────────────────────────────────
 * A house `Creator` (the platform itself, `isHouse`) owns one house `Album`,
 * which a `SampleAlbum` row marks as the sample. Chosen clips are `SampleClip`
 * rows pointing at clips that stay in their own albums. The house album's
 * `status` is held at `draft` for life, so every `status: 'live'` query in the
 * codebase — listings, search, the sitemap, the cart — leaves it out without
 * having to know it exists. Publication is `SampleAlbum.isPublished`.
 *
 * Claiming lives in `lib/orders.ts#claimSample`, beside `checkout`, because it
 * takes the same two frozen snapshots and must never drift from them.
 */

export const HOUSE_HANDLE = 'laqta-house'
const HOUSE_EMAIL = 'house@laqta.invalid'
export const SAMPLE_SLUG = 'laqta-free-sample'

/** What a sample clip carries into a claimant's manifest, beyond the usual. */
export type SampleManifestClip = {
  id: string
  slug: string
  titleAr: string
  titleEn: string
  masterKey: string | null
  proxyKey: string | null
  /** The album the clip is sold in — the whole point is sample → purchase. */
  sourceAlbum: {
    id: string
    slug: string
    titleAr: string
    titleEn: string
    creatorHandle: string
  }
}

const clipSelect = {
  id: true,
  slug: true,
  titleAr: true,
  titleEn: true,
  durationS: true,
  width: true,
  height: true,
  thumbnailKeys: true,
  previewKey: true,
  album: {
    select: {
      id: true,
      slug: true,
      titleAr: true,
      titleEn: true,
      status: true,
      priceStandard: true,
      currency: true,
      clipCount: true,
      creator: { select: { handle: true, displayNameAr: true, displayNameEn: true } },
    },
  },
} satisfies Prisma.ClipSelect

/**
 * The sample as the operator sees it: every chosen clip, including ones whose
 * album has since stopped being live (flagged, never silently dropped).
 */
export async function getSampleForAdmin() {
  return db.sampleAlbum.findFirst({
    orderBy: { createdAt: 'asc' },
    include: {
      album: {
        select: {
          id: true,
          titleAr: true,
          titleEn: true,
          descriptionAr: true,
          descriptionEn: true,
          coverClipId: true,
          salesCount: true,
        },
      },
      clips: {
        orderBy: [{ orderIndex: 'asc' }, { addedAt: 'asc' }],
        include: { clip: { select: clipSelect } },
      },
    },
  })
}

/**
 * The sample as the public sees it, or `null`.
 *
 * Null when there is no sample, it is unpublished, or none of its clips sits
 * in a live album — the three are one state to a visitor. `includeDraft` lets
 * an admin preview an unpublished sample on the public page.
 *
 * Only clips whose own album is LIVE are offered: a clip from an album that
 * was delisted over a dispute must not keep being given away from here.
 */
export async function getPublicSample({ includeDraft = false } = {}) {
  const sample = await getSampleForAdmin()
  if (!sample) return null
  if (!sample.isPublished && !includeDraft) return null

  const clips = sample.clips.map((row) => row.clip).filter((clip) => clip.album.status === 'live')
  if (clips.length === 0) return null

  const cover = clips.find((clip) => clip.id === sample.album.coverClipId) ?? clips[0] ?? null

  return {
    id: sample.id,
    albumId: sample.album.id,
    isPublished: sample.isPublished,
    titleAr: sample.album.titleAr,
    titleEn: sample.album.titleEn,
    descriptionAr: sample.album.descriptionAr,
    descriptionEn: sample.album.descriptionEn,
    coverKey: cover?.thumbnailKeys[0] ?? null,
    albumCount: new Set(clips.map((clip) => clip.album.id)).size,
    clips,
  }
}

export type PublicSample = NonNullable<Awaited<ReturnType<typeof getPublicSample>>>

/** Has this user already claimed the sample? Returns the entitlement id. */
export async function sampleEntitlementFor(userId: string, albumId: string) {
  const row = await db.entitlement.findUnique({
    where: { userId_albumId: { userId, albumId } },
    select: { id: true, revokedAt: true },
  })
  return row
}

/**
 * The manifest a claim freezes: the chosen clips in live albums, in order,
 * with the master and proxy keys the library downloads and the source album a
 * claimant is sent back to.
 */
export async function sampleManifest(sampleId: string): Promise<SampleManifestClip[]> {
  const rows = await db.sampleClip.findMany({
    where: { sampleId, clip: { album: { status: 'live' } } },
    orderBy: [{ orderIndex: 'asc' }, { addedAt: 'asc' }],
    select: {
      clip: {
        select: {
          id: true,
          slug: true,
          titleAr: true,
          titleEn: true,
          masterKey: true,
          proxyKey: true,
          album: {
            select: {
              id: true,
              slug: true,
              titleAr: true,
              titleEn: true,
              creator: { select: { handle: true } },
            },
          },
        },
      },
    },
  })

  return rows.map(({ clip }) => ({
    id: clip.id,
    slug: clip.slug,
    titleAr: clip.titleAr,
    titleEn: clip.titleEn,
    masterKey: clip.masterKey,
    proxyKey: clip.proxyKey,
    sourceAlbum: {
      id: clip.album.id,
      slug: clip.album.slug,
      titleAr: clip.album.titleAr,
      titleEn: clip.album.titleEn,
      creatorHandle: clip.album.creator.handle,
    },
  }))
}

/**
 * Create the house creator, the house album and the sample row, once.
 *
 * Called by the admin curation actions only — a page render never writes.
 * Idempotent: every step is an upsert on a unique key, so two operators saving
 * at once end with one sample.
 */
export async function ensureSample() {
  const existing = await db.sampleAlbum.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, albumId: true },
  })
  if (existing) return existing

  const user = await db.user.upsert({
    where: { email: HOUSE_EMAIL },
    update: {},
    // No password, no phone: this account cannot sign in. It exists because a
    // Creator must belong to a User.
    create: { email: HOUSE_EMAIL, name: 'Laqta', role: 'buyer', status: 'active' },
    select: { id: true },
  })

  const creator = await db.creator.upsert({
    where: { handle: HOUSE_HANDLE },
    update: {},
    create: {
      userId: user.id,
      handle: HOUSE_HANDLE,
      displayNameAr: 'لقطة',
      displayNameEn: 'Laqta',
      // Suspended, so every public creator query (all filter `approved`)
      // leaves the platform's own account out. See `Creator.isHouse`.
      status: 'suspended',
      isHouse: true,
      notes: 'House account for the free sample album. Not a seller.',
    },
    select: { id: true },
  })

  const current = await db.licenceVersion.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  })

  const album = await db.album.upsert({
    where: { slug: SAMPLE_SLUG },
    update: {},
    create: {
      slug: SAMPLE_SLUG,
      creatorId: creator.id,
      titleAr: 'عيّنة لقطة المجانية',
      titleEn: 'The Laqta free sample',
      // Draft for life — see the note at the top of this file.
      status: 'draft',
      priceStandard: 0,
      origin: 'generated',
      licenceVersionId: current?.id ?? null,
    },
    select: { id: true },
  })

  return db.sampleAlbum.upsert({
    where: { albumId: album.id },
    update: {},
    create: { albumId: album.id },
    select: { id: true, albumId: true },
  })
}
