import type { Metadata } from 'next'
import { OFFER_SELECT, priceNow } from '@/lib/offers'
import { buyableBundlesFor } from '@/lib/bundles'
import { Link } from '@/components/ui/link'
import { notFound } from 'next/navigation'
import { BadgeCheck, Download, FileText, Receipt } from 'lucide-react'
import { db } from '@/lib/db'
import { countOf, formatMoney, t } from '@/lib/i18n'
import { formatBytes, formatDuration, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/toggles'
import { Bilingual } from '@/components/ui/bilingual'
import { AlbumCard } from '@/components/catalogue/album-card'
import { LicencePicker } from '@/components/catalogue/licence-picker'
import { PreviewWatermark } from '@/components/catalogue/watermark'
import { AlbumShots } from '@/components/catalogue/album-shots'
import { AutoplayVideo } from '@/components/catalogue/autoplay-video'
import { PageTitle } from '@/components/ui/typography'
import { AlbumReviews } from '@/components/catalogue/reviews'
import { getAlbumReviews, getOwnReview, ownsAlbum } from '@/lib/reviews'
import { auth } from '@/lib/auth'
import { requestLocale } from '@/lib/locale-request'
import { absoluteMediaUrl, digitalSourceType, mediaUrl } from '@/lib/media'
import { currentLocale, localeAlternates, localePath, ogLocale, pickLocalised } from '@/lib/locale'
import { previewDeliverable } from '@/lib/previews'
import { CompDownload, compNotice } from '@/components/catalogue/comp-download'
import { getPublicSample } from '@/lib/sample'
import { siteOrigin } from '@/lib/site'

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
          previewKey: true,
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
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  const { creator, slug } = await params
  const album = await getAlbum(creator, slug)
  if (!album) return { title: t('state.notFound') }

  return {
    title: pickLocalised(album.titleAr, album.titleEn),
    description:
      pickLocalised(album.descriptionAr, album.descriptionEn) ?? t('catalogue.albumsSubtitle'),
    // Each language its own canonical, both linked (DEV-33).
    alternates: localeAlternates(`/albums/${creator}/${slug}`),
    openGraph: {
      type: 'website',
      locale: ogLocale(),
      title: pickLocalised(album.titleAr, album.titleEn),
      description: pickLocalised(album.descriptionAr, album.descriptionEn) ?? '',
      // The album's chosen cover (DEV-36), not whichever clip sorts first.
      images: [coverPoster(album)].filter((url): url is string => !!url),
    },
  }
}

export default async function AlbumPage({
  params,
  searchParams,
}: {
  params: Promise<{ creator: string; slug: string }>
  searchParams: Promise<{ comp?: string }>
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
      ...OFFER_SELECT,
      ratingAvg: true,
      ratingCount: true,
      trailerKey: true,
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

  // Price paid now + struck regular price, per the offer's dates (DEV-60).
  const pricing = priceNow(album)
  const bundles = await buyableBundlesFor(album.id)
  const priceStandard = pricing.priceStandard
  const { comp } = await searchParams
  const sample = await getPublicSample()
  const compCount = album.clips.filter((clip) => previewDeliverable(clip.previewKey)).length
  // The album's own cover frame — the operator-chosen cover clip, else the
  // first shot. Resolved through the one media resolver; null means no frame.
  const coverClip = album.clips.find((clip) => clip.id === album.coverClipId) ?? album.clips[0]
  const hero = mediaUrl(coverClip?.thumbnailKeys[0])
  // Only the album's OWN trailer. Null (none set, or no CDN to resolve a key
  // against) and the page leads with the cover still — never someone else's
  // footage standing in for this album's cut.
  const trailer = mediaUrl(album.trailerKey)

  return (
    <div className="container-tight py-16">
      <ProductJsonLd
        album={album}
        image={coverPoster(album)}
        priceStandard={priceStandard}
        url={`${siteOrigin()}${localePath(currentLocale(), `/albums/${creatorHandle}/${slug}`)}`}
      />

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-8">
          {/* The trailer, large and first: a buyer judges an album by how it
              cuts, not by one frame. Where no trailer has been produced the
              album's own cover still stands in — an empty player would read
              as broken rather than as "not made yet", and another album's
              footage would be a lie about this one. */}
          <div className="relative aspect-video overflow-hidden rounded-lg border bg-ink">
            {trailer ? (
              // The player carries its own watermark, pause control and
              // "muted" note; a second overlay here would double the mark.
              <AutoplayVideo
                src={trailer}
                poster={hero}
                label={t('media.trailerAlt', {
                  album: pickLocalised(album.titleAr, album.titleEn),
                })}
                className="size-full rounded-none border-0"
              />
            ) : (
              <>
                {hero ? (
                  <img
                    src={hero}
                    alt={t('catalogue.altAlbumCover', {
                      album: pickLocalised(album.titleAr, album.titleEn),
                      count: countOf('clip', album.clipCount),
                    })}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="grid size-full place-items-center bg-gradient-to-br from-ink to-secondary">
                    <span className="text-4xl font-bold text-gold/30">{t('brand.name')}</span>
                  </div>
                )}
                <PreviewWatermark />
              </>
            )}
            <Badge variant="film" className="absolute end-3 top-3 z-[2]">
              {t('catalogue.previewWatermarked')}
            </Badge>
          </div>

          <header className="space-y-3">
            <PageTitle>
              <Bilingual ar={album.titleAr} en={album.titleEn} />
            </PageTitle>
            <p className="text-muted-foreground">
              <Link
                href={`/creators/${album.creator.handle}`}
                className="underline underline-offset-4 transition-colors duration-hover ease-lens hover:text-foreground"
              >
                {t('commerce.byCreator', {
                  creator: pickLocalised(album.creator.displayNameAr, album.creator.displayNameEn),
                })}
              </Link>
            </p>

            {/*
              What the price is FOR, said once and said large.
              
              The count was a parenthesis on a section heading further down the
              page — «اللقطات في الألبوم (٢٢)» — which is a caption, not an
              answer. A buyer reading a price needs the quantity in the same
              glance, and it is the single fact that varies most between two
              albums at the same price.
            */}
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-1">
              {/* Only the number is LTR-isolated — see the note in
                  album-card.tsx. At display size the wrong order is glaring. */}
              <span className="font-display text-3xl font-bold text-foreground">
                {countOf('clip', album.clipCount)}
              </span>
              <span className="text-sm text-muted-foreground">
                {t('catalogue.runtimeTotal', { duration: formatDuration(album.totalRuntimeS) })}
              </span>
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
            <h2 className="mb-4 font-subhead text-xl font-bold">{t('catalogue.clipsInAlbum')}</h2>
            {/* Uniform 16:9 boxes, portrait clips letterboxed rather than
                cropped — see AlbumShots. A tile goes to the shot's own page,
                which carries the rest of the album underneath it. */}
            <AlbumShots
              shots={album.clips.map((clip) => ({
                id: clip.id,
                slug: clip.slug,
                titleAr: clip.titleAr,
                titleEn: clip.titleEn,
                durationS: Number(clip.durationS),
                thumbnailKeys: clip.thumbnailKeys,
                previewKey: clip.previewKey,
              }))}
            />
          </section>

          <Separator />

          <section className="space-y-3">
            <h2 className="font-subhead text-xl font-bold">{t('catalogue.specs')}</h2>
            <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {/* How it was made and at what resolution, stated per album
                  (DEV-20): the catalogue mixes filmed and AI-generated albums,
                  and not every album is 4K — the page has to say which. */}
              <Spec
                label={t('catalogue.origin')}
                value={album.origin === 'generated' ? t('catalogue.originGenerated') : t('catalogue.originCaptured')}
              />
              <Spec label={t('catalogue.resolution')} value={albumResolution(album)} numeric />
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
              {/* Two columns, not four.
                  
                  This page keeps a sticky price panel, so the content column is
                  ~620px — at four columns each poster was ~140px wide and the
                  title, price, discount chip and creator line ran into each
                  other. Two gives roughly the width these cards get on the
                  landing page, which is what they were designed against. */}
              <div className="grid gap-4 sm:grid-cols-2">
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
                      // The price paid NOW and the struck regular price, per the offer's dates (lib/offers.ts).
                      ...priceNow(other),
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
            compareAtPrice={pricing.compareAtPrice}
            currency={album.currency}
            clipCount={album.clipCount}
          />

          {/* Part of a bundle (DEV-62): one quiet line, the saving in plain
              text — the album's own price stays the thing this block sells. */}
          {bundles.map((bundle) => (
            <p key={bundle.slug} className="mt-4 rounded-md border bg-card px-4 py-3 text-sm">
              {t('bundle.onAlbum')}{' '}
              <Link href={`/bundles/${bundle.slug}`} className="font-medium underline underline-offset-4">
                <Bilingual ar={bundle.titleAr} en={bundle.titleEn} />
              </Link>{' '}
              <span className="text-muted-foreground">
                {t('bundle.onAlbumSave')} <span className="numeric">{formatMoney(bundle.discount, album.currency)}</span>
              </span>
            </p>
          ))}

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

          {/* Every preview as one ZIP, to test in the edit before buying.
              Counted from the previews that can actually be delivered. */}
          {compCount > 0 ? (
            <CompDownload
              kind="album"
              targetId={album.id}
              back={localePath(currentLocale(), `/albums/${creatorHandle}/${slug}`)}
              signedIn={session?.user?.id != null}
              notice={compNotice(comp)}
              fileCount={compCount}
              className="mt-5 border-t border-border/60 pt-5"
            />
          ) : null}

          {sample ? (
            <Link
              href="/sample"
              className="mt-4 inline-block text-sm underline underline-offset-4 hover:text-gold"
            >
              {t('sample.tryFirst')}
            </Link>
          ) : null}
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
/**
 * The album's resolution: what the creator declared, else the widest clip —
 * albums from before the details form have no declared value.
 */
function albumResolution(album: { resolution: string | null; clips: Array<{ width: number | null }> }) {
  if (album.resolution === 'uhd4k') return '4K'
  if (album.resolution === 'hd1080') return '1080p'
  if (album.resolution === 'sd720') return '720p'
  const widest = Math.max(0, ...album.clips.map((clip) => clip.width ?? 0))
  if (!widest) return '—'
  return widest >= 3840 ? '4K' : widest >= 1920 ? '1080p' : '720p'
}

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

/**
 * The album's cover poster as an absolute URL: the clip the creator chose as
 * cover, else the first clip. Used for the share card and Product JSON-LD.
 */
function coverPoster(album: {
  coverClipId: string | null
  clips: Array<{ id: string; thumbnailKeys: string[] }>
}): string | null {
  const cover = album.clips.find((clip) => clip.id === album.coverClipId) ?? album.clips[0]
  return absoluteMediaUrl(cover?.thumbnailKeys[0])
}

function ProductJsonLd({
  album,
  image,
  priceStandard,
  url,
}: {
  image: string | null
  album: {
    origin: 'captured' | 'generated'
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
    // DEV-36: Google's Product rich result needs an image; the brand is Laqta.
    ...(image ? { image: [image] } : {}),
    brand: { '@type': 'Brand', name: t('brand.name') },
    additionalProperty: {
      '@type': 'PropertyValue',
      name: 'digitalSourceType',
      value: digitalSourceType(album.origin),
    },
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
