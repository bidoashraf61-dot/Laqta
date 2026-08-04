import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BadgeCheck, MapPin } from 'lucide-react'
import { db } from '@/lib/db'
import { formatMoney, t } from '@/lib/i18n'
import { formatDuration, cn } from '@/lib/utils'
import { specLabel } from '@/lib/spec-labels'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/toggles'
import { Bilingual } from '@/components/ui/bilingual'
import { ScrollArea } from '@/components/ui/overlays'

const SITE_URL = process.env.AUTH_URL ?? 'http://localhost:3000'

/**
 * Clip detail.
 *
 * A real page at a real URL, not just a modal: these are the deepest-tail
 * search entries in the whole catalogue ("قصر الفريد دوران جوي") and they have
 * to be crawlable and shareable. The grid overlays it as a modal on the client
 * where that makes sense; the page underneath is the source of truth.
 *
 * Everything here funnels to one place — the album. A clip is not purchasable
 * on its own, so the conversion block states the album, its clip count and its
 * price outright rather than letting the buyer discover that at checkout.
 */

async function getClip(slug: string) {
  return db.clip.findFirst({
    where: { slug, album: { status: 'live' } },
    select: {
      id: true,
      slug: true,
      titleAr: true,
      titleEn: true,
      descriptionAr: true,
      durationS: true,
      width: true,
      height: true,
      fps: true,
      codec: true,
      colourProfile: true,
      aspectRatio: true,
      camera: true,
      lens: true,
      cameraMovement: true,
      shotSize: true,
      timeOfDay: true,
      hasPeople: true,
      identifiableFaces: true,
      thumbnailKeys: true,
      previewHlsKey: true,
      // masterKey stays out of every catalogue query.
      location: { select: { slug: true, nameAr: true } },
      taxonomy: { select: { taxonomy: { select: { kind: true, slug: true, nameAr: true } } } },
      album: {
        select: {
          slug: true,
          titleAr: true,
          titleEn: true,
          priceStandard: true,
          currency: true,
          clipCount: true,
          clearedForCommercial: true,
          clearanceStatus: true,
          creator: { select: { handle: true, displayNameAr: true } },
          clips: {
            orderBy: { orderIndex: 'asc' },
            take: 12,
            select: { id: true, slug: true, titleAr: true, thumbnailKeys: true, durationS: true },
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
  const clip = await getClip(slug)
  if (!clip) return { title: t('state.notFound') }

  return {
    title: clip.titleAr,
    description:
      clip.descriptionAr ?? `${clip.titleAr} — ${t('commerce.fromAlbum', { album: clip.album.titleAr })}`,
    alternates: { canonical: `/footage/${slug}` },
    openGraph: {
      type: 'video.other',
      locale: 'ar_SA',
      title: clip.titleAr,
      images: clip.thumbnailKeys[0] ? [clip.thumbnailKeys[0]] : [],
    },
  }
}

export default async function ClipPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const clip = await getClip(slug)
  if (!clip) notFound()

  const albumUrl = `/albums/${clip.album.creator.handle}/${clip.album.slug}`
  const siblings = clip.album.clips.filter((sibling) => sibling.id !== clip.id)

  return (
    <div className="container py-10">
      <VideoJsonLd clip={clip} url={`${SITE_URL}/footage/${slug}`} />

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
            {clip.thumbnailKeys[0] ? (
              <img src={clip.thumbnailKeys[0]} alt="" className="size-full object-cover" />
            ) : null}
            <Badge variant="neutral" className="absolute end-3 top-3 bg-ink/80 backdrop-blur">
              {t('catalogue.previewWatermarked')}
            </Badge>
            <Badge
              variant="neutral"
              className="numeric absolute bottom-3 end-3 bg-ink/80 backdrop-blur"
            >
              {formatDuration(Number(clip.durationS))}
            </Badge>
          </div>

          <header className="space-y-2">
            <h1 className="text-headline font-semibold">
              <Bilingual ar={clip.titleAr} en={clip.titleEn} />
            </h1>
            {clip.descriptionAr ? (
              <p className="max-w-prose text-muted-foreground">{clip.descriptionAr}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {clip.location ? (
                <Link href={`/locations/${clip.location.slug}`}>
                  <Badge variant="neutral" className="gap-1">
                    <MapPin className="size-3" />
                    {clip.location.nameAr}
                  </Badge>
                </Link>
              ) : null}
              {clip.taxonomy.map(({ taxonomy }) => (
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
            <h2 className="mb-3 text-lg font-semibold">{t('catalogue.specs')}</h2>
            <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
              <Spec label={t('catalogue.duration')} value={formatDuration(Number(clip.durationS))} numeric />
              <Spec label={t('catalogue.dimensions')} value={`${clip.width}×${clip.height}`} numeric />
              <Spec label={t('catalogue.frameRate')} value={String(Number(clip.fps))} numeric />
              <Spec label={t('catalogue.aspect')} value={clip.aspectRatio ?? '—'} numeric />
              <Spec label={t('catalogue.codec')} value={clip.codec ?? '—'} />
              <Spec label={t('catalogue.colourProfile')} value={clip.colourProfile ?? '—'} />
              <Spec label={t('catalogue.camera')} value={clip.camera ?? '—'} />
              <Spec label={t('catalogue.lens')} value={clip.lens ?? '—'} />
              <Spec label={t('catalogue.cameraMovement')} value={specLabel('movement', clip.cameraMovement) ?? '—'} />
              <Spec label={t('catalogue.shotSize')} value={specLabel('shotSize', clip.shotSize) ?? '—'} />
            </dl>
          </section>

          {/* "Look how much else you get" — the strip that turns a single-clip
              intent into an album purchase. */}
          {siblings.length > 0 ? (
            <section>
              <h2 className="mb-3 text-lg font-semibold">{t('catalogue.clipsInAlbum')}</h2>
              <ScrollArea className="w-full">
                <div className="flex gap-3 pb-3">
                  {siblings.map((sibling) => (
                    <Link
                      key={sibling.id}
                      href={`/footage/${sibling.slug}`}
                      className="group w-44 shrink-0 overflow-hidden rounded-md border bg-card transition-colors hover:border-gold/50"
                    >
                      <div className="relative aspect-video bg-muted">
                        {sibling.thumbnailKeys[0] ? (
                          <img
                            src={sibling.thumbnailKeys[0]}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        ) : null}
                      </div>
                      <p className="line-clamp-1 p-2 text-xs group-hover:text-gold">
                        {sibling.titleAr}
                      </p>
                    </Link>
                  ))}
                </div>
              </ScrollArea>
            </section>
          ) : null}
        </div>

        {/* The conversion block. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="border-gold/30">
            <CardContent className="space-y-4 p-5">
              <p className="text-sm text-muted-foreground">{t('catalogue.partOfAlbum')}</p>
              <Link href={albumUrl} className="block text-lg font-semibold hover:text-gold">
                <Bilingual ar={clip.album.titleAr} en={clip.album.titleEn} />
              </Link>

              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="numeric">{clip.album.clipCount}</span> {t('commerce.clip')}
                {clip.album.clearedForCommercial ? (
                  <BadgeCheck className="size-4 text-success" />
                ) : null}
              </p>

              <p className="numeric text-3xl font-bold text-gold">
                {formatMoney(Number(clip.album.priceStandard), clip.album.currency)}
              </p>

              <div className="grid gap-2">
                <Button asChild variant="gold" size="lg">
                  <Link href={albumUrl}>{t('catalogue.buyAlbum')}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={albumUrl}>{t('catalogue.allClips')}</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href={`/account/boards?add=${clip.id}`}>{t('commerce.addToBoard')}</Link>
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                {t('catalogue.reassurance')}
              </p>
            </CardContent>
          </Card>
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

function VideoJsonLd({
  clip,
  url,
}: {
  clip: { titleAr: string; descriptionAr: string | null; thumbnailKeys: string[]; durationS: unknown }
  url: string
}) {
  const seconds = Math.round(Number(clip.durationS))
  const data = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: clip.titleAr,
    description: clip.descriptionAr ?? clip.titleAr,
    thumbnailUrl: clip.thumbnailKeys,
    // ISO-8601 duration.
    duration: `PT${Math.floor(seconds / 60)}M${seconds % 60}S`,
    url,
    inLanguage: 'ar',
  }
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  )
}
