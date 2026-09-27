import { latestPosts } from '@/lib/blog'
import { translate } from '@/lib/i18n'
import { siteOrigin } from '@/lib/site'

/**
 * The blog feed (DEV-43): `/blog/rss.xml` in Arabic, `?lang=en` in English.
 * A query parameter rather than `/en/blog/rss.xml` because the locale
 * rewrite skips paths with a file extension. Revalidated hourly.
 */
export const revalidate = 3600

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function GET(request: Request) {
  const en = new URL(request.url).searchParams.get('lang') === 'en'
  const locale = en ? 'en' : 'ar'
  const origin = siteOrigin()
  const base = `${origin}${en ? '/en' : ''}/blog`
  const posts = await latestPosts(50)
  const items = posts
    .map((post) => {
      const title = (en && post.titleEn) || post.titleAr
      const excerpt = (en && post.excerptEn) || post.excerptAr
      const link = `${base}/${post.slug}`
      return `    <item>
      <title>${escape(title)}</title>
      <link>${escape(link)}</link>
      <guid isPermaLink="true">${escape(link)}</guid>
      ${post.publishAt ? `<pubDate>${post.publishAt.toUTCString()}</pubDate>` : ''}
      ${excerpt ? `<description>${escape(excerpt)}</description>` : ''}
    </item>`
    })
    .join('\n')
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(`${translate(locale, 'blog.title')} — ${translate(locale, 'brand.name')}`)}</title>
    <link>${escape(base)}</link>
    <atom:link href="${escape(`${origin}/blog/rss.xml${en ? '?lang=en' : ''}`)}" rel="self" type="application/rss+xml" />
    <description>${escape(translate(locale, 'brand.seo.blog'))}</description>
    <language>${en ? 'en' : 'ar'}</language>
${items}
  </channel>
</rss>
`
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
}
