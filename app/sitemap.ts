import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'

const SITE_URL = process.env.AUTH_URL ?? 'http://localhost:3000'

/**
 * Sitemap.
 *
 * Location hubs rank highest and are the main organic differentiator against
 * the global libraries, so they carry the top priority after the homepage.
 * Only `live` albums appear — a draft in the sitemap is a 404 waiting to be
 * indexed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [albums, taxonomy, creators, collections] = await Promise.all([
    db.album.findMany({
      where: { status: 'live' },
      select: { slug: true, updatedAt: true, creator: { select: { handle: true } } },
    }),
    db.taxonomy.findMany({
      where: { isActive: true },
      select: { kind: true, slug: true, updatedAt: true },
    }),
    db.creator.findMany({
      where: { status: 'approved' },
      select: { handle: true, updatedAt: true },
    }),
    db.collection.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    }),
  ])

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/footage`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/albums`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/collections`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/creators`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/sell`, changeFrequency: 'monthly', priority: 0.6 },
  ]

  const taxonomyRoutes: MetadataRoute.Sitemap = taxonomy.map((entry) => ({
    url: `${SITE_URL}/${entry.kind === 'location' ? 'locations' : entry.kind === 'category' ? 'categories' : 'collections'}/${entry.slug}`,
    lastModified: entry.updatedAt,
    changeFrequency: 'weekly',
    priority: entry.kind === 'location' ? 0.85 : 0.7,
  }))

  return [
    ...staticRoutes,
    ...taxonomyRoutes,
    ...albums.map((album) => ({
      url: `${SITE_URL}/albums/${album.creator.handle}/${album.slug}`,
      lastModified: album.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...collections.map((collection) => ({
      url: `${SITE_URL}/collections/${collection.slug}`,
      lastModified: collection.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...creators.map((creator) => ({
      url: `${SITE_URL}/creators/${creator.handle}`,
      lastModified: creator.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ]
}
