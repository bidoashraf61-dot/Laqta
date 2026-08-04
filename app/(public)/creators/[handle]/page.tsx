import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { AlbumCard, type AlbumCardData } from '@/components/catalogue/album-card'
import { Bilingual } from '@/components/ui/bilingual'
import { EmptyState } from '@/components/ui/state'
import { t } from '@/lib/i18n'

async function getCreator(handle: string) {
  return db.creator.findFirst({
    where: { handle, status: 'approved' },
    select: {
      handle: true,
      displayNameAr: true,
      displayNameEn: true,
      bioAr: true,
      city: true,
      country: true,
      albums: {
        where: { status: 'live' },
        orderBy: { publishedAt: 'desc' },
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
        },
      },
    },
  })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  const creator = await getCreator(handle)
  if (!creator) return { title: t('state.notFound') }
  return {
    title: creator.displayNameAr,
    description: creator.bioAr ?? undefined,
    alternates: { canonical: `/creators/${handle}` },
  }
}

export default async function CreatorPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const creator = await getCreator(handle)
  if (!creator) notFound()

  const coverIds = creator.albums.map((album) => album.coverClipId).filter(Boolean) as string[]
  const covers = coverIds.length
    ? await db.clip.findMany({
        where: { id: { in: coverIds } },
        select: { id: true, thumbnailKeys: true },
      })
    : []
  const coverById = new Map(covers.map((clip) => [clip.id, clip.thumbnailKeys[0] ?? null]))

  const albums: AlbumCardData[] = creator.albums.map((album) => ({
    slug: album.slug,
    creatorHandle: creator.handle,
    creatorNameAr: creator.displayNameAr,
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
      <header className="mb-8 flex items-start gap-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-secondary text-2xl font-semibold">
          {creator.displayNameAr.charAt(0)}
        </span>
        <div className="min-w-0 space-y-1">
          <h1 className="text-headline font-semibold">
            <Bilingual ar={creator.displayNameAr} en={creator.displayNameEn} />
          </h1>
          <p className="text-sm text-muted-foreground">
            {creator.city ? `${creator.city} · ` : ''}
            <span className="numeric">{albums.length}</span> {t('commerce.album')}
          </p>
          {creator.bioAr ? (
            <p className="max-w-prose pt-2 text-muted-foreground">{creator.bioAr}</p>
          ) : null}
        </div>
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
