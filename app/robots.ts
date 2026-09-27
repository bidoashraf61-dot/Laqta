import type { MetadataRoute } from 'next'

const SITE_URL = process.env.AUTH_URL ?? 'http://localhost:3000'

const PRIVATE = ['/account', '/studio', '/admin', '/cart', '/checkout', '/sign-in', '/sign-up', '/forgot-password', '/reset-password']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private surfaces and anything that would burn crawl budget on
        // infinite filter permutations.
        // Both languages: `/en/…` serves the same private pages (DEV-33).
        disallow: PRIVATE.flatMap((path) => [path, `/en${path}`]).concat('/api/'),
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
