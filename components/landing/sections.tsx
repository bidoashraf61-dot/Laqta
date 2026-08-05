import Link from 'next/link'
import { ArrowLeft, BadgeCheck, Clapperboard, Download, Search, ShoppingBag } from 'lucide-react'
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
            <p className="numeric font-display text-3xl font-black text-gold">{item.value}</p>
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
          {albums.map((album) => (
            <AlbumCard key={album.slug} album={album} />
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
            <p className="font-semibold group-hover:text-foreground">
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
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary text-lg font-semibold">
              {creator.nameAr.charAt(0)}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">
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

export function HowItWorks() {
  const steps = [
    { icon: Search, title: t('landing.howStep1Title'), body: t('landing.howStep1Body') },
    { icon: ShoppingBag, title: t('landing.howStep2Title'), body: t('landing.howStep2Body') },
    { icon: Download, title: t('landing.howStep3Title'), body: t('landing.howStep3Body') },
  ]

  return (
    <Section tone="raised">
      <SectionHead title={t('landing.howTitle')} />
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
    <Section tone="accent">
      <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl space-y-2">
          <Badge variant="gold" className="gap-1">
            <Clapperboard className="size-3" />
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
      <BadgeCheck className="size-4 text-success" />
      {t('landing.trustCleared')}
    </p>
  )
}
