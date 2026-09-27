/**
 * Each language of every indexable page is its own page to Google (DEV-33).
 *
 *   npm start &  then  npm run verify:seo
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 * The album, clip, creator, collection, location and category pages set
 * `canonical` to the ARABIC address on both languages. On `/en/albums/…` that
 * tells Google "index the Arabic page instead", so no English detail page was
 * ever indexed. Their metadata also read the locale before resolving it, so
 * the English page could carry an Arabic <title>, and every share card said
 * `og:locale=ar_SA`. The root layout added a hreflang pair pointing at the
 * HOME page, which every page without its own inherited.
 *
 * For each kind of page, in both languages, this checks:
 *   - `<link rel="canonical">` is this page in this language;
 *   - `hreflang` names both languages and `x-default` (Arabic) for THIS page;
 *   - `og:locale` matches the language (where the page sets one);
 *   - the English `<title>` has no Arabic, the Arabic one has Arabic.
 * And that robots.txt keeps both languages of the private pages out.
 */
import { db } from '../lib/db'

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000'
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const ARABIC = /[؀-ۿ]/

let failures = 0
function report(label: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

const attr = (html: string, pattern: RegExp) => pattern.exec(html)?.[1] ?? null
const path = (href: string | null) => (href ? new URL(href, BASE).pathname : null)

async function main() {
  console.log(`SEO: one page per language (${BASE})\n`)

  const [album, clip, creator, collection, location, category] = await Promise.all([
    db.album.findFirst({ where: { status: 'live' }, select: { slug: true, creator: { select: { handle: true } } } }),
    db.clip.findFirst({ where: { album: { status: 'live' }, ingestStatus: 'ready' }, select: { slug: true } }),
    db.creator.findFirst({ where: { status: 'approved' }, select: { handle: true } }),
    db.collection.findFirst({ where: { isPublished: true }, select: { slug: true } }),
    db.taxonomy.findFirst({ where: { kind: 'location', isActive: true }, select: { slug: true } }),
    db.taxonomy.findFirst({ where: { kind: 'category', isActive: true }, select: { slug: true } }),
  ])
  await db.$disconnect()

  const pages = [
    '/',
    '/albums',
    album && `/albums/${album.creator.handle}/${album.slug}`,
    clip && `/footage/${clip.slug}`,
    creator && `/creators/${creator.handle}`,
    collection && `/collections/${collection.slug}`,
    location && `/locations/${location.slug}`,
    category && `/categories/${category.slug}`,
    '/terms',
  ].filter((p): p is string => Boolean(p))

  for (const page of pages) {
    for (const lang of ['ar', 'en'] as const) {
      const url = lang === 'en' ? (page === '/' ? '/en' : `/en${page}`) : page
      // As Googlebot: Next streams metadata into the body for ordinary
      // browsers and renders it in <head> for crawlers — the crawler's view
      // is the one this gate is about.
      const response = await fetch(`${BASE}${url}`, { redirect: 'manual', headers: { 'user-agent': GOOGLEBOT } })
      if (response.status !== 200) {
        report(`${url} answers 200`, false, String(response.status))
        continue
      }
      const html = await response.text()
      // The whole document: on a dynamic page Next may place the metadata
      // tags after the first `</head>` it streams.
      const head = html

      const canonical = path(attr(head, /<link rel="canonical" href="([^"]+)"/))
      report(`${url} — canonical is itself`, canonical === url, String(canonical))

      const ar = path(attr(head, /<link rel="alternate" hrefLang="ar" href="([^"]+)"/))
      const en = path(attr(head, /<link rel="alternate" hrefLang="en" href="([^"]+)"/))
      const xd = path(attr(head, /<link rel="alternate" hrefLang="x-default" href="([^"]+)"/))
      const enPath = page === '/' ? '/en' : `/en${page}`
      report(`${url} — hreflang ar/en/x-default name this page`, ar === page && en === enPath && xd === page, `${ar} ${en} ${xd}`)

      const og = attr(head, /<meta property="og:locale" content="([^"]+)"/)
      if (og) report(`${url} — og:locale`, og === (lang === 'en' ? 'en_US' : 'ar_SA'), og)

      // Share data in the page's language (DEV-35): JSON-LD `inLanguage` and
      // breadcrumb targets used to be Arabic on the English pages.
      const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n')
      const langs = [...ld.matchAll(/"inLanguage":"([^"]+)"/g)].map((m) => m[1])
      if (langs.length) report(`${url} — JSON-LD inLanguage is ${lang}`, langs.every((l) => l.startsWith(lang)), langs.join(','))
      if (/BreadcrumbList/.test(ld)) {
        const items = [...ld.matchAll(/"item":"([^"]+)"/g)].map((m) => new URL(m[1]).pathname)
        report(`${url} — breadcrumbs point at ${lang} pages`, items.every((p) => (lang === 'en') === (p === '/en' || p.startsWith('/en/'))), items.join(' '))
      }

      const title = attr(head, /<title>([^<]*)<\/title>/) ?? ''
      report(`${url} — title in its language`, lang === 'en' ? !ARABIC.test(title) : ARABIC.test(title), title.slice(0, 60))
    }
  }

  // The sitemap (DEV-34): every page it lists must exist. Themes and tags were
  // mapped to /collections/<slug>, which 404s — a crawl error Google charges
  // to the whole domain. Every non-clip URL is fetched; clips are sampled.
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text()
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname)
  const clipLocs = locs.filter((p) => p.includes('/footage/'))
  report('sitemap lists clip pages in both languages', clipLocs.some((p) => p.startsWith('/footage/')) && clipLocs.some((p) => p.startsWith('/en/footage/')), `${clipLocs.length} clip URLs`)
  report('sitemap carries <video:video> blocks with a thumbnail', /<video:video>[\s\S]*?<video:thumbnail_loc>/.test(sitemap))
  const toCheck = [...locs.filter((p) => !p.includes('/footage/')), ...clipLocs.slice(0, 6)]
  const broken: string[] = []
  for (const loc of toCheck) {
    const res = await fetch(`${BASE}${loc}`, { redirect: 'manual', headers: { 'user-agent': GOOGLEBOT } })
    if (res.status !== 200) broken.push(`${loc} ${res.status}`)
  }
  report(`every sitemap URL answers 200 (${toCheck.length} checked of ${locs.length})`, broken.length === 0, broken.slice(0, 5).join(', '))

  // DEV-41: a hub with owner-written FAQs publishes them as FAQPage.
  if (location) {
    const hub = await (await fetch(`${BASE}/locations/${location.slug}`, { headers: { 'user-agent': GOOGLEBOT } })).text()
    const hasFaqText = /<dt[^>]*>[^<]+<\/dt>/.test(hub)
    report('a hub with FAQs carries FAQPage JSON-LD', !hasFaqText || hub.includes('"FAQPage"'), hasFaqText ? 'faq present' : 'no faq on this hub')
  }

  const robots = await (await fetch(`${BASE}/robots.txt`)).text()
  const kept = ['/account', '/en/account', '/admin', '/en/admin', '/checkout', '/en/checkout']
  report('robots.txt keeps both languages of private pages out', kept.every((p) => robots.includes(`Disallow: ${p}`)))

  console.log(failures ? `\n${failures} SEO check(s) failed.\n` : '\nEvery page is its own page in each language.\n')
  process.exit(failures ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
