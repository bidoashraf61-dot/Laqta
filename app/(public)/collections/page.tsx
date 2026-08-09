import { SubHeadline, PageTitle } from '@/components/ui/typography'
import type { Metadata } from 'next'
import { Link } from '@/components/ui/link'
import { db } from '@/lib/db'
import { Bilingual } from '@/components/ui/bilingual'
import { EmptyState } from '@/components/ui/state'
import { t } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'
import { localeAlternates } from '@/lib/locale'
import { pickLocalised } from '@/lib/locale'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('catalogue.collectionsTitle'),
    alternates: localeAlternates('/collections'),
  }
}

export default async function CollectionsPage() {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const collections = await db.collection.findMany({
    where: { isPublished: true },
    orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
    select: {
      slug: true,
      titleAr: true,
      titleEn: true,
      descriptionAr: true,
      descriptionEn: true,
      heroMedia: true,
      _count: { select: { albums: true } },
    },
  })

  return (
    <div className="container-tight py-16">
      <PageTitle className="mb-6">{t('catalogue.collectionsTitle')}</PageTitle>
      {collections.length === 0 ? (
        <EmptyState title={t('state.empty')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <Link
              key={collection.slug}
              href={`/collections/${collection.slug}`}
              className="group relative isolate overflow-hidden rounded-lg border bg-card p-6 transition-colors hover:border-foreground/25"
            >
              {collection.heroMedia ? (
                <img
                  src={collection.heroMedia}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 -z-10 size-full object-cover opacity-25"
                />
              ) : null}
              {/* h2, not h3: this grid sits directly under the page h1 with no
                  section heading in between, so h3 would skip a level. The same
                  card on the landing page is an h3 because a section h2 heads it
                  there — the level belongs to the position, not the component. */}
              <SubHeadline as="h2" size="card" className="group-hover:text-foreground">
                <Bilingual ar={collection.titleAr} en={collection.titleEn} />
              </SubHeadline>
              {pickLocalised(collection.descriptionAr, collection.descriptionEn) ? (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {pickLocalised(collection.descriptionAr, collection.descriptionEn)}
                </p>
              ) : null}
              <p className="numeric mt-3 text-xs text-muted-foreground">
                {collection._count.albums} {t('commerce.album')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
