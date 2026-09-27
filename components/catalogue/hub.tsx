import { Link } from '@/components/ui/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { search } from '@/lib/search'
import { ClipCard } from '@/components/catalogue/clip-card'
import { EmptyState } from '@/components/ui/state'
import { Bilingual } from '@/components/ui/bilingual'
import { countOf, formatNumber, t } from '@/lib/i18n'
import { PageTitle, SubHeadline } from '@/components/ui/typography'
import { AlbumCard } from '@/components/catalogue/album-card'
import { FaqSchema } from '@/components/catalogue/faq-schema'
import { getHubAlbums, getRelatedHubs } from '@/lib/catalogue'
import { faqInLocale, parseHubFaqs } from '@/lib/hub-page'
import { currentLocale, localeAlternates, localePath, ogLocale, pickLocalised } from '@/lib/locale'
import { requestLocale } from '@/lib/locale-request'
import { siteOrigin } from '@/lib/site'

/**
 * Taxonomy hubs — `/locations/[slug]` and `/categories/[slug]`.
 *
 * These are the highest-value organic surface on the site and the main
 * differentiator against the global libraries: nobody outranks a Saudi
 * marketplace on "لقطات العلا" if the page actually exists and is served
 * server-side. Hence real Arabic metadata, a breadcrumb trail and copy above
 * the grid rather than a bare list of tiles.
 */

type Kind = 'location' | 'category'

const BASE: Record<Kind, string> = { location: '/locations', category: '/categories' }
const TITLE_KEY: Record<Kind, string> = {
  location: 'catalogue.locationsTitle',
  category: 'catalogue.categoriesTitle',
}

export async function hubMetadata(kind: Kind, slug: string): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  const entry = await db.taxonomy.findUnique({ where: { kind_slug: { kind, slug } } })
  if (!entry) return { title: t('state.notFound') }

  const name = pickLocalised(entry.nameAr, entry.nameEn)
  // A natural title in each language (DEV-38): «لقطات الرياض» / "Riyadh stock
  // footage" — how people search — not "Footage Riyadh". An owner-written SEO
  // title wins, but only in its OWN language: an English page must not fall
  // back to the Arabic SEO title when a generated English one reads fine.
  const ownTitle = currentLocale() === 'en' ? entry.seoTitleEn : entry.seoTitleAr
  const title = ownTitle || t('catalogue.hubTitle', { name })
  const ownDescription = currentLocale() === 'en' ? entry.seoDescEn : entry.seoDescAr
  const description =
    ownDescription || t(kind === 'location' ? 'brand.seo.hubLocation' : 'brand.seo.hubCategory', { name })

  return {
    title,
    description,
    // Each language its own canonical, both linked (DEV-33).
    alternates: localeAlternates(`${BASE[kind]}/${slug}`),
    openGraph: {
      type: 'website',
      locale: ogLocale(),
      title,
      description,
      images: entry.heroImage ? [entry.heroImage] : [],
    },
  }
}

/** The index page: every entry of a kind, with counts. */
export async function TaxonomyIndex({ kind }: { kind: Kind }) {
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

  return (
    <div className="container-tight py-16">
      <PageTitle className="mb-6">{t(TITLE_KEY[kind])}</PageTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {rows.map((row) => (
          <Link
            key={row.slug}
            href={`${BASE[kind]}/${row.slug}`}
            className="group relative isolate overflow-hidden rounded-lg border bg-card p-5 transition-colors hover:border-foreground/25"
          >
            {row.heroImage ? (
              <img
                src={row.heroImage}
                alt=""
                loading="lazy"
                className="absolute inset-0 -z-10 size-full object-cover opacity-30 transition-transform duration-500 group-hover:scale-105"
              />
            ) : null}
            <p className="font-bold group-hover:text-foreground">
              <Bilingual ar={row.nameAr} en={row.nameEn} />
            </p>
            <p className="numeric mt-1 text-xs text-muted-foreground">
              {formatNumber(row._count.albums + row._count.clipsAtLocation)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}

/**
 * A single hub (DEV-41): the owner's intro, the albums first — the album is
 * what a buyer buys — then the clips, up to three questions and answers
 * (with FAQPage JSON-LD), and the hubs next door.
 */
export async function TaxonomyHub({
  kind,
  slug,
  page,
}: {
  kind: Kind
  slug: string
  page: number
}) {
  const entry = await db.taxonomy.findUnique({ where: { kind_slug: { kind, slug } } })
  if (!entry || !entry.isActive) notFound()

  const [result, albums, related] = await Promise.all([
    search({
      [kind]: slug,
      page,
      perPage: 24,
    } as Parameters<typeof search>[0]),
    // Albums on the first page only; page 2+ of the clips is a clip browse.
    page <= 1 ? getHubAlbums(entry.id, kind) : Promise.resolve([]),
    getRelatedHubs(entry.id),
  ])

  const locale = currentLocale()
  const name = pickLocalised(entry.nameAr, entry.nameEn) ?? entry.nameAr
  const intro = pickLocalised(entry.introAr, entry.introEn) ?? pickLocalised(entry.seoDescAr, entry.seoDescEn)
  const faqs = parseHubFaqs(entry.faqs).map((faq) => faqInLocale(faq, locale))

  return (
    <div className="container-tight py-16">
      <BreadcrumbJsonLd kind={kind} entry={entry} />
      {faqs.length > 0 ? <FaqSchema pairs={faqs} /> : null}

      <nav className="mb-4 text-sm text-muted-foreground" aria-label={t('catalogue.breadcrumb')}>
        <Link href="/" className="hover:text-foreground">
          {t('nav.home')}
        </Link>
        {' / '}
        <Link href={BASE[kind]} className="hover:text-foreground">
          {t(TITLE_KEY[kind])}
        </Link>
        {' / '}
        <span className="text-foreground">{name}</span>
      </nav>

      <header className="mb-8 space-y-2">
        <PageTitle>{t('catalogue.hubTitle', { name })}</PageTitle>
        {intro ? (
          <p className="max-w-prose whitespace-pre-line font-serif text-base leading-[1.9] text-muted-foreground">
            {intro}
          </p>
        ) : null}
        <p className="numeric text-sm text-muted-foreground">{countOf('result', result.total)}</p>
      </header>

      {albums.length > 0 ? (
        <section className="mb-12">
          <SubHeadline as="h2" size="panel" weight="strong" className="mb-4">
            {t('catalogue.hubAlbums', { name })}
          </SubHeadline>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album, i) => (
              <AlbumCard key={album.slug} album={album} index={i} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SubHeadline as="h2" size="panel" weight="strong" className="mb-4">
          {t('catalogue.hubClips')}
        </SubHeadline>
        {result.hits.length === 0 ? (
          <EmptyState title={t('catalogue.noResultsTitle')} description={t('catalogue.noResultsBody')} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.hits.map((clip, i) => (
              <ClipCard key={clip.id} clip={clip} index={i} />
            ))}
          </div>
        )}
      </section>

      {faqs.length > 0 ? (
        <section className="mt-14 max-w-prose">
          <SubHeadline as="h2" size="panel" weight="strong" className="mb-4">
            {t('catalogue.hubFaq', { name })}
          </SubHeadline>
          <dl className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q}>
                <dt className="font-bold">{faq.q}</dt>
                <dd className="mt-1.5 font-serif leading-[1.9] text-muted-foreground">{faq.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {related.length > 0 ? (
        <nav aria-labelledby="hub-related" className="mt-14">
          <h2 id="hub-related" className="mb-3 text-sm font-medium text-muted-foreground">
            {t('catalogue.hubRelated')}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {related.map((term) => (
              <li key={term.id}>
                <Link
                  href={`${term.kind === 'location' ? '/locations' : '/categories'}/${term.slug}`}
                  className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm transition-colors hover:border-foreground/40"
                >
                  <Bilingual ar={term.nameAr} en={term.nameEn} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  )
}

function BreadcrumbJsonLd({
  kind,
  entry,
}: {
  kind: Kind
  entry: { slug: string; nameAr: string; nameEn: string | null }
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      // Every crumb in the page's own language and at its own address (DEV-35):
      // an English hub used to publish Arabic names pointing at Arabic URLs.
      { '@type': 'ListItem', position: 1, name: t('nav.home'), item: `${siteOrigin()}${localePath(currentLocale(), '/')}` },
      {
        // The middle crumb points at the SHOTS page, not at `/locations` or
        // `/categories`. Those indexes now 301 to it, and a breadcrumb that
        // resolves through a redirect wastes the hop and muddies the trail a
        // crawler records. `BASE` is still correct for the canonical below —
        // the hub routes themselves are untouched.
        '@type': 'ListItem',
        position: 2,
        name: t('nav.footage'),
        item: `${siteOrigin()}${localePath(currentLocale(), '/footage')}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: pickLocalised(entry.nameAr, entry.nameEn),
        item: `${siteOrigin()}${localePath(currentLocale(), `${BASE[kind]}/${entry.slug}`)}`,
      },
    ],
  }
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  )
}
