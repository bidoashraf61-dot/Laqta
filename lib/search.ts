import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { normaliseArabic } from '@/lib/i18n'

/**
 * Catalogue search.
 *
 * ── Why this is not just `WHERE title ILIKE '%q%'` ──────────────────────────
 * Arabic search is not English search in a different font:
 *
 *   · Diacritics and tatweel are optional in writing — أَحْمَد, احمد and
 *     محـــمد are the same word to a reader and different bytes to Postgres.
 *   · The hamza family, teh marbuta and alef maqsura vary by writer, not by
 *     meaning: جدة / جده, العلا / العلى.
 *   · The catalogue is bilingual and buyers are not. Someone typing "AlUla"
 *     must find footage tagged العلا, and vice versa.
 *
 * The first two are handled by `normaliseArabic`, applied identically to the
 * query and to the indexed text. The third is handled by the taxonomy: every
 * location and category carries `synonymsAr` and `synonymsEn` (seeded with
 * transliterations), so a query is first resolved against taxonomy names and
 * synonyms, and any matching taxonomy ids are then searched as tags. That is
 * what makes the cross-language hop work without a translation service.
 *
 * ── Driver boundary ─────────────────────────────────────────────────────────
 * `search()` is the only thing callers touch. Today it runs on Postgres, which
 * is honest for launch scale. Meilisearch is the intended engine — when it is
 * provisioned, implement `SearchDriver` against it and switch `driver` below.
 * Nothing in the route layer changes.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type ClipFilters = {
  q?: string
  /** Taxonomy slugs. */
  location?: string
  category?: string
  tags?: string[]
  minWidth?: number
  aspectRatio?: string
  colourProfile?: string
  cameraMovement?: string
  shotSize?: string
  timeOfDay?: string
  season?: string
  /**
   * Duration window in seconds. An editor cutting a 6-second social bumper and
   * one looking for a 30-second establishing hold are doing different jobs;
   * every competitor exposes this and it was the largest gap in the rail.
   */
  minDurationS?: number
  maxDurationS?: number
  fps?: number
  hasPeople?: boolean
  /**
   * How the footage was made. The one facet buyers now filter on hardest,
   * because a brand may have to disclose synthetic media and an agency
   * briefing "real Saudi locations" is making a factual claim.
   */
  origin?: 'captured' | 'generated'
  minPrice?: number
  maxPrice?: number
  creator?: string
  sort?: 'relevance' | 'newest' | 'popular' | 'priceAsc' | 'priceDesc'
  page?: number
  perPage?: number
}

export type ClipHit = {
  id: string
  slug: string
  titleAr: string
  titleEn: string
  durationS: number
  width: number
  height: number
  fps: number
  aspectRatio: string | null
  thumbnail: string | null
  previewHlsKey: string | null
  /**
   * KEY of the watermarked MP4 preview, for hover-to-play; the tile resolves
   * it through `lib/media.ts#mediaUrl`. Distinct from
   * `previewHlsKey`: that is an HLS manifest for the full player, this is the
   * short MP4 loop a grid tile can drop into a <video> with no player at all.
   */
  previewKey: string | null
  /** The album ribbon. Never render a clip without it. */
  album: {
    slug: string
    titleAr: string
    titleEn: string
    priceStandard: number
    currency: string
    clipCount: number
    origin: 'captured' | 'generated'
    creatorHandle: string
    creatorNameAr: string
  }
}

export type SearchResult = {
  hits: ClipHit[]
  total: number
  page: number
  perPage: number
  /** Which taxonomy entries the query itself resolved to, for "did you mean". */
  matchedTaxonomy: Array<{ kind: string; slug: string; nameAr: string }>
}

interface SearchDriver {
  search(filters: ClipFilters): Promise<SearchResult>
}

// ── Query → taxonomy ─────────────────────────────────────────────────────────

/**
 * Resolve a free-text query against taxonomy names and synonyms.
 *
 * This is the cross-language hop. `synonymsEn` on the AlUla row contains
 * "Al-Ula", "Hegra", "Madain Saleh"; `synonymsAr` carries spelling variants.
 * Matching either side yields the same taxonomy id, and clips are tagged by
 * id — so the language the buyer typed in stops mattering.
 */
async function resolveTaxonomy(query: string) {
  const normalised = normaliseArabic(query)
  if (!normalised) return []

  const candidates = await db.taxonomy.findMany({
    where: { isActive: true },
    select: {
      id: true,
      kind: true,
      slug: true,
      nameAr: true,
      nameEn: true,
      synonymsAr: true,
      synonymsEn: true,
    },
  })

  return candidates.filter((row) => {
    const haystack = [row.nameAr, row.nameEn, row.slug, ...row.synonymsAr, ...row.synonymsEn]
    return haystack.some((value) => {
      const candidate = normaliseArabic(value)
      return candidate.includes(normalised) || normalised.includes(candidate)
    })
  })
}

// ── Postgres driver ──────────────────────────────────────────────────────────

const postgresDriver: SearchDriver = {
  async search(filters) {
    const page = Math.max(1, filters.page ?? 1)
    const perPage = Math.min(60, Math.max(1, filters.perPage ?? 24))

    const matched = filters.q ? await resolveTaxonomy(filters.q) : []

    // Only live albums are ever searchable — a draft in results is a 404 with
    // extra steps, and an in-review album is not the creator's to show yet.
    const where: Prisma.ClipWhereInput = {
      album: {
        status: 'live',
        ...(filters.origin ? { origin: filters.origin } : {}),
        ...(filters.creator ? { creator: { handle: filters.creator } } : {}),
        ...(filters.minPrice != null || filters.maxPrice != null
          ? {
              priceStandard: {
                ...(filters.minPrice != null ? { gte: filters.minPrice } : {}),
                ...(filters.maxPrice != null ? { lte: filters.maxPrice } : {}),
              },
            }
          : {}),
      },
      ingestStatus: 'ready',
      ...(filters.minWidth ? { width: { gte: filters.minWidth } } : {}),
      ...(filters.aspectRatio ? { aspectRatio: filters.aspectRatio } : {}),
      ...(filters.colourProfile ? { colourProfile: filters.colourProfile } : {}),
      ...(filters.cameraMovement ? { cameraMovement: filters.cameraMovement } : {}),
      ...(filters.shotSize ? { shotSize: filters.shotSize } : {}),
      ...(filters.timeOfDay ? { timeOfDay: filters.timeOfDay } : {}),
      ...(filters.season ? { season: filters.season } : {}),
      ...(filters.minDurationS != null || filters.maxDurationS != null
        ? {
            durationS: {
              ...(filters.minDurationS != null ? { gte: filters.minDurationS } : {}),
              ...(filters.maxDurationS != null ? { lte: filters.maxDurationS } : {}),
            },
          }
        : {}),
      ...(filters.fps ? { fps: filters.fps } : {}),
      ...(filters.hasPeople != null ? { hasPeople: filters.hasPeople } : {}),
    }

    const andClauses: Prisma.ClipWhereInput[] = []

    if (filters.location) {
      andClauses.push({
        OR: [
          { location: { slug: filters.location } },
          { taxonomy: { some: { taxonomy: { kind: 'location', slug: filters.location } } } },
          {
            album: {
              taxonomy: { some: { taxonomy: { kind: 'location', slug: filters.location } } },
            },
          },
        ],
      })
    }
    if (filters.category) {
      andClauses.push({
        OR: [
          { taxonomy: { some: { taxonomy: { kind: 'category', slug: filters.category } } } },
          {
            album: {
              taxonomy: { some: { taxonomy: { kind: 'category', slug: filters.category } } },
            },
          },
        ],
      })
    }
    for (const tag of filters.tags ?? []) {
      andClauses.push({ taxonomy: { some: { taxonomy: { kind: 'tag', slug: tag } } } })
    }

    // Free text: literal substring on either language, OR membership of any
    // taxonomy the query resolved to. The second half is what makes an Arabic
    // query return English-tagged footage.
    if (filters.q?.trim()) {
      const q = filters.q.trim()
      const taxonomyIds = matched.map((row) => row.id)
      andClauses.push({
        OR: [
          { titleAr: { contains: q, mode: 'insensitive' } },
          { titleEn: { contains: q, mode: 'insensitive' } },
          { descriptionAr: { contains: q, mode: 'insensitive' } },
          { descriptionEn: { contains: q, mode: 'insensitive' } },
          { album: { titleAr: { contains: q, mode: 'insensitive' } } },
          { album: { titleEn: { contains: q, mode: 'insensitive' } } },
          ...(taxonomyIds.length
            ? [
                { locationId: { in: taxonomyIds } },
                { taxonomy: { some: { taxonomyId: { in: taxonomyIds } } } },
                { album: { taxonomy: { some: { taxonomyId: { in: taxonomyIds } } } } },
              ]
            : []),
        ],
      })
    }

    if (andClauses.length) where.AND = andClauses

    const orderBy = ((): Prisma.ClipOrderByWithRelationInput[] => {
      switch (filters.sort) {
        case 'newest':
          return [{ createdAt: 'desc' }]
        case 'popular':
          return [{ album: { salesCount: 'desc' } }, { createdAt: 'desc' }]
        case 'priceAsc':
          return [{ album: { priceStandard: 'asc' } }]
        case 'priceDesc':
          return [{ album: { priceStandard: 'desc' } }]
        default:
          return [{ album: { salesCount: 'desc' } }, { orderIndex: 'asc' }]
      }
    })()

    const [rows, total] = await Promise.all([
      db.clip.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          slug: true,
          titleAr: true,
          titleEn: true,
          durationS: true,
          width: true,
          height: true,
          fps: true,
          aspectRatio: true,
          thumbnailKeys: true,
          previewHlsKey: true,
          previewKey: true,
          // NOTE: masterKey is deliberately absent. The catalogue must never
          // be able to leak a path to an original.
          album: {
            select: {
              slug: true,
              titleAr: true,
              titleEn: true,
              priceStandard: true,
              currency: true,
              clipCount: true,
              origin: true,
              creator: { select: { handle: true, displayNameAr: true, displayNameEn: true } },
            },
          },
        },
      }),
      db.clip.count({ where }),
    ])

    return {
      hits: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        titleAr: row.titleAr,
        titleEn: row.titleEn,
        durationS: Number(row.durationS),
        width: row.width,
        height: row.height,
        fps: Number(row.fps),
        aspectRatio: row.aspectRatio,
        thumbnail: row.thumbnailKeys[0] ?? null,
        previewHlsKey: row.previewHlsKey,
        // A key, resolved by the tile through `lib/media.ts#mediaUrl` — null
        // there (no CDN, no file) and the tile correctly stays a still.
        previewKey: row.previewKey,
        album: {
          slug: row.album.slug,
          titleAr: row.album.titleAr,
          titleEn: row.album.titleEn,
          priceStandard: Number(row.album.priceStandard),
          currency: row.album.currency,
          clipCount: row.album.clipCount,
          origin: row.album.origin,
          creatorHandle: row.album.creator.handle,
          creatorNameAr: row.album.creator.displayNameAr,
        },
      })),
      total,
      page,
      perPage,
      matchedTaxonomy: matched.map((row) => ({
        kind: row.kind,
        slug: row.slug,
        nameAr: row.nameAr,
      })),
    }
  },
}

const driver: SearchDriver = postgresDriver

export async function search(filters: ClipFilters) {
  return driver.search(filters)
}

/**
 * Log the query.
 *
 * The zero-result report built on this table is the single most valuable
 * content-acquisition signal the business has: it is a list, in buyers' own
 * words, of footage they wanted and nobody has shot. It also feeds the demand
 * signals shown to creators. Fire and forget — a logging failure must never
 * break a search.
 */
export async function logSearch(
  filters: ClipFilters,
  resultCount: number,
  context: { userId?: string | null; sessionId?: string | null } = {},
) {
  const query = filters.q?.trim()
  if (!query) return

  try {
    await db.searchQueryLog.create({
      data: {
        query,
        normalized: normaliseArabic(query),
        locale: 'ar',
        resultCount,
        filtersJson: JSON.parse(JSON.stringify({ ...filters, q: undefined })),
        userId: context.userId ?? null,
        sessionId: context.sessionId ?? null,
      },
    })
  } catch {
    // Telemetry is never worth a 500 on a search page.
  }
}
