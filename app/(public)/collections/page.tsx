import { SubHeadline } from '@/components/ui/typography'
import type { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/db'
import { Bilingual } from '@/components/ui/bilingual'
import { EmptyState } from '@/components/ui/state'
import { t } from '@/lib/i18n'

export const metadata: Metadata = {
  title: t('catalogue.collectionsTitle'),
  alternates: { canonical: '/collections' },
}

export default async function CollectionsPage() {
  const collections = await db.collection.findMany({
    where: { isPublished: true },
    orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
    select: {
      slug: true,
      titleAr: true,
      titleEn: true,
      descriptionAr: true,
      heroMedia: true,
      _count: { select: { albums: true } },
    },
  })

  return (
    <div className="container-tight py-16">
      <h1 className="mb-6 font-display text-headline font-bold">{t('catalogue.collectionsTitle')}</h1>
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
              {collection.descriptionAr ? (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {collection.descriptionAr}
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
