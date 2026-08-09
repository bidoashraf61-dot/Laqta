import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { AlbumCard, type AlbumCardData } from '@/components/catalogue/album-card'
import { Bilingual } from '@/components/ui/bilingual'
import { EmptyState } from '@/components/ui/state'
import { t, formatNumber, formatDate } from '@/lib/i18n'
import { PageTitle, SubHeadline } from '@/components/ui/typography'

const SITE_URL = process.env.AUTH_URL ?? 'http://localhost:3000'

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
      approvedAt: true,
      user: { select: { image: true } },
      albums: {
        where: { status: 'live' },
        orderBy: { publishedAt: 'desc' },
        select: {
          slug: true,
          titleAr: true,
          titleEn: true,
          priceStandard: true,
          compareAtPrice: true,
          offerLabelAr: true,
          currency: true,
          clipCount: true,
          totalRuntimeS: true,
          clearedForCommercial: true,
          coverClipId: true,
          isFeatured: true,
          viewCount: true,
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
    compareAtPrice: album.compareAtPrice == null ? null : Number(album.compareAtPrice),
    offerLabelAr: album.offerLabelAr,
    currency: album.currency,
    clipCount: album.clipCount,
    totalRuntimeS: album.totalRuntimeS,
    clearedForCommercial: album.clearedForCommercial,
    coverKey: album.coverClipId ? (coverById.get(album.coverClipId) ?? null) : null,
  }))

  const totalClips = creator.albums.reduce((sum, a) => sum + a.clipCount, 0)
  const totalViews = creator.albums.reduce((sum, a) => sum + a.viewCount, 0)
  const joined = creator.approvedAt ? formatDate(creator.approvedAt) : '—'
  const featuredSlugs = new Set(creator.albums.filter((a) => a.isFeatured).map((a) => a.slug))
  const featured = albums.filter((a) => featuredSlugs.has(a.slug))

  // On a marketplace the creators ARE the expertise signal — E-E-A-T's first
  // two letters. The profile emitted no schema at all, so an engine had a page
  // full of authorship evidence and no way to read it as a person.
  const personLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: creator.displayNameAr,
      alternateName: creator.displayNameEn,
      url: `${SITE_URL}/creators/${creator.handle}`,
      ...(creator.bioAr ? { description: creator.bioAr } : {}),
      ...(creator.user?.image ? { image: creator.user.image } : {}),
      ...(creator.city ? { homeLocation: { '@type': 'Place', name: creator.city } } : {}),
      worksFor: { '@type': 'Organization', name: t('brand.name'), url: SITE_URL },
    },
  }

  return (
    <div className="container py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }}
      />
      <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-start">
        {creator.user?.image ? (
          <img
            src={creator.user.image}
            alt={t('catalogue.altCreatorAvatar', { name: creator.displayNameAr })}
            className="size-20 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            role="img"
            aria-label={t('catalogue.altCreatorAvatar', { name: creator.displayNameAr })}
            className="grid size-20 shrink-0 place-items-center rounded-full bg-secondary font-display text-3xl font-bold"
          >
            {creator.displayNameAr.charAt(0)}
          </span>
        )}
        <div className="min-w-0 space-y-2">
          <PageTitle>
            <Bilingual ar={creator.displayNameAr} en={creator.displayNameEn} />
          </PageTitle>
          {creator.city ? <p className="text-sm text-muted-foreground">{creator.city}</p> : null}
          {creator.bioAr ? (
            <p className="max-w-prose font-serif text-base text-muted-foreground">{creator.bioAr}</p>
          ) : null}
        </div>
      </header>

      {/*
        Public analytics only.
        Views and catalogue size are the creator's shopfront and help a buyer
        judge them. Sales counts and revenue are NOT here: they are the
        creator's commercial position, and publishing them on a profile they
        cannot opt out of would expose it to their competitors and clients.
      */}
      <dl className="mb-10 grid grid-cols-2 gap-4 rounded-lg border bg-card p-5 sm:grid-cols-4">
        {[
          { v: formatNumber(albums.length), k: t('catalogue.creatorAlbums') },
          { v: formatNumber(totalClips), k: t('catalogue.creatorClips') },
          { v: formatNumber(totalViews), k: t('catalogue.creatorViews') },
          { v: joined, k: t('catalogue.creatorSince') },
        ].map((s) => (
          <div key={s.k}>
            <dt className="text-xs text-muted-foreground">{s.k}</dt>
            <dd className="numeric mt-1 text-xl font-bold">{s.v}</dd>
          </div>
        ))}
      </dl>

      {albums.length === 0 ? (
        <EmptyState title={t('state.empty')} />
      ) : (
        <div className="space-y-10">
          {featured.length > 0 ? (
            <section>
              <SubHeadline as="h2" size="panel" weight="strong" className="mb-4">
                {t('catalogue.creatorFeatured')}
              </SubHeadline>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {featured.map((album) => (
                  <AlbumCard key={album.slug} album={album} />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <SubHeadline as="h2" size="panel" weight="strong" className="mb-4">
              {t('catalogue.creatorAll')}
            </SubHeadline>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {albums.map((album) => (
                <AlbumCard key={album.slug} album={album} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
