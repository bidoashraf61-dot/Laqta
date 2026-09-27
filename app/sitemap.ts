import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { localePath } from '@/lib/locale'
import { siteOrigin } from '@/lib/site'
import { absoluteMediaUrl } from '@/lib/media'

/**
 * Revalidate hourly.
 *
 * Without this Next generates the sitemap ONCE at build time and serves that
 * file forever — so an album published on Tuesday is invisible to crawlers
 * until the next deploy, and routes removed on Monday keep being advertised.
 * It was caught exactly that way: `/collections` and thirty empty collection
 * stubs were still listed after both had been fixed, because the response was
 * a build artefact rather than a query.
 *
 * An hour is the right trade for a catalogue that gains albums weekly: fresh
 * enough that nothing is stale for long, cheap enough that a crawler hammering
 * the URL does not hammer the database.
 */
export const revalidate = 3600

/**
 * Sitemap.
 *
 * Location hubs rank highest and are the main organic differentiator against
 * the global libraries, so they carry the top priority after the homepage.
 * Only `live` albums appear — a draft in the sitemap is a 404 waiting to be
 * indexed.
 *
 * ── Both languages, every entry ─────────────────────────────────────────────
 * Every URL is emitted twice — once bare (Arabic) and once under `/en` — and
 * each entry names both in its `alternates.languages`. Listing only the Arabic
 * would leave the English translation to be discovered by luck; listing the two
 * without cross-referencing them invites Google to read one as a duplicate of
 * the other and drop it. The pairing is the point.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [albums, taxonomy, creators, collections, clips] = await Promise.all([
    db.album.findMany({
      where: { status: 'live' },
      select: { slug: true, updatedAt: true, creator: { select: { handle: true } } },
    }),
    db.taxonomy.findMany({
      // Only the two kinds that HAVE a page — `/locations/[slug]` and
      // `/categories/[slug]` — and only with live footage behind them. Themes
      // and tags have no public route: they used to be mapped to
      // `/collections/<slug>`, which looks up a Collection row, finds none and
      // 404s (DEV-34). A 404 in the sitemap is a crawl error Google reports
      // against the whole domain.
      where: {
        isActive: true,
        kind: { in: ['location', 'category'] },
        albums: { some: { album: { status: 'live' } } },
      },
      select: { kind: true, slug: true, updatedAt: true },
    }),
    db.creator.findMany({
      where: { status: 'approved' },
      select: { handle: true, updatedAt: true },
    }),
    db.collection.findMany({
      // Only collections that actually hold something. Thirty published
      // collections render eighteen words and no albums; listing them at
      // priority 0.7 is asking Google to index thirty near-empty pages, which
      // drags the whole domain. A collection with no albums is not a page yet.
      where: { isPublished: true, albums: { some: { album: { status: 'live' } } } },
      select: { slug: true, updatedAt: true },
    }),
    db.clip.findMany({
      // Clip pages (DEV-34). Discovery happens at the clip — it is what a
      // search for «لقطة درون الرياض ليلاً» lands on — so each clip of a live
      // album is its own entry, with a <video:video> block when it has a
      // poster. Same filter as the clip page itself: live album only.
      where: { album: { status: 'live' } },
      select: {
        slug: true,
        updatedAt: true,
        createdAt: true,
        titleAr: true,
        titleEn: true,
        descriptionAr: true,
        descriptionEn: true,
        durationS: true,
        thumbnailKeys: true,
        previewKey: true,
        album: { select: { titleAr: true, titleEn: true } },
      },
      orderBy: [{ albumId: 'asc' }, { orderIndex: 'asc' }],
    }),
  ])

  /** One source path becomes two entries, each pointing at the other. */
  function bilingual(
    path: string,
    rest: Omit<MetadataRoute.Sitemap[number], 'url' | 'alternates'>,
  ): MetadataRoute.Sitemap {
    const languages = {
      ar: `${siteOrigin()}${path}`,
      en: `${siteOrigin()}${localePath('en', path)}`,
    }
    return [
      { ...rest, url: languages.ar, alternates: { languages } },
      { ...rest, url: languages.en, alternates: { languages } },
    ]
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    ...bilingual('/', { changeFrequency: 'daily', priority: 1 }),
    ...bilingual('/footage', { changeFrequency: 'daily', priority: 0.9 }),
    ...bilingual('/albums', { changeFrequency: 'daily', priority: 0.9 }),
    ...bilingual('/creators', { changeFrequency: 'weekly', priority: 0.6 }),
    ...bilingual('/sell', { changeFrequency: 'monthly', priority: 0.6 }),
  ]

  const taxonomyRoutes: MetadataRoute.Sitemap = taxonomy.flatMap((entry) =>
    bilingual(
      `/${entry.kind === 'location' ? 'locations' : 'categories'}/${entry.slug}`,
      {
        lastModified: entry.updatedAt,
        changeFrequency: 'weekly',
        priority: entry.kind === 'location' ? 0.85 : 0.7,
      },
    ),
  )

  const absoluteMedia = (key: string | null | undefined) => absoluteMediaUrl(key) ?? undefined

  /**
   * The video sitemap block for one clip in one language. Google requires a
   * title, description and thumbnail; a clip with no poster gets no block
   * (the page is still listed). The content URL is the public WATERMARKED
   * preview — never the master or the buyer's proxy.
   */
  function clipVideos(clip: (typeof clips)[number], locale: 'ar' | 'en') {
    const thumbnail = absoluteMedia(clip.thumbnailKeys[0])
    if (!thumbnail) return undefined
    const title = locale === 'ar' ? clip.titleAr : clip.titleEn || clip.titleAr
    const albumTitle = locale === 'ar' ? clip.album.titleAr : clip.album.titleEn || clip.album.titleAr
    const description =
      (locale === 'ar' ? clip.descriptionAr : clip.descriptionEn || clip.descriptionAr) ||
      (locale === 'ar' ? `لقطة من ألبوم «${albumTitle}» على لقطة.` : `A clip from the album “${albumTitle}” on Laqta.`)
    return [
      {
        title,
        description,
        thumbnail_loc: thumbnail,
        content_loc: absoluteMedia(clip.previewKey),
        duration: Math.max(1, Math.round(Number(clip.durationS))),
        publication_date: clip.createdAt.toISOString(),
        family_friendly: 'yes' as const,
        requires_subscription: 'no' as const,
      },
    ]
  }

  const clipRoutes: MetadataRoute.Sitemap = clips.flatMap((clip) => {
    const path = `/footage/${clip.slug}`
    const languages = { ar: `${siteOrigin()}${path}`, en: `${siteOrigin()}${localePath('en', path)}` }
    const rest = { lastModified: clip.updatedAt, changeFrequency: 'monthly' as const, priority: 0.5 }
    return [
      { ...rest, url: languages.ar, alternates: { languages }, videos: clipVideos(clip, 'ar') },
      { ...rest, url: languages.en, alternates: { languages }, videos: clipVideos(clip, 'en') },
    ]
  })

  return [
    ...staticRoutes,
    ...taxonomyRoutes,
    ...albums.flatMap((album) =>
      bilingual(`/albums/${album.creator.handle}/${album.slug}`, {
        lastModified: album.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.8,
      }),
    ),
    ...collections.flatMap((collection) =>
      bilingual(`/collections/${collection.slug}`, {
        lastModified: collection.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.6,
      }),
    ),
    ...clipRoutes,
    ...creators.flatMap((creator) =>
      bilingual(`/creators/${creator.handle}`, {
        lastModified: creator.updatedAt,
        changeFrequency: 'monthly',
        priority: 0.5,
      }),
    ),
  ]
}
