import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { localePath } from '@/lib/locale'

const SITE_URL = process.env.AUTH_URL ?? 'http://localhost:3000'

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
  const [albums, taxonomy, creators, collections] = await Promise.all([
    db.album.findMany({
      where: { status: 'live' },
      select: { slug: true, updatedAt: true, creator: { select: { handle: true } } },
    }),
    db.taxonomy.findMany({
      // Only entries with live footage behind them. A taxonomy row with no
      // albums renders a heading and a count of zero — and `kind='theme'`
      // renders under /collections/, which is where the thirty stub pages in
      // the audit actually came from. They were never Collection rows.
      where: { isActive: true, albums: { some: { album: { status: 'live' } } } },
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
  ])

  /** One source path becomes two entries, each pointing at the other. */
  function bilingual(
    path: string,
    rest: Omit<MetadataRoute.Sitemap[number], 'url' | 'alternates'>,
  ): MetadataRoute.Sitemap {
    const languages = {
      ar: `${SITE_URL}${path}`,
      en: `${SITE_URL}${localePath('en', path)}`,
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
      `/${entry.kind === 'location' ? 'locations' : entry.kind === 'category' ? 'categories' : 'collections'}/${entry.slug}`,
      {
        lastModified: entry.updatedAt,
        changeFrequency: 'weekly',
        priority: entry.kind === 'location' ? 0.85 : 0.7,
      },
    ),
  )

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
    ...creators.flatMap((creator) =>
      bilingual(`/creators/${creator.handle}`, {
        lastModified: creator.updatedAt,
        changeFrequency: 'monthly',
        priority: 0.5,
      }),
    ),
  ]
}
