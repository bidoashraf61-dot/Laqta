import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { AlbumCard, type AlbumCardData } from '@/components/catalogue/album-card'
import { EmptyState } from '@/components/ui/state'
import { formatNumber, t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'
import { requestLocale } from '@/lib/locale-request'
import { localeAlternates } from '@/lib/locale'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('catalogue.albumsTitle'),
    description: t('catalogue.albumsSubtitle'),
    alternates: localeAlternates('/albums'),
  }
}

export default async function AlbumsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>
}) {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

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
    creatorNameEn: row.creator.displayNameEn,
    titleAr: row.titleAr,
    titleEn: row.titleEn,
    priceStandard: Number(row.priceStandard),
    compareAtPrice: row.compareAtPrice == null ? null : Number(row.compareAtPrice),
    offerLabelAr: row.offerLabelAr,
    offerLabelEn: row.offerLabelEn,
    currency: row.currency,
    clipCount: row.clipCount,
    totalRuntimeS: row.totalRuntimeS,
    clearedForCommercial: row.clearedForCommercial,
    coverKey: row.coverClipId ? (coverById.get(row.coverClipId) ?? null) : null,
  }))

  return (
    <div className="container-tight py-16">
      <header className="mb-6 space-y-1">
        <PageTitle>{t('catalogue.albumsTitle')}</PageTitle>
        <p className="text-muted-foreground">
          {t('catalogue.albumsSubtitle')} ·{' '}
          <span className="numeric">{formatNumber(albums.length)}</span>
        </p>
      </header>

      {albums.length === 0 ? (
        <EmptyState title={t('state.empty')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {albums.map((album, i) => (
            <AlbumCard key={`${album.creatorHandle}/${album.slug}`} album={album} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
