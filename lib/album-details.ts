import type { PermitsDeclaration, TaxonomyKind } from '@prisma/client'
import { db } from '@/lib/db'
import { pickLocalised } from '@/lib/locale'
import { loadPricingConfig } from '@/lib/pricing-config'
import {
  FOOTAGE_TYPES,
  QUALITIES,
  RESOLUTIONS,
  columnsToType,
  suggestPrice,
  typeToColumns,
  type Band,
  type PricingConfig,
  type FootageType,
  type Quality,
  type Resolution,
} from '@/lib/price-calculator'

/**
 * Album details — the form on `/studio/albums/[id]` and `/admin/review/[id]`
 * (DEV-08).
 *
 * ── Why it exists ───────────────────────────────────────────────────────────
 * An album reached review with nothing but a title: no category, no location,
 * no statement of whether it was generated or filmed, no word on permits. The
 * catalogue's filters (lib/search.ts) and seasonal shelves read exactly these
 * links, so an album without them was unfindable, and the reviewer had no
 * declaration to check the releases against.
 *
 * ── Shape ───────────────────────────────────────────────────────────────────
 * Footage type (→ origin + style), resolution, quality, the recommended price,
 * orientation and the permits statement are Album columns. Category,
 * locations, season and tags are `AlbumTaxonomy` rows. Time of day is a
 * subset of the `tag` taxonomy (golden hour, night…), shown as its own group
 * because that is how an editor searches. Saving replaces all four kinds.
 *
 * Submission (`lib/studio.canSubmit`) requires `detailsCompletedAt`, so origin
 * and orientation are a choice the creator made, never the schema default.
 */

/** Tags shown under «وقت التصوير» rather than «الأسلوب». */
export const TIME_OF_DAY_TAGS = ['sunrise', 'golden-hour', 'blue-hour', 'sunset', 'night'] as const

const EDITED_KINDS: TaxonomyKind[] = ['category', 'location', 'theme', 'tag']
const LIMITS = { location: 10, theme: 3, tag: 12 } as const

export type AlbumDetailsInput = {
  type: FootageType
  resolution: Resolution
  quality: Quality
  /** USD, inside the calculator's range for the album's clip count. */
  recommendedPrice: number
  recommendedNote: string | null
  orientation: 'landscape' | 'portrait'
  permitsDeclaration: PermitsDeclaration
  category: string
  locations: string[]
  themes: string[]
  tags: string[]
}

export type DetailsError =
  | 'studio.details.originRequired'
  | 'studio.details.orientationRequired'
  | 'studio.details.categoryRequired'
  | 'studio.details.locationRequired'
  | 'studio.details.permitsRequired'
  | 'studio.details.tooMany'
  | 'studio.details.resolutionRequired'
  | 'studio.details.qualityRequired'
  | 'studio.details.priceRequired'
  | 'studio.details.priceOutOfRange'

export function parseAlbumDetailsForm(
  formData: FormData,
): { ok: true; input: AlbumDetailsInput } | { ok: false; error: DetailsError } {
  const one = (name: string) => String(formData.get(name) ?? '').trim()
  const many = (name: string) =>
    [...new Set(formData.getAll(name).map((value) => String(value).trim()).filter(Boolean))]

  const type = one('type')
  if (!(FOOTAGE_TYPES as readonly string[]).includes(type)) return { ok: false, error: 'studio.details.originRequired' }
  const resolution = one('resolution')
  if (!(RESOLUTIONS as readonly string[]).includes(resolution)) return { ok: false, error: 'studio.details.resolutionRequired' }
  const quality = one('quality')
  if (!(QUALITIES as readonly string[]).includes(quality)) return { ok: false, error: 'studio.details.qualityRequired' }
  const recommendedPrice = Number(one('recommendedPrice'))
  if (!one('recommendedPrice') || !Number.isFinite(recommendedPrice)) {
    return { ok: false, error: 'studio.details.priceRequired' }
  }
  const recommendedNote = one('recommendedNote').slice(0, 500) || null
  const orientation = one('orientation')
  // No `mixed`: verticals come as their own albums (decision D6).
  if (orientation !== 'landscape' && orientation !== 'portrait') {
    return { ok: false, error: 'studio.details.orientationRequired' }
  }
  const category = one('category')
  if (!category) return { ok: false, error: 'studio.details.categoryRequired' }
  const locations = many('locations')
  if (locations.length === 0) return { ok: false, error: 'studio.details.locationRequired' }
  const permits = one('permitsDeclaration')
  if (permits !== 'none_needed' && permits !== 'attached') {
    return { ok: false, error: 'studio.details.permitsRequired' }
  }
  const themes = many('themes')
  const tags = many('tags')
  if (locations.length > LIMITS.location || themes.length > LIMITS.theme || tags.length > LIMITS.tag) {
    return { ok: false, error: 'studio.details.tooMany' }
  }
  return {
    ok: true,
    input: {
      type: type as FootageType,
      resolution: resolution as Resolution,
      quality: quality as Quality,
      recommendedPrice,
      recommendedNote,
      orientation,
      permitsDeclaration: permits,
      category,
      locations,
      themes,
      tags,
    },
  }
}

/**
 * Write the details. Slugs are resolved against ACTIVE taxonomy of the right
 * kind only — a forged slug, or one from another kind, is dropped, and a
 * category or location that resolves to nothing is refused.
 */
export async function saveAlbumDetails(
  albumId: string,
  input: AlbumDetailsInput,
): Promise<{ ok: true } | { ok: false; error: DetailsError }> {
  // The recommendation must sit inside the calculator's range for the album
  // as it stands — the same arithmetic the form showed.
  const [album, bands, proposal, config] = await Promise.all([
    db.album.findUnique({ where: { id: albumId }, select: { clipCount: true } }),
    loadBands(),
    latestProposal(albumId),
    loadPricingConfig(),
  ])
  const range = suggestPrice({
    clipCount: album?.clipCount ?? 0,
    resolution: input.resolution,
    type: input.type,
    quality: input.quality,
    bands,
    config,
  })
  const acceptsProposal = proposal !== null && input.recommendedPrice === proposal
  if (!acceptsProposal && (!range || input.recommendedPrice < range.low || input.recommendedPrice > range.high)) {
    return { ok: false, error: 'studio.details.priceOutOfRange' }
  }

  const wanted: Array<[TaxonomyKind, string[]]> = [
    ['category', [input.category]],
    ['location', input.locations],
    ['theme', input.themes],
    ['tag', input.tags],
  ]
  const rows = await db.taxonomy.findMany({
    where: {
      isActive: true,
      OR: wanted.map(([kind, slugs]) => ({ kind, slug: { in: slugs } })),
    },
    select: { id: true, kind: true },
  })
  if (!rows.some((row) => row.kind === 'category')) return { ok: false, error: 'studio.details.categoryRequired' }
  if (!rows.some((row) => row.kind === 'location')) return { ok: false, error: 'studio.details.locationRequired' }

  await db.$transaction([
    db.album.update({
      where: { id: albumId },
      data: {
        ...typeToColumns(input.type),
        resolution: input.resolution,
        qualityLevel: input.quality,
        recommendedPrice: input.recommendedPrice,
        recommendedNote: input.recommendedNote,
        orientation: input.orientation,
        permitsDeclaration: input.permitsDeclaration,
        detailsCompletedAt: new Date(),
      },
    }),
    db.albumTaxonomy.deleteMany({ where: { albumId, taxonomy: { kind: { in: EDITED_KINDS } } } }),
    db.albumTaxonomy.createMany({
      data: rows.map((row) => ({ albumId, taxonomyId: row.id })),
      skipDuplicates: true,
    }),
  ])
  return { ok: true }
}

export type DetailsOption = { slug: string; name: string }

/**
 * The owner's counter-price from the latest review round, if that round asked
 * for changes and carried one (DEV-09b). A recommendation EQUAL to it is valid
 * even outside the calculator's range: it is the price the owner proposed.
 */
export async function latestProposal(albumId: string): Promise<number | null> {
  return (await latestProposalRound(albumId))?.price ?? null
}

async function latestProposalRound(albumId: string) {
  const task = await db.reviewTask.findFirst({
    where: { albumId, decidedAt: { not: null } },
    orderBy: { decidedAt: 'desc' },
    select: { decision: true, proposedPrice: true, decidedAt: true },
  })
  return task?.decision === 'request_changes' && task.proposedPrice !== null
    ? { price: Number(task.proposedPrice), at: task.decidedAt! }
    : null
}

/** The price bands as the calculator reads them. */
export async function loadBands(): Promise<Band[]> {
  const rows = await db.priceBand.findMany({ select: { minClips: true, maxClips: true, priceStandard: true } })
  return rows.map((row) => ({ ...row, priceStandard: Number(row.priceStandard) }))
}

export type AlbumDetailsView = {
  clipCount: number
  /** The owner's live pricing parameters, for the client-side calculator. */
  config: PricingConfig
  /** The owner's counter-price from the last round, if any (DEV-09b). */
  proposal: number | null
  bands: Band[]
  options: {
    category: DetailsOption[]
    location: DetailsOption[]
    theme: DetailsOption[]
    timeOfDay: DetailsOption[]
    tag: DetailsOption[]
  }
  current: {
    type: FootageType | null
    resolution: Resolution | null
    quality: Quality | null
    recommendedPrice: number | null
    recommendedNote: string | null
    orientation: 'landscape' | 'portrait' | null
    permitsDeclaration: PermitsDeclaration | null
    category: string | null
    locations: string[]
    themes: string[]
    tags: string[]
  }
}

/**
 * Everything the form renders, names already in the reader's language — the
 * form is a client component and cannot call `pickLocalised` against the
 * request's locale itself.
 */
export async function loadAlbumDetails(albumId: string): Promise<AlbumDetailsView | null> {
  const [album, taxonomy, bands, round, config] = await Promise.all([
    db.album.findUnique({
      where: { id: albumId },
      select: {
        clipCount: true,
        footageStyle: true,
        resolution: true,
        qualityLevel: true,
        recommendedPrice: true,
        recommendedNote: true,
        origin: true,
        orientation: true,
        permitsDeclaration: true,
        detailsCompletedAt: true,
        taxonomy: { select: { taxonomy: { select: { kind: true, slug: true } } } },
      },
    }),
    db.taxonomy.findMany({
      where: { isActive: true, kind: { in: EDITED_KINDS } },
      select: { kind: true, slug: true, nameAr: true, nameEn: true },
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
    }),
    loadBands(),
    latestProposalRound(albumId),
    loadPricingConfig(),
  ])
  if (!album) return null
  const proposal = round?.price ?? null
  // The proposal pre-fills the field until the creator saves again after it.
  const savedSinceProposal =
    round !== null && album.detailsCompletedAt !== null && album.detailsCompletedAt > round.at

  const option = (row: { slug: string; nameAr: string; nameEn: string }) => ({
    slug: row.slug,
    name: pickLocalised(row.nameAr, row.nameEn),
  })
  const of = (kind: TaxonomyKind) => taxonomy.filter((row) => row.kind === kind)
  const isTime = (slug: string) => (TIME_OF_DAY_TAGS as readonly string[]).includes(slug)
  const linked = (kind: TaxonomyKind) =>
    album.taxonomy.filter((link) => link.taxonomy.kind === kind).map((link) => link.taxonomy.slug)

  // Before the form was ever saved, origin/orientation are schema defaults,
  // not the creator's answer — show them unchosen.
  const saved = album.detailsCompletedAt !== null
  return {
    clipCount: album.clipCount,
    config,
    bands,
    proposal,
    options: {
      category: of('category').map(option),
      location: of('location').map(option),
      theme: of('theme').map(option),
      timeOfDay: of('tag').filter((row) => isTime(row.slug)).map(option),
      tag: of('tag').filter((row) => !isTime(row.slug)).map(option),
    },
    current: {
      type: saved ? columnsToType(album.origin, album.footageStyle) : null,
      resolution: album.resolution,
      quality: album.qualityLevel,
      // A pending proposal pre-fills the field: accepting it is one click.
      recommendedPrice:
        proposal !== null && !savedSinceProposal
          ? proposal
          : album.recommendedPrice === null
            ? null
            : Number(album.recommendedPrice),
      recommendedNote: album.recommendedNote,
      orientation: saved && album.orientation !== 'mixed' ? album.orientation : null,
      permitsDeclaration: album.permitsDeclaration,
      category: linked('category')[0] ?? null,
      locations: linked('location'),
      themes: linked('theme'),
      tags: linked('tag'),
    },
  }
}
