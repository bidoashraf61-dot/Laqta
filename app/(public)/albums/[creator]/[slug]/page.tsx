import type { Metadata } from 'next'
import Link from 'next/link'
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
          city: true,
          country: true,
        },
      },
      licenceVersion: { select: { titleAr: true, bodyAr: true } },
      taxonomy: { select: { taxonomy: { select: { kind: true, slug: true, nameAr: true } } } },
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
    title: album.titleAr,
    description: album.descriptionAr ?? t('catalogue.albumsSubtitle'),
    alternates: { canonical: `/albums/${creator}/${slug}` },
    openGraph: {
      type: 'website',
      locale: 'ar_SA',
      title: album.titleAr,
      description: album.descriptionAr ?? '',
      images: album.clips[0]?.thumbnailKeys[0] ? [album.clips[0].thumbnailKeys[0]] : [],
    },
  }
}

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ creator: string; slug: string }>
}) {
  const { creator: creatorHandle, slug } = await params
  const album = await getAlbum(creatorHandle, slug)
  if (!album) notFound()

  const others = await db.album.findMany({
    where: { status: 'live', creatorId: album.creatorId, id: { not: album.id } },
    take: 4,
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

  const coverIds = others.map((row) => row.coverClipId).filter(Boolean) as string[]
  const covers = coverIds.length
    ? await db.clip.findMany({
        where: { id: { in: coverIds } },
        select: { id: true, thumbnailKeys: true },
      })
    : []
  const coverById = new Map(covers.map((clip) => [clip.id, clip.thumbnailKeys[0] ?? null]))

  const priceStandard = Number(album.priceStandard)
  const priceExtended = Number(album.priceExtended)
  const hero = album.clips[0]?.thumbnailKeys[0] ?? null

  return (
    <div className="container py-10">
      <ProductJsonLd
        album={album}
        priceStandard={priceStandard}
        url={`${SITE_URL}/albums/${creatorHandle}/${slug}`}
      />

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-8">
          {/* Trailer slot. Auto-cut from the clips at ingest; until that
              pipeline exists the cover still stands in, which is honest rather
              than an empty player. */}
          <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
            {hero ? (
              <img src={hero} alt="" className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center bg-gradient-to-br from-ink to-secondary">
                <span className="text-4xl font-bold text-gold/30">{t('brand.name')}</span>
              </div>
            )}
            <Badge variant="neutral" className="absolute end-3 top-3 bg-ink/80 backdrop-blur">
              {t('catalogue.previewWatermarked')}
            </Badge>
          </div>

          <header className="space-y-3">
            <h1 className="font-display text-headline font-semibold">
              <Bilingual ar={album.titleAr} en={album.titleEn} />
            </h1>
            <p className="text-muted-foreground">
              <Link href={`/creators/${album.creator.handle}`} className="hover:text-gold">
                {t('commerce.byCreator', { creator: album.creator.displayNameAr })}
              </Link>
            </p>
            {album.descriptionAr ? (
              <p className="max-w-prose font-serif text-[1.05rem] leading-relaxed text-muted-foreground">
                {album.descriptionAr}
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
                  <Badge variant="neutral">{taxonomy.nameAr}</Badge>
                </Link>
              ))}
            </div>
          </header>

          <Separator />

          <section>
            <h2 className="mb-4 text-lg font-semibold">
              {t('catalogue.clipsInAlbum')}{' '}
              <span className="numeric text-muted-foreground">({album.clips.length})</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {album.clips.map((clip) => (
                <Link
                  key={clip.id}
                  href={`/footage/${clip.slug}`}
                  className="group overflow-hidden rounded-md border bg-card transition-colors hover:border-gold/50"
                >
                  <div className="relative aspect-video bg-muted">
                    {clip.thumbnailKeys[0] ? (
                      <img
                        src={clip.thumbnailKeys[0]}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : null}
                    <Badge
                      variant="neutral"
                      className="numeric absolute bottom-1.5 end-1.5 bg-ink/80 backdrop-blur"
                    >
                      {formatDuration(Number(clip.durationS))}
                    </Badge>
                  </div>
                  <p className="line-clamp-1 p-2 text-xs group-hover:text-gold">
                    <Bilingual ar={clip.titleAr} en={clip.titleEn} />
                  </p>
                </Link>
              ))}
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t('catalogue.specs')}</h2>
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
                value={
                  album.clips[0] ? `${album.clips[0].width}×${album.clips[0].height}` : '—'
                }
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
            <h2 className="text-lg font-semibold">{t('catalogue.clearance')}</h2>
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
                {album.licenceVersion.bodyAr}
              </p>
            ) : null}
          </section>

          {others.length > 0 ? (
            <section>
              <h2 className="mb-4 text-lg font-semibold">{t('catalogue.byCreatorOther')}</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {others.map((other) => (
                  <AlbumCard
                    key={other.slug}
                    album={{
                      slug: other.slug,
                      creatorHandle: other.creator.handle,
                      creatorNameAr: other.creator.displayNameAr,
                      titleAr: other.titleAr,
                      titleEn: other.titleEn,
                      priceStandard: Number(other.priceStandard),
                      currency: other.currency,
                      clipCount: other.clipCount,
                      totalRuntimeS: other.totalRuntimeS,
                      clearedForCommercial: other.clearedForCommercial,
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
            priceExtended={priceExtended}
            currency={album.currency}
            editorialOnly={album.clearanceStatus === 'editorial_only'}
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
      <dd
        className={cn(
          'text-sm font-medium',
          numeric && 'numeric',
          latin && 'ltr-island',
        )}
      >
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
  album: { titleAr: string; descriptionAr: string | null; currency: string }
  priceStandard: number
  url: string
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: album.titleAr,
    description: album.descriptionAr ?? undefined,
    url,
    offers: {
      '@type': 'Offer',
      price: priceStandard,
      priceCurrency: album.currency,
      availability: 'https://schema.org/InStock',
      url,
    },
  }
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  )
}
