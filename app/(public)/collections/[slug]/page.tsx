import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { AlbumCard, type AlbumCardData } from '@/components/catalogue/album-card'
import { Bilingual } from '@/components/ui/bilingual'
import { EmptyState } from '@/components/ui/state'
import { t } from '@/lib/i18n'

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
              currency: true,
              clipCount: true,
              totalRuntimeS: true,
              clearedForCommercial: true,
              coverClipId: true,
              creator: { select: { handle: true, displayNameAr: true } },
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
  return {
    title: collection.titleAr,
    description: collection.descriptionAr ?? undefined,
    alternates: { canonical: `/collections/${slug}` },
  }
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
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
    titleAr: album.titleAr,
    titleEn: album.titleEn,
    priceStandard: Number(album.priceStandard),
    currency: album.currency,
    clipCount: album.clipCount,
    totalRuntimeS: album.totalRuntimeS,
    clearedForCommercial: album.clearedForCommercial,
    coverKey: album.coverClipId ? (coverById.get(album.coverClipId) ?? null) : null,
  }))

  return (
    <div className="container py-10">
      <header className="mb-6 space-y-2">
        <h1 className="font-display text-headline font-semibold">
          <Bilingual ar={collection.titleAr} en={collection.titleEn} />
        </h1>
        {collection.descriptionAr ? (
          <p className="max-w-prose text-muted-foreground">{collection.descriptionAr}</p>
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
