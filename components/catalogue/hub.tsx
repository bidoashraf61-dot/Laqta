import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { search } from '@/lib/search'
import { ClipCard } from '@/components/catalogue/clip-card'
import { EmptyState } from '@/components/ui/state'
import { Bilingual } from '@/components/ui/bilingual'
import { formatNumber, t } from '@/lib/i18n'

/**
 * Taxonomy hubs — `/locations/[slug]` and `/categories/[slug]`.
 *
 * These are the highest-value organic surface on the site and the main
 * differentiator against the global libraries: nobody outranks a Saudi
 * marketplace on "لقطات العلا" if the page actually exists and is served
 * server-side. Hence real Arabic metadata, a breadcrumb trail and copy above
 * the grid rather than a bare list of tiles.
 */

const SITE_URL = process.env.AUTH_URL ?? 'http://localhost:3000'

type Kind = 'location' | 'category'

const BASE: Record<Kind, string> = { location: '/locations', category: '/categories' }
const TITLE_KEY: Record<Kind, string> = {
  location: 'catalogue.locationsTitle',
  category: 'catalogue.categoriesTitle',
}

export async function hubMetadata(kind: Kind, slug: string): Promise<Metadata> {
  const entry = await db.taxonomy.findUnique({ where: { kind_slug: { kind, slug } } })
  if (!entry) return { title: t('state.notFound') }

  const title = entry.seoTitleAr ?? `${t('nav.footage')} ${entry.nameAr}`
  const description =
    entry.seoDescAr ??
    `${t('brand.tagline')} — ${entry.nameAr}. ${t('brand.promise')}`

  return {
    title,
    description,
    alternates: { canonical: `${BASE[kind]}/${slug}` },
    openGraph: {
      type: 'website',
      locale: 'ar_SA',
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
    <div className="container py-10">
      <h1 className="mb-6 font-display text-headline font-semibold">{t(TITLE_KEY[kind])}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {rows.map((row) => (
          <Link
            key={row.slug}
            href={`${BASE[kind]}/${row.slug}`}
            className="group relative isolate overflow-hidden rounded-lg border bg-card p-5 transition-colors hover:border-gold/50"
          >
            {row.heroImage ? (
              <img
                src={row.heroImage}
                alt=""
                loading="lazy"
                className="absolute inset-0 -z-10 size-full object-cover opacity-30 transition-transform duration-500 group-hover:scale-105"
              />
            ) : null}
            <p className="font-semibold group-hover:text-gold">
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

/** A single hub, with the clips that belong to it. */
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

  const result = await search({
    [kind]: slug,
    page,
    perPage: 24,
  } as Parameters<typeof search>[0])

  return (
    <div className="container py-10">
      <BreadcrumbJsonLd kind={kind} entry={entry} />

      <nav className="mb-4 text-sm text-muted-foreground" aria-label={t('catalogue.breadcrumb')}>
        <Link href="/" className="hover:text-foreground">
          {t('nav.home')}
        </Link>
        {' / '}
        <Link href={BASE[kind]} className="hover:text-foreground">
          {t(TITLE_KEY[kind])}
        </Link>
        {' / '}
        <span className="text-foreground">{entry.nameAr}</span>
      </nav>

      <header className="mb-6 space-y-2">
        <h1 className="font-display text-headline font-semibold">
          {t('nav.footage')} <Bilingual ar={entry.nameAr} en={entry.nameEn} />
        </h1>
        {entry.seoDescAr ? (
          <p className="max-w-prose font-serif text-[1.05rem] text-muted-foreground">{entry.seoDescAr}</p>
        ) : null}
        <p className="numeric text-sm text-muted-foreground">
          {t('catalogue.resultsCount', { count: formatNumber(result.total) })}
        </p>
      </header>

      {result.hits.length === 0 ? (
        <EmptyState
          title={t('catalogue.noResultsTitle')}
          description={t('catalogue.noResultsBody')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.hits.map((clip) => (
            <ClipCard key={clip.id} clip={clip} />
          ))}
        </div>
      )}
    </div>
  )
}

function BreadcrumbJsonLd({
  kind,
  entry,
}: {
  kind: Kind
  entry: { slug: string; nameAr: string }
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t('nav.home'), item: SITE_URL },
      {
        '@type': 'ListItem',
        position: 2,
        name: t(TITLE_KEY[kind]),
        item: `${SITE_URL}${BASE[kind]}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: entry.nameAr,
        item: `${SITE_URL}${BASE[kind]}/${entry.slug}`,
      },
    ],
  }
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  )
}
