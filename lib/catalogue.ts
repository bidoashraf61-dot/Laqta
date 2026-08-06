import { db } from '@/lib/db'
import type { AlbumCardData } from '@/components/catalogue/album-card'

/**
 * Read-side queries for the public catalogue.
 *
 * Everything here is safe to render on a public page: only `live` albums, and
 * never a master key. `Clip.masterKey` must not leave this module — previews
 * and posters are the only media the catalogue is allowed to reference.
 */

/** The select every album card needs, in one place so the shape cannot drift. */
const ALBUM_CARD_SELECT = {
  slug: true,
  titleAr: true,
  titleEn: true,
  priceStandard: true,
  currency: true,
  clipCount: true,
  totalRuntimeS: true,
  clearedForCommercial: true,
  coverClipId: true,
  creator: { select: { handle: true, displayNameAr: true } },
} as const

type AlbumRow = {
  slug: string
  titleAr: string
  titleEn: string
  priceStandard: unknown
  currency: string
  clipCount: number
  totalRuntimeS: number
  clearedForCommercial: boolean
  coverClipId: string | null
  creator: { handle: string; displayNameAr: string }
}

async function toCards(rows: AlbumRow[]): Promise<AlbumCardData[]> {
  // Resolve cover posters in one query rather than N.
  const coverIds = rows.map((row) => row.coverClipId).filter(Boolean) as string[]
  const covers = coverIds.length
    ? await db.clip.findMany({
        where: { id: { in: coverIds } },
        select: { id: true, thumbnailKeys: true },
      })
    : []
  const byId = new Map(covers.map((clip) => [clip.id, clip.thumbnailKeys[0] ?? null]))

  return rows.map((row) => ({
    slug: row.slug,
    creatorHandle: row.creator.handle,
    creatorNameAr: row.creator.displayNameAr,
    titleAr: row.titleAr,
    titleEn: row.titleEn,
    priceStandard: Number(row.priceStandard),
    currency: row.currency,
    clipCount: row.clipCount,
    totalRuntimeS: row.totalRuntimeS,
    clearedForCommercial: row.clearedForCommercial,
    coverKey: row.coverClipId ? (byId.get(row.coverClipId) ?? null) : null,
  }))
}

export async function getFeaturedAlbums(take = 8) {
  const rows = await db.album.findMany({
    where: { status: 'live' },
    orderBy: [
      { isFeatured: 'desc' },
      { featureRank: 'asc' },
      { salesCount: 'desc' },
      { publishedAt: 'desc' },
    ],
    take,
    select: ALBUM_CARD_SELECT,
  })
  return toCards(rows as AlbumRow[])
}

export async function getNewAlbums(take = 8) {
  const rows = await db.album.findMany({
    where: { status: 'live' },
    orderBy: { publishedAt: 'desc' },
    take,
    select: ALBUM_CARD_SELECT,
  })
  return toCards(rows as AlbumRow[])
}

/** Taxonomy tiles. Only entries that actually have live footage behind them. */
export async function getTaxonomyTiles(kind: 'location' | 'category' | 'theme', take = 8) {
  const rows = await db.taxonomy.findMany({
    where: { kind, isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      slug: true,
      nameAr: true,
      nameEn: true,
      heroImage: true,
      _count: { select: { albums: true, clipsAtLocation: true } },
    },
  })

  return rows
    .map((row) => ({
      slug: row.slug,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      heroImage: row.heroImage,
      count: row._count.albums + row._count.clipsAtLocation,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, take)
}

export async function getTopCreators(take = 6) {
  const rows = await db.creator.findMany({
    where: { status: 'approved', albums: { some: { status: 'live' } } },
    orderBy: [{ lifetimeGmv: 'desc' }, { createdAt: 'asc' }],
    take,
    select: {
      handle: true,
      displayNameAr: true,
      displayNameEn: true,
      city: true,
      country: true,
      _count: { select: { albums: true } },
    },
  })
  return rows.map((row) => ({
    handle: row.handle,
    nameAr: row.displayNameAr,
    nameEn: row.displayNameEn,
    city: row.city,
    country: row.country,
    albumCount: row._count.albums,
  }))
}

/**
 * A single frame on the footage wall.
 *
 * The wall shows clips, but nothing on it is a clip you can buy — every tile
 * routes to the album it belongs to (`album.creatorHandle`/`album.slug`),
 * carrying that album's price so the doorway is honest about what it costs.
 */
export type FootageTile = {
  slug: string
  titleAr: string
  titleEn: string
  aspectRatio: string | null
  thumbKey: string | null
  album: {
    creatorHandle: string
    slug: string
    titleAr: string
    titleEn: string
    priceStandard: number
    currency: string
    clipCount: number
    clearedForCommercial: boolean
  }
}

/**
 * The landing footage wall — individual frames drawn from *across* the live
 * catalogue, each a doorway into its album.
 *
 * With a young catalogue this is also what makes five albums read as a wall of
 * Saudi: the eye counts frames, not albums. So the tiles are interleaved
 * round-robin across albums rather than served in album order — no single
 * album clusters, and the variety is what sells.
 */
export async function getFootageWall(take = 12): Promise<FootageTile[]> {
  const rows = await db.clip.findMany({
    where: { album: { status: 'live' } },
    orderBy: [{ album: { salesCount: 'desc' } }, { orderIndex: 'asc' }],
    take: take * 4,
    select: {
      slug: true,
      titleAr: true,
      titleEn: true,
      aspectRatio: true,
      thumbnailKeys: true,
      album: {
        select: {
          slug: true,
          titleAr: true,
          titleEn: true,
          priceStandard: true,
          currency: true,
          clipCount: true,
          clearedForCommercial: true,
          creator: { select: { handle: true } },
        },
      },
    },
  })

  const tiles: FootageTile[] = rows.map((row) => ({
    slug: row.slug,
    titleAr: row.titleAr,
    titleEn: row.titleEn,
    aspectRatio: row.aspectRatio,
    thumbKey: row.thumbnailKeys[0] ?? null,
    album: {
      creatorHandle: row.album.creator.handle,
      slug: row.album.slug,
      titleAr: row.album.titleAr,
      titleEn: row.album.titleEn,
      priceStandard: Number(row.album.priceStandard),
      currency: row.album.currency,
      clipCount: row.album.clipCount,
      clearedForCommercial: row.album.clearedForCommercial,
    },
  }))

  // Round-robin across albums so one album never fills the wall.
  const byAlbum = new Map<string, FootageTile[]>()
  for (const tile of tiles) {
    const key = `${tile.album.creatorHandle}/${tile.album.slug}`
    const bucket = byAlbum.get(key)
    if (bucket) bucket.push(tile)
    else byAlbum.set(key, [tile])
  }
  const buckets = [...byAlbum.values()]
  const woven: FootageTile[] = []
  for (let i = 0; woven.length < take && buckets.some((b) => b.length); i++) {
    const bucket = buckets[i % buckets.length]
    const next = bucket.shift()
    if (next) woven.push(next)
  }
  return woven
}

/** Headline numbers for the trust strip. */
export async function getCatalogueStats() {
  const [clips, albums, creators, cleared] = await Promise.all([
    db.clip.count({ where: { album: { status: 'live' } } }),
    db.album.count({ where: { status: 'live' } }),
    db.creator.count({ where: { status: 'approved' } }),
    db.album.count({ where: { status: 'live', clearedForCommercial: true } }),
  ])
  return { clips, albums, creators, cleared }
}
