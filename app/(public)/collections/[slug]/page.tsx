import type { Metadata } from 'next'
import { OFFER_SELECT, priceNow } from '@/lib/offers'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { AlbumCard, type AlbumCardData } from '@/components/catalogue/album-card'
import { Bilingual } from '@/components/ui/bilingual'
import { EmptyState } from '@/components/ui/state'
import { t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'
import { localeAlternates, pickLocalised } from '@/lib/locale'
import { requestLocale } from '@/lib/locale-request'

async function getCollection(slug: string) {
  return db.collection.findFirst({
    where: { slug, isPublished: true },
    include: {
      albums: {
        orderBy: { sortOrder: 'asc' },
        include: {
          album: {
            select: {
              slug: true,
              status: true,
              titleAr: true,
              titleEn: true,
              ...OFFER_SELECT,
              currency: true,
              clipCount: true,
              totalRuntimeS: true,
              origin: true,
              orientation: true,
              coverClipId: true,
              creator: { select: { handle: true, displayNameAr: true, displayNameEn: true } },
            },
          },
        },
      },
    },
  })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  const { slug } = await params
  const collection = await getCollection(slug)
  if (!collection) return { title: t('state.notFound') }

  // A collection with no live albums renders eighteen words and a heading.
  // It is dropped from the sitemap, and noindexed here too — a page that is
  // merely absent from the sitemap can still be found and indexed through an
  // internal link, and thirty of these drag the whole domain. `follow` stays
  // on so the crawler still walks through to whatever is linked from it.
  const empty = collection.albums.every((row) => row.album.status !== 'live')

  return {
    title: pickLocalised(collection.titleAr, collection.titleEn),
    description: pickLocalised(collection.descriptionAr, collection.descriptionEn) ?? undefined,
    // Each language its own canonical, both linked (DEV-33).
    alternates: localeAlternates(`/collections/${slug}`),
    ...(empty ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const { slug } = await params
  const collection = await getCollection(slug)
  if (!collection) notFound()

  const live = collection.albums.map((row) => row.album).filter((album) => album.status === 'live')

  const coverIds = live.map((album) => album.coverClipId).filter(Boolean) as string[]
  const covers = coverIds.length
    ? await db.clip.findMany({
        where: { id: { in: coverIds } },
        select: { id: true, thumbnailKeys: true },
      })
    : []
  const coverById = new Map(covers.map((clip) => [clip.id, clip.thumbnailKeys[0] ?? null]))

  const albums: AlbumCardData[] = live.map((album) => ({
    slug: album.slug,
    creatorHandle: album.creator.handle,
    creatorNameAr: album.creator.displayNameAr,
    creatorNameEn: album.creator.displayNameEn,
    titleAr: album.titleAr,
    titleEn: album.titleEn,
    // The price paid NOW and the struck regular price, per the offer's dates (lib/offers.ts).
    ...priceNow(album),
    currency: album.currency,
    clipCount: album.clipCount,
    totalRuntimeS: album.totalRuntimeS,
    origin: album.origin,
    orientation: album.orientation,
    coverKey: album.coverClipId ? (coverById.get(album.coverClipId) ?? null) : null,
  }))

  return (
    <div className="container py-10">
      <header className="mb-6 space-y-2">
        <PageTitle>
          <Bilingual ar={collection.titleAr} en={collection.titleEn} />
        </PageTitle>
        {pickLocalised(collection.descriptionAr, collection.descriptionEn) ? (
          <p className="max-w-prose text-muted-foreground">
            {pickLocalised(collection.descriptionAr, collection.descriptionEn)}
          </p>
        ) : null}
      </header>

      {albums.length === 0 ? (
        <EmptyState title={t('state.empty')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {albums.map((album, i) => (
            <AlbumCard key={album.slug} album={album} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
