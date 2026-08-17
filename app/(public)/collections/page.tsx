import { SubHeadline, PageTitle } from '@/components/ui/typography'
import type { Metadata } from 'next'
import { Link } from '@/components/ui/link'
import { db } from '@/lib/db'
import { Bilingual } from '@/components/ui/bilingual'
import { EmptyState } from '@/components/ui/state'
import { CollectionCovers } from '@/components/catalogue/collection-covers'
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
      // The covers of what is actually in the collection. Five is enough to
      // read as "a shelf" and few enough that the card is not fetching a
      // gallery it will only ever show one frame of at a time.
      albums: {
        orderBy: { sortOrder: 'asc' },
        take: 5,
        select: { album: { select: { coverClipId: true } } },
      },
    },
  })

  // One query for every cover, rather than one per collection.
  const coverIds = collections
    .flatMap((collection) => collection.albums.map((row) => row.album.coverClipId))
    .filter(Boolean) as string[]
  const coverClips = coverIds.length
    ? await db.clip.findMany({
        where: { id: { in: coverIds } },
        select: { id: true, thumbnailKeys: true },
      })
    : []
  const thumbById = new Map(coverClips.map((clip) => [clip.id, clip.thumbnailKeys[0] ?? null]))

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
              data-reveal
              className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-[border-color,box-shadow] duration-hover ease-lens hover:border-foreground/25 hover:shadow-lift"
            >
              {/* What is actually on the shelf. The card used to show the
                  collection's hero image at 25% opacity behind the text, which
                  announced that a picture existed without letting anyone see
                  one. */}
              <CollectionCovers
                className="aspect-video w-full"
                covers={
                  collection.albums
                    .map((row) =>
                      row.album.coverClipId ? thumbById.get(row.album.coverClipId) : null,
                    )
                    .filter(Boolean) as string[]
                }
              />

              <div className="flex flex-1 flex-col p-5">
                {/* h2, not h3: this grid sits directly under the page h1 with
                    no section heading in between, so h3 would skip a level. */}
                <SubHeadline as="h2" size="card" className="group-hover:text-foreground">
                  <Bilingual ar={collection.titleAr} en={collection.titleEn} />
                </SubHeadline>
                {pickLocalised(collection.descriptionAr, collection.descriptionEn) ? (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {pickLocalised(collection.descriptionAr, collection.descriptionEn)}
                  </p>
                ) : null}

                {/* The count, at the size of a fact rather than a footnote. It
                    is what tells a buyer whether this shelf is worth opening. */}
                <p className="mt-auto flex items-baseline gap-2 pt-4">
                  <span className="numeric font-display text-3xl font-bold leading-none text-foreground">
                    {collection._count.albums}
                  </span>
                  <span className="text-sm text-muted-foreground">{t('commerce.album')}</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
