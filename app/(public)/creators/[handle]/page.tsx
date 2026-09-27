import type { Metadata } from 'next'
import { OFFER_SELECT, priceNow } from '@/lib/offers'
import { Eye, Film, Layers, Star } from 'lucide-react'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { AlbumCard, type AlbumCardData } from '@/components/catalogue/album-card'
import { Bilingual } from '@/components/ui/bilingual'
import { EmptyState } from '@/components/ui/state'
import { Stars } from '@/components/ui/stars'
import { t, formatNumber, formatDate } from '@/lib/i18n'
import { PageTitle, SubHeadline } from '@/components/ui/typography'
import { currentLocale, localeAlternates, localePath, pickLocalised } from '@/lib/locale'
import { REVEAL } from '@/lib/motion'
import { requestLocale } from '@/lib/locale-request'

const SITE_URL = process.env.AUTH_URL ?? 'http://localhost:3000'

async function getCreator(handle: string) {
  return db.creator.findFirst({
    where: { handle, status: 'approved' },
    select: {
      handle: true,
      displayNameAr: true,
      displayNameEn: true,
      bioAr: true,
      bioEn: true,
      cityAr: true,
      cityEn: true,
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
          ...OFFER_SELECT,
          currency: true,
          clipCount: true,
          totalRuntimeS: true,
          origin: true,
          orientation: true,
          coverClipId: true,
          isFeatured: true,
          viewCount: true,
          ratingAvg: true,
          ratingCount: true,
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
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  const { handle } = await params
  const creator = await getCreator(handle)
  if (!creator) return { title: t('state.notFound') }
  return {
    title: pickLocalised(creator.displayNameAr, creator.displayNameEn),
    description: pickLocalised(creator.bioAr, creator.bioEn) ?? undefined,
    // Each language its own canonical, both linked (DEV-33).
    alternates: localeAlternates(`/creators/${handle}`),
  }
}

export default async function CreatorPage({ params }: { params: Promise<{ handle: string }> }) {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

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
    creatorNameEn: creator.displayNameEn,
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

  const totalClips = creator.albums.reduce((sum, a) => sum + a.clipCount, 0)
  const totalViews = creator.albums.reduce((sum, a) => sum + a.viewCount, 0)
  const joined = creator.approvedAt ? formatDate(creator.approvedAt) : '—'
  const featuredSlugs = new Set(creator.albums.filter((a) => a.isFeatured).map((a) => a.slug))

  /*
   * The creator's rating: the weighted mean across their live albums.
   *
   * Weighted by review count, not a mean of the averages — an album with one
   * five-star review would otherwise pull as hard as one with ninety averaging
   * 4.6, which is how a new seller with one friendly buyer outranks the best
   * work in the catalogue.
   */
  let weighted = 0
  let ratingTotal = 0
  for (const album of creator.albums) {
    if (!album.ratingCount || album.ratingAvg == null) continue
    weighted += Number(album.ratingAvg) * album.ratingCount
    ratingTotal += album.ratingCount
  }
  const rating = ratingTotal > 0 ? weighted / ratingTotal : null

  const bigNumber = 'numeric font-display text-3xl font-bold leading-none'
  const stats = [
    {
      icon: Layers,
      label: t('catalogue.creatorAlbums'),
      value: <span className={bigNumber}>{formatNumber(albums.length)}</span>,
    },
    {
      icon: Film,
      label: t('catalogue.creatorClips'),
      value: <span className={bigNumber}>{formatNumber(totalClips)}</span>,
    },
    {
      icon: Eye,
      label: t('catalogue.creatorViews'),
      value: <span className={bigNumber}>{formatNumber(totalViews)}</span>,
    },
    {
      icon: Star,
      label: t('catalogue.creatorRating'),
      // "No ratings yet" and "0.0" are different facts, and five empty stars
      // says the second when the first is true.
      value:
        rating == null ? (
          <span className="text-sm text-muted-foreground">{t('catalogue.creatorNoRating')}</span>
        ) : (
          <span className="flex items-baseline gap-2">
            <span className={bigNumber}>{rating.toFixed(1)}</span>
            <Stars
              value={rating}
              count={ratingTotal}
              label={t('review.ratingSummary', {
                value: rating.toFixed(1),
                count: String(ratingTotal),
              })}
            />
          </span>
        ),
    },
  ]
  const featured = albums.filter((a) => featuredSlugs.has(a.slug))

  // On a marketplace the creators ARE the expertise signal — E-E-A-T's first
  // two letters. The profile emitted no schema at all, so an engine had a page
  // full of authorship evidence and no way to read it as a person.
  const personLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: pickLocalised(creator.displayNameAr, creator.displayNameEn),
      alternateName: creator.displayNameEn,
      url: `${SITE_URL}${localePath(currentLocale(), `/creators/${creator.handle}`)}`,
      ...(pickLocalised(creator.bioAr, creator.bioEn)
        ? { description: pickLocalised(creator.bioAr, creator.bioEn) as string }
        : {}),
      ...(creator.user?.image ? { image: creator.user.image } : {}),
      ...(pickLocalised(creator.cityAr, creator.cityEn)
        ? {
            homeLocation: {
              '@type': 'Place',
              name: pickLocalised(creator.cityAr, creator.cityEn),
            },
          }
        : {}),
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
            alt={t('catalogue.altCreatorAvatar', {
              name: pickLocalised(creator.displayNameAr, creator.displayNameEn),
            })}
            className="size-20 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            role="img"
            aria-label={t('catalogue.altCreatorAvatar', {
              name: pickLocalised(creator.displayNameAr, creator.displayNameEn),
            })}
            className="grid size-20 shrink-0 place-items-center rounded-full bg-secondary font-display text-3xl font-bold"
          >
            {pickLocalised(creator.displayNameAr, creator.displayNameEn).charAt(0)}
          </span>
        )}
        <div className="min-w-0 space-y-2">
          <PageTitle>
            <Bilingual ar={creator.displayNameAr} en={creator.displayNameEn} />
          </PageTitle>
          {pickLocalised(creator.cityAr, creator.cityEn) ? (
            <p className="text-sm text-muted-foreground">
              {pickLocalised(creator.cityAr, creator.cityEn)}
            </p>
          ) : null}
          {pickLocalised(creator.bioAr, creator.bioEn) ? (
            <p className="max-w-prose font-serif text-base text-muted-foreground">
              {pickLocalised(creator.bioAr, creator.bioEn)}
            </p>
          ) : null}
        </div>
      </header>

      {/*
        Public analytics only.

        Views and catalogue size are the creator's shopfront and help a buyer
        judge them. Sales counts and revenue are NOT here: they are the
        creator's commercial position, and publishing them on a profile they
        cannot opt out of would expose it to their competitors and clients.

        ── Why the labels are long ─────────────────────────────────────────────
        They used to be «ألبوم منشور · لقطة · مشاهدة · عضو منذ», and the third
        one made the whole row unreadable: 9,219 views of WHAT? Of the footage?
        Of a page? Counted how? A number whose unit is ambiguous is worse than
        no number, because a reader will assume the most flattering reading and
        then feel misled. Each label now names its unit in full, even where that
        costs a line.
      */}
      <dl className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-card p-5" {...REVEAL}>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs leading-snug text-muted-foreground">{stat.label}</dt>
              <span
                aria-hidden
                className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground"
              >
                <stat.icon className="size-4" />
              </span>
            </div>
            <dd className="mt-2">{stat.value}</dd>
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
                {featured.map((album, i) => (
                  <AlbumCard key={album.slug} album={album} index={i} />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <SubHeadline as="h2" size="panel" weight="strong" className="mb-4">
              {t('catalogue.creatorAll')}
            </SubHeadline>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {albums.map((album, i) => (
                <AlbumCard key={album.slug} album={album} index={i} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
