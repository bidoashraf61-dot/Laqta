import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { AlbumCard, type AlbumCardData } from '@/components/catalogue/album-card'
import { Bilingual } from '@/components/ui/bilingual'
import { EmptyState } from '@/components/ui/state'
import { t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'
import { pickLocalised } from '@/lib/locale'
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
              priceStandard: true,
              compareAtPrice: true,
              offerLabelAr: true,
              offerLabelEn: true,
              currency: true,
              clipCount: true,
              totalRuntimeS: true,
              clearedForCommercial: true,
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
    alternates: { canonical: `/collections/${slug}` },
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
    priceStandard: Number(album.priceStandard),
    compareAtPrice: album.compareAtPrice == null ? null : Number(album.compareAtPrice),
    offerLabelAr: album.offerLabelAr,
    offerLabelEn: album.offerLabelEn,
    currency: album.currency,
    clipCount: album.clipCount,
    totalRuntimeS: album.totalRuntimeS,
    clearedForCommercial: album.clearedForCommercial,
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
          {albums.map((album) => (
            <AlbumCard key={album.slug} album={album} />
          ))}
        </div>
      )}
    </div>
  )
}
