import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { AlbumCard, type AlbumCardData } from '@/components/catalogue/album-card'
import { EmptyState } from '@/components/ui/state'
import { formatNumber, t } from '@/lib/i18n'

export const metadata: Metadata = {
  title: t('catalogue.albumsTitle'),
  description: t('catalogue.albumsSubtitle'),
  alternates: { canonical: '/albums' },
}

export default async function AlbumsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>
}) {
  const { sort } = await searchParams

  const rows = await db.album.findMany({
    where: { status: 'live' },
    orderBy:
      sort === 'new'
        ? { publishedAt: 'desc' }
        : sort === 'priceAsc'
          ? { priceStandard: 'asc' }
          : [{ isFeatured: 'desc' }, { salesCount: 'desc' }],
    select: {
      slug: true,
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
  })

  const coverIds = rows.map((row) => row.coverClipId).filter(Boolean) as string[]
  const covers = coverIds.length
    ? await db.clip.findMany({
        where: { id: { in: coverIds } },
        select: { id: true, thumbnailKeys: true },
      })
    : []
  const coverById = new Map(covers.map((clip) => [clip.id, clip.thumbnailKeys[0] ?? null]))

  const albums: AlbumCardData[] = rows.map((row) => ({
    slug: row.slug,
    creatorHandle: row.creator.handle,
    creatorNameAr: row.creator.displayNameAr,
    titleAr: row.titleAr,
    titleEn: row.titleEn,
    priceStandard: Number(row.priceStandard),
    currency: row.currency,
    clipCount: row.clipCount,
    totalRuntimeS: row.totalRuntimeS,
    clearedForCommercial: row.clearedForCommercial,
    coverKey: row.coverClipId ? (coverById.get(row.coverClipId) ?? null) : null,
  }))

  return (
    <div className="container-tight py-16">
      <header className="mb-6 space-y-1">
        <h1 className="text-headline font-semibold">{t('catalogue.albumsTitle')}</h1>
        <p className="text-muted-foreground">
          {t('catalogue.albumsSubtitle')} ·{' '}
          <span className="numeric">{formatNumber(albums.length)}</span>
        </p>
      </header>

      {albums.length === 0 ? (
        <EmptyState title={t('state.empty')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {albums.map((album) => (
            <AlbumCard key={`${album.creatorHandle}/${album.slug}`} album={album} />
          ))}
        </div>
      )}
    </div>
  )
}
