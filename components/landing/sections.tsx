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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-headline font-semibold">{title}</h2>
        {subtitle ? <p className="mt-1 text-muted-foreground">{subtitle}</p> : null}
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
    <section className="border-y border-border/60 bg-card/30">
      <div className="container grid grid-cols-2 gap-6 py-8 md:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <p className="numeric text-2xl font-bold text-gold">{item.value}</p>
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
}: {
  title: string
  subtitle: string
  albums: AlbumCardData[]
  href: string
}) {
  return (
    <section className="container py-14">
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
    </section>
  )
}

export function FeaturedAlbums({ albums }: { albums: AlbumCardData[] }) {
  return (
    <AlbumRail
      title={t('landing.featuredTitle')}
      subtitle={t('landing.featuredSubtitle')}
      albums={albums}
      href="/albums"
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
    <section className={cn('container py-14', className)}>
      <SectionHead title={title} subtitle={subtitle} href={base} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            key={tile.slug}
            href={`${base}/${tile.slug}`}
            className="group relative isolate overflow-hidden rounded-lg border bg-card p-5 transition-colors hover:border-gold/50"
          >
            {tile.heroImage ? (
              <img
                src={tile.heroImage}
                alt=""
                loading="lazy"
                className="absolute inset-0 -z-10 size-full object-cover opacity-30 transition-transform duration-500 group-hover:scale-105"
              />
            ) : null}
            <p className="font-semibold group-hover:text-gold">
              <Bilingual ar={tile.nameAr} en={tile.nameEn} />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="numeric">{formatNumber(tile.count)}</span>
            </p>
          </Link>
        ))}
      </div>
    </section>
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
    <section className="container py-14">
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
            className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:border-gold/50"
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
    </section>
  )
}

export function HowItWorks() {
  const steps = [
    { icon: Search, title: t('landing.howStep1Title'), body: t('landing.howStep1Body') },
    { icon: ShoppingBag, title: t('landing.howStep2Title'), body: t('landing.howStep2Body') },
    { icon: Download, title: t('landing.howStep3Title'), body: t('landing.howStep3Body') },
  ]

  return (
    <section className="border-y border-border/60 bg-card/30">
      <div className="container py-16">
        <SectionHead title={t('landing.howTitle')} />
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <Card key={step.title}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-gold/15 text-gold">
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
        <p className="mt-10 text-center text-xl font-semibold text-gold">
          {t('landing.positioning')}
        </p>
      </div>
    </section>
  )
}

export function CreatorCta() {
  return (
    <section className="container py-16">
      <div className="flex flex-col items-start gap-6 rounded-lg border border-gold/30 bg-gold/5 p-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl space-y-2">
          <Badge variant="gold" className="gap-1">
            <Clapperboard className="size-3" />
            {t('nav.sell')}
          </Badge>
          <h2 className="text-headline font-semibold">{t('landing.sellTitle')}</h2>
          <p className="text-muted-foreground">{t('landing.sellBody')}</p>
        </div>
        <Button asChild variant="gold" size="lg">
          <Link href="/sell">{t('landing.sellCta')}</Link>
        </Button>
      </div>
    </section>
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
