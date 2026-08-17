import { Link } from '@/components/ui/link'
import { ArrowLeft } from 'lucide-react'
import * as Laqta from '@/components/ui/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlbumCard, type AlbumCardData } from '@/components/catalogue/album-card'
import { Bilingual } from '@/components/ui/bilingual'
import { EmptyState } from '@/components/ui/state'
import { formatNumber, t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Headline, Prose, Section } from '@/components/ui/typography'
import { accentChip, cycleAccent, TILE_TINT } from '@/components/ui/accent'
import { pickLocalised } from '@/lib/locale'

/** Section heading with an optional "view all" on the opposite edge. */
function SectionHead({
  title,
  subtitle,
  href,
}: {
  title: string
  subtitle?: string
  href?: string
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
      <div>
        {/* Two-weight pair: the subtitle carries the Light line, the title the
            Bold one, so a section head has internal hierarchy at one size. */}
        <Headline lead={subtitle} bold={title} size="lg" />
      </div>
      {href ? (
        <Button asChild variant="ghost" size="sm">
          <Link href={href} className="gap-1">
            {t('landing.viewAll')}
            {/* Points the way forward — mirrored in RTL by data-flip-rtl. */}
            <ArrowLeft className="size-4" data-flip-rtl />
          </Link>
        </Button>
      ) : null}
    </div>
  )
}

export function TrustStrip({
  stats,
}: {
  stats: { clips: number; albums: number; creators: number; cleared: number }
}) {
  const items = [
    { value: formatNumber(stats.clips), label: t('landing.trustClips') },
    { value: formatNumber(stats.albums), label: t('landing.trustAlbums') },
    { value: formatNumber(stats.creators), label: t('landing.trustCreators') },
    { value: t('landing.trustResolution'), label: t('landing.trustCleared') },
  ]

  return (
    <section className="border-y border-gold/20 bg-gold/[0.06]">
      <div className="container-tight grid grid-cols-2 gap-6 py-10 md:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <p className="numeric font-display text-3xl font-bold text-gold">{item.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function AlbumRail({
  title,
  subtitle,
  albums,
  href,
  tone,
}: {
  title: string
  subtitle: string
  albums: AlbumCardData[]
  href: string
  tone?: 'base' | 'raised' | 'accent'
}) {
  return (
    <Section tone={tone}>
      <SectionHead title={title} subtitle={subtitle} href={href} />
      {albums.length === 0 ? (
        <EmptyState title={t('state.empty')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {albums.map((album, i) => (
            <AlbumCard key={album.slug} album={album} index={i} />
          ))}
        </div>
      )}
    </Section>
  )
}

export function FeaturedAlbums({ albums }: { albums: AlbumCardData[] }) {
  return (
    <AlbumRail
      title={t('landing.featuredTitle')}
      subtitle={t('landing.featuredSubtitle')}
      albums={albums}
      href="/albums"
      tone="raised"
    />
  )
}

export function NewThisWeek({ albums }: { albums: AlbumCardData[] }) {
  return (
    <AlbumRail
      title={t('landing.newTitle')}
      subtitle={t('landing.newSubtitle')}
      albums={albums}
      href="/albums?sort=new"
      tone="raised"
    />
  )
}

type Tile = {
  slug: string
  nameAr: string
  nameEn: string
  heroImage: string | null
  count: number
}

export function BrowseTiles({
  title,
  subtitle,
  base,
  tiles,
  className,
}: {
  title: string
  subtitle: string
  base: '/locations' | '/categories'
  tiles: Tile[]
  className?: string
}) {
  return (
    <Section tone="base" className={className}>
      <SectionHead title={title} subtitle={subtitle} href={base} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile, index) => (
          // A warm tile: with no photo it takes a soft tinted ground in a
          // rotating palette hue, so a wall of tiles reads as a colourful set
          // rather than identical grey cards. Photo tiles keep the image.
          <Link
            key={tile.slug}
            href={`${base}/${tile.slug}`}
            className={cn(
              'group relative isolate overflow-hidden rounded-lg border p-5 transition-colors hover:border-foreground/25',
              tile.heroImage ? 'bg-card' : cn('border-transparent', TILE_TINT[cycleAccent(index)]),
            )}
          >
            {tile.heroImage ? (
              <img
                src={tile.heroImage}
                alt=""
                loading="lazy"
                className="absolute inset-0 -z-10 size-full object-cover opacity-30 transition-transform duration-500 group-hover:scale-105"
              />
            ) : null}
            <p className="font-bold group-hover:text-foreground">
              <Bilingual ar={tile.nameAr} en={tile.nameEn} />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="numeric">{formatNumber(tile.count)}</span>
            </p>
          </Link>
        ))}
      </div>
    </Section>
  )
}

export function TopCreators({
  creators,
}: {
  creators: Array<{
    handle: string
    nameAr: string
    nameEn: string
    city: string | null
    albumCount: number
  }>
}) {
  return (
    <Section tone="raised">
      <SectionHead
        title={t('landing.creatorsTitle')}
        subtitle={t('landing.creatorsSubtitle')}
        href="/creators"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {creators.map((creator) => (
          <Link
            key={creator.handle}
            href={`/creators/${creator.handle}`}
            className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/25"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary text-lg font-bold">
              {pickLocalised(creator.nameAr, creator.nameEn).charAt(0)}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-bold">
                <Bilingual ar={creator.nameAr} en={creator.nameEn} />
              </span>
              <span className="block text-sm text-muted-foreground">
                {creator.city ? `${creator.city} · ` : ''}
                <span className="numeric">{creator.albumCount}</span> {t('commerce.album')}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </Section>
  )
}

/**
 * Special offers.
 *
 * Renders NOTHING when no album is on offer. An "offers" heading above an
 * empty grid advertises that there are none, which is worse than not having
 * the section — the same reason the footage wall returns null when the
 * catalogue is empty.
 *
 * The saving is stated in words (`offersHint`) as well as shown by the strike,
 * because a struck-through number is a visual convention that assistive tech
 * announces inconsistently.
 */
export function SpecialOffers({ albums }: { albums: AlbumCardData[] }) {
  if (albums.length === 0) return null
  return (
    <Section tone="dusty">
      <div className="mb-8 max-w-2xl">
        <Headline lead={t('landing.offersLead')} bold={t('landing.offersBold')} size="lg" />
        <p className="mt-3 text-sm text-foreground">{t('landing.offersHint')}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {albums.map((album, i) => (
          <AlbumCard key={album.slug} album={album} index={i} />
        ))}
      </div>
    </Section>
  )
}

/** The full shelf — the browse-everything entry point on the landing page. */
export function AlbumShelf({ albums }: { albums: AlbumCardData[] }) {
  if (albums.length === 0) return null
  return (
    <Section tone="base">
      <SectionHead
        title={t('landing.shelfBold')}
        subtitle={t('landing.shelfLead')}
        href="/albums"
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {albums.map((album, i) => (
          <AlbumCard key={album.slug} album={album} index={i} />
        ))}
      </div>
    </Section>
  )
}

/**
 * The Collection — the albums, as the considered pitch.
 *
 * Framed as "المجموعة الأولى" (the first collection) rather than a library:
 * with a young catalogue, owning the smallness reads as curation, not
 * shortage. Each album is a full poster card carrying its own price, so the
 * "buy the album, not the clip" model is legible at a glance.
 *
 * A single customer voice sits under the shelf, right where the buyer is
 * weighing the albums — the placement the conversion research points to.
 */
export function TheCollection({ albums }: { albums: AlbumCardData[] }) {
  return (
    <Section tone="olive">
      <div className="mb-10 max-w-2xl">
        <Headline lead={t('landing.collectionLead')} bold={t('landing.collectionBold')} size="lg" />
      </div>

      {albums.length === 0 ? (
        <EmptyState title={t('state.empty')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album, i) => (
            <AlbumCard key={album.slug} album={album} index={i} />
          ))}
        </div>
      )}
    </Section>
  )
}

/**
 * One customer voice, set as an editorial pull-quote rather than a card.
 *
 * NOTE FOR THE OWNER: the quote and attribution below are placeholders. Swap
 * `landing.testimonialQuote` / `testimonialName` / `testimonialRole` in
 * messages/ar.json for a real, attributable customer quote before launch — a
 * fabricated testimonial is both a trust and a legal risk. Until then this
 * renders as an obvious placeholder, not a fake claim.
 */
export function Testimonial() {
  return (
    <Section tone="offwhite">
      <figure className="mx-auto max-w-3xl text-center">
        <blockquote className="font-display text-2xl font-light leading-[1.5] text-foreground/90">
          {t('landing.testimonialQuote')}
        </blockquote>
        <figcaption className="mt-6 text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{t('landing.testimonialName')}</span>
          {' · '}
          {t('landing.testimonialRole')}
        </figcaption>
      </figure>
    </Section>
  )
}

export function HowItWorks() {
  const steps = [
    { icon: Laqta.Search, title: t('landing.howStep1Title'), body: t('landing.howStep1Body') },
    { icon: Laqta.Basket, title: t('landing.howStep2Title'), body: t('landing.howStep2Body') },
    { icon: Laqta.Download, title: t('landing.howStep3Title'), body: t('landing.howStep3Body') },
  ]

  return (
    <Section tone="base">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <Headline bold={t('landing.howTitle')} size="lg" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((step, index) => (
          <Card key={step.title}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'grid size-10 place-items-center rounded-full',
                    accentChip[cycleAccent(index)],
                  )}
                >
                  <step.icon className="size-5" />
                </span>
                <span className="numeric text-sm text-muted-foreground">{index + 1}</span>
              </div>
              <CardTitle className="pt-2">{step.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* The positioning, stated outright. It is the single thing that
            separates Laqta from every subscription library buyers know. */}
      {/* The positioning, stated outright — the one line that separates Laqta
          from every subscription library buyers already know. */}
      <p className="mt-12 text-center font-display text-2xl font-light text-muted-foreground">
        {t('landing.positioning')}
      </p>
    </Section>
  )
}

export function CreatorCta() {
  return (
    <Section tone="olive">
      <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl space-y-2">
          {/* Not `gold`: on the olive ground gold reaches only 2.82:1, which
              is why the ground's own rule hands the accent role to sand. */}
          <Badge variant="sand" className="gap-1">
            <Laqta.Clip className="size-3" />
            {t('nav.sell')}
          </Badge>
          <Headline bold={t('landing.sellTitle')} size="lg" />
          <Prose>{t('landing.sellBody')}</Prose>
        </div>
        <Button asChild variant="gold" size="lg">
          <Link href="/sell">{t('landing.sellCta')}</Link>
        </Button>
      </div>
    </Section>
  )
}

export function ClearedNote() {
  return (
    <p className="container flex items-center justify-center gap-2 pb-6 text-sm text-muted-foreground">
      <Laqta.Cleared className="size-4 text-success" />
      {t('landing.trustCleared')}
    </p>
  )
}
