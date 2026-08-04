import type { MetadataRoute } from 'next'

const SITE_URL = process.env.AUTH_URL ?? 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private surfaces and anything that would burn crawl budget on
        // infinite filter permutations.
        disallow: ['/account', '/studio', '/admin', '/cart', '/api/', '/sign-in', '/sign-up'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
