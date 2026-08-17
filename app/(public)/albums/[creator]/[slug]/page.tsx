import type { Metadata } from 'next'
import { Link } from '@/components/ui/link'
import { notFound } from 'next/navigation'
import { BadgeCheck, Download, FileText, Receipt } from 'lucide-react'
import { db } from '@/lib/db'
import { formatMoney, t } from '@/lib/i18n'
import { formatBytes, formatDuration, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/toggles'
import { Bilingual } from '@/components/ui/bilingual'
import { AlbumCard } from '@/components/catalogue/album-card'
import { LicencePicker } from '@/components/catalogue/licence-picker'
import { PreviewWatermark } from '@/components/catalogue/watermark'
import { ClipContactSheet } from '@/components/catalogue/clip-contact-sheet'
import { PageTitle } from '@/components/ui/typography'
import { AlbumReviews } from '@/components/catalogue/reviews'
import { getAlbumReviews, getOwnReview, ownsAlbum } from '@/lib/reviews'
import { auth } from '@/lib/auth'
import { AutoplayVideo } from '@/components/catalogue/autoplay-video'
import { requestLocale } from '@/lib/locale-request'
import { pickLocalised } from '@/lib/locale'

const SITE_URL = process.env.AUTH_URL ?? 'http://localhost:3000'

/**
 * The album PDP — the conversion page.
 *
 * Treated as an e-commerce product page, not a gallery. The three things that
 * actually close the sale are all above the fold or one scroll away: the full
 * clip grid (buyers must see exactly what they get — total transparency is the
 * whole pitch against a subscription), the price with both licence tiers, and
 * the clearance badges agencies filter on.
 */

async function getAlbum(creatorHandle: string, slug: string) {
  return db.album.findFirst({
    where: { slug, status: 'live', creator: { handle: creatorHandle } },
    include: {
      creator: {
        select: {
          handle: true,
          displayNameAr: true,
          displayNameEn: true,
          bioAr: true,
          cityAr: true,
          cityEn: true,
          country: true,
        },
      },
      licenceVersion: { select: { titleAr: true, titleEn: true, bodyAr: true, bodyEn: true } },
      taxonomy: {
        select: { taxonomy: { select: { kind: true, slug: true, nameAr: true, nameEn: true } } },
      },
      clips: {
        orderBy: { orderIndex: 'asc' },
        select: {
          id: true,
          slug: true,
          titleAr: true,
          titleEn: true,
          durationS: true,
          width: true,
          height: true,
          fps: true,
          codec: true,
          colourProfile: true,
          aspectRatio: true,
          thumbnailKeys: true,
          // masterKey is never selected here — the catalogue must not be able
          // to reference an original.
        },
      },
    },
  })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ creator: string; slug: string }>
}): Promise<Metadata> {
  const { creator, slug } = await params
  const album = await getAlbum(creator, slug)
  if (!album) return { title: t('state.notFound') }

  return {
    title: pickLocalised(album.titleAr, album.titleEn),
    description:
      pickLocalised(album.descriptionAr, album.descriptionEn) ?? t('catalogue.albumsSubtitle'),
    alternates: { canonical: `/albums/${creator}/${slug}` },
    openGraph: {
      type: 'website',
      locale: 'ar_SA',
      title: pickLocalised(album.titleAr, album.titleEn),
      description: pickLocalised(album.descriptionAr, album.descriptionEn) ?? '',
      images: album.clips[0]?.thumbnailKeys[0] ? [album.clips[0].thumbnailKeys[0]] : [],
    },
  }
}

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ creator: string; slug: string }>
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

  const { creator: creatorHandle, slug } = await params
  const album = await getAlbum(creatorHandle, slug)
  if (!album) notFound()

  const session = await auth()
  const [reviews, owns, ownReview] = await Promise.all([
    getAlbumReviews(album.id),
    session?.user?.id ? ownsAlbum(session.user.id, album.id) : Promise.resolve(false),
    session?.user?.id ? getOwnReview(session.user.id, album.id) : Promise.resolve(null),
  ])

  const others = await db.album.findMany({
    where: { status: 'live', creatorId: album.creatorId, id: { not: album.id } },
    take: 4,
    select: {
      slug: true,
      titleAr: true,
      titleEn: true,
      priceStandard: true,
      ratingAvg: true,
      ratingCount: true,
      trailerKey: true,
      compareAtPrice: true,
      offerLabelAr: true,
      offerLabelEn: true,
      currency: true,
      clipCount: true,
      totalRuntimeS: true,
      origin: true,
      orientation: true,
      coverClipId: true,
      creator: { select: { handle: true, displayNameAr: true, displayNameEn: true } },
    },
  })

  const coverIds = others.map((row) => row.coverClipId).filter(Boolean) as string[]
  const covers = coverIds.length
    ? await db.clip.findMany({
        where: { id: { in: coverIds } },
        select: { id: true, thumbnailKeys: true },
      })
    : []
  const coverById = new Map(covers.map((clip) => [clip.id, clip.thumbnailKeys[0] ?? null]))

  const priceStandard = Number(album.priceStandard)
  const hero = album.clips[0]?.thumbnailKeys[0] ?? null

  return (
    <div className="container-tight py-16">
      <ProductJsonLd
        album={album}
        priceStandard={priceStandard}
        url={`${SITE_URL}/albums/${creatorHandle}/${slug}`}
      />

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-8">
          {/* The trailer, large and first: a buyer judges an album by how it
              cuts, not by one frame. Where no trailer has been produced the
              cover still stands in — an empty player would read as broken
              rather than as "not made yet". */}
          <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
            {album.trailerKey ? (
              <AutoplayVideo
                src={album.trailerKey}
                poster={hero}
                label={t('media.trailerAlt', {
                  album: pickLocalised(album.titleAr, album.titleEn),
                })}
                className="size-full rounded-none border-0"
              />
            ) : hero ? (
              <img
                src={hero}
                alt={t('catalogue.altAlbumCover', {
                  album: pickLocalised(album.titleAr, album.titleEn),
                  count: String(album.clipCount),
                })}
                className="size-full object-cover"
              />
            ) : (
              <div className="grid size-full place-items-center bg-gradient-to-br from-ink to-secondary">
                <span className="text-4xl font-bold text-gold/30">{t('brand.name')}</span>
              </div>
            )}
            <PreviewWatermark />
            <Badge variant="film" className="absolute end-3 top-3 z-[2]">
              {t('catalogue.previewWatermarked')}
            </Badge>
          </div>

          <header className="space-y-3">
            <PageTitle>
              <Bilingual ar={album.titleAr} en={album.titleEn} />
            </PageTitle>
            <p className="text-muted-foreground">
              <Link href={`/creators/${album.creator.handle}`} className="hover:text-foreground">
                {t('commerce.byCreator', {
                  creator: pickLocalised(album.creator.displayNameAr, album.creator.displayNameEn),
                })}
              </Link>
            </p>
            {pickLocalised(album.descriptionAr, album.descriptionEn) ? (
              <p className="max-w-prose font-serif text-[1.2rem] leading-[1.85] text-foreground/75">
                {pickLocalised(album.descriptionAr, album.descriptionEn)}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              {album.taxonomy.map(({ taxonomy }) => (
                <Link
                  key={`${taxonomy.kind}-${taxonomy.slug}`}
                  href={
                    taxonomy.kind === 'location'
                      ? `/locations/${taxonomy.slug}`
                      : `/categories/${taxonomy.slug}`
                  }
                >
                  <Badge variant="neutral">{pickLocalised(taxonomy.nameAr, taxonomy.nameEn)}</Badge>
                </Link>
              ))}
            </div>
          </header>

          <Separator />

          <section>
            <h2 className="mb-4 font-subhead text-xl font-bold">
              {t('catalogue.clipsInAlbum')}{' '}
              <span className="numeric text-muted-foreground">({album.clips.length})</span>
            </h2>
            {/* Every clip at its own aspect — see ClipContactSheet for why a
                fixed-column grid could not do this without cropping. */}
            <ClipContactSheet clips={album.clips} />
          </section>

          <Separator />

          <section className="space-y-3">
            <h2 className="font-subhead text-xl font-bold">{t('catalogue.specs')}</h2>
            <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
              <Spec label={t('catalogue.clipCountLabel')} value={String(album.clipCount)} numeric />
              <Spec
                label={t('catalogue.totalRuntime')}
                value={formatDuration(album.totalRuntimeS)}
                numeric
              />
              {/* Total download size matters to a buyer on a Saudi office
                  connection — 40GB is a planning decision, not a detail. */}
              <Spec
                label={t('catalogue.totalSize')}
                value={formatBytes(album.totalSizeBytes)}
                numeric
              />
              <Spec
                label={t('catalogue.dimensions')}
                value={album.clips[0] ? `${album.clips[0].width}×${album.clips[0].height}` : '—'}
                numeric
              />
              <Spec label={t('catalogue.codec')} value={album.clips[0]?.codec ?? '—'} />
              <Spec
                label={t('catalogue.colourProfile')}
                value={album.clips[0]?.colourProfile ?? '—'}
              />
            </dl>
          </section>

          <section className="space-y-3">
            <h2 className="font-subhead text-xl font-bold">{t('catalogue.clearance')}</h2>
            <div className="flex flex-wrap gap-2">
              {album.clearedForCommercial ? (
                <Badge variant="success" className="gap-1">
                  <BadgeCheck className="size-3.5" />
                  {t('catalogue.clearanceFull')}
                </Badge>
              ) : album.clearanceStatus === 'editorial_only' ? (
                <Badge variant="warning">{t('catalogue.clearanceEditorial')}</Badge>
              ) : (
                <Badge variant="neutral">{t('catalogue.clearancePending')}</Badge>
              )}
            </div>
            {album.licenceVersion ? (
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                {pickLocalised(album.licenceVersion.bodyAr, album.licenceVersion.bodyEn)}
              </p>
            ) : null}
          </section>

          {others.length > 0 ? (
            <section>
              <h2 className="mb-4 font-subhead text-xl font-bold">
                {t('catalogue.byCreatorOther')}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {others.map((other, i) => (
                  <AlbumCard
                    key={other.slug}
                    index={i}
                    album={{
                      slug: other.slug,
                      creatorHandle: other.creator.handle,
                      creatorNameAr: other.creator.displayNameAr,
                      creatorNameEn: other.creator.displayNameEn,
                      titleAr: other.titleAr,
                      titleEn: other.titleEn,
                      priceStandard: Number(other.priceStandard),
                      compareAtPrice:
                        other.compareAtPrice == null ? null : Number(other.compareAtPrice),
                      offerLabelAr: other.offerLabelAr,
                      offerLabelEn: other.offerLabelEn,
                      currency: other.currency,
                      clipCount: other.clipCount,
                      totalRuntimeS: other.totalRuntimeS,
                      origin: other.origin,
                      orientation: other.orientation,
                      coverKey: other.coverClipId
                        ? (coverById.get(other.coverClipId) ?? null)
                        : null,
                    }}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {/* Sticky price block. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <LicencePicker
            albumSlug={album.slug}
            creatorHandle={album.creator.handle}
            priceStandard={priceStandard}
            compareAtPrice={album.compareAtPrice ? Number(album.compareAtPrice) : null}
            currency={album.currency}
          />

          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Download className="size-4 text-gold" />
              {t('commerce.instantDownload')}
            </li>
            <li className="flex items-center gap-2">
              <FileText className="size-4 text-gold" />
              {t('commerce.ownForever')}
            </li>
            <li className="flex items-center gap-2">
              <Receipt className="size-4 text-gold" />
              {t('commerce.taxInvoice')}
            </li>
          </ul>
        </aside>
      </div>

      <div className="mt-14">
        <AlbumReviews
          albumId={album.id}
          reviews={reviews}
          ratingAvg={album.ratingAvg == null ? null : Number(album.ratingAvg)}
          ratingCount={album.ratingCount}
          canReview={owns}
          ownReview={ownReview}
          signedIn={session?.user?.id != null}
        />
      </div>
    </div>
  )
}

/**
 * A spec row.
 *
 * Values that came back from `specLabel` still in Latin — codec names, camera
 * models, colour profiles — are wrapped in `.ltr-island`. Without that,
 * "Rec.709" renders as "709.Rec" beside Arabic, and "DJI Inspire 3" loses its
 * number to the wrong end of the line.
 */
function Spec({ label, value, numeric }: { label: string; value: string; numeric?: boolean }) {
  const latin = !numeric && /[A-Za-z]/.test(value)
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn('text-sm font-medium', numeric && 'numeric', latin && 'ltr-island')}>
        {value}
      </dd>
    </div>
  )
}

function ProductJsonLd({
  album,
  priceStandard,
  url,
}: {
  album: {
    titleAr: string
    titleEn: string
    descriptionAr: string | null
    descriptionEn: string | null
    currency: string
    ratingAvg: unknown
    ratingCount: number
  }
  priceStandard: number
  url: string
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: pickLocalised(album.titleAr, album.titleEn),
    description: pickLocalised(album.descriptionAr, album.descriptionEn) ?? undefined,
    url,
    offers: {
      '@type': 'Offer',
      price: priceStandard,
      priceCurrency: album.currency,
      availability: 'https://schema.org/InStock',
      url,
    },
    // §A3 asks for AggregateRating "when reviews exist" — and only then.
    // Emitting a rating block with zero reviews is a structured-data
    // violation Google penalises, not a harmless empty field.
    ...(album.ratingCount > 0 && album.ratingAvg != null
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(album.ratingAvg).toFixed(1),
            reviewCount: album.ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  }
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  )
}
