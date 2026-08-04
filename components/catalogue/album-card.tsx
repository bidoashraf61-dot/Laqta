import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Bilingual } from '@/components/ui/bilingual'
import { formatMoney, t } from '@/lib/i18n'
import { formatDuration } from '@/lib/utils'
import { cn } from '@/lib/utils'

/**
 * The album card.
 *
 * **The price is not optional.** Laqta sells albums outright; a card without a
 * number on it reads as a subscription catalogue, and the whole positioning
 * ("لا اشتراكات") collapses. Every surface that shows an album shows what it
 * costs, and routes to the album page.
 */

export type AlbumCardData = {
  slug: string
  creatorHandle: string
  titleAr: string
  titleEn: string
  priceStandard: number
  currency: string
  clipCount: number
  totalRuntimeS: number
  clearedForCommercial: boolean
  coverKey: string | null
  creatorNameAr: string
}

export function albumHref(album: { creatorHandle: string; slug: string }) {
  return `/albums/${album.creatorHandle}/${album.slug}`
}

export function AlbumCard({ album, className }: { album: AlbumCardData; className?: string }) {
  return (
    <Link
      href={albumHref(album)}
      className={cn(
        'group block overflow-hidden rounded-lg border bg-card transition-colors hover:border-foreground/25',
        className,
      )}
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        <CoverImage src={album.coverKey} alt="" />
        {album.clearedForCommercial ? (
          <Badge variant="success" className="absolute end-2 top-2 bg-ink/80 backdrop-blur">
            {t('commerce.clearedForCommercial')}
          </Badge>
        ) : null}
      </div>

      <div className="space-y-2 p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug group-hover:text-foreground">
          <Bilingual ar={album.titleAr} en={album.titleEn} />
        </h3>

        <p className="text-sm text-muted-foreground">
          {t('commerce.byCreator', { creator: album.creatorNameAr })}
        </p>

        <div className="flex items-baseline justify-between gap-2 pt-1">
          <span className="numeric rounded-full bg-gold/12 px-3 py-1 text-base font-bold text-gold">
            {formatMoney(album.priceStandard, album.currency)}
          </span>
          <span className="text-xs text-muted-foreground">
            <span className="numeric">{album.clipCount}</span> {t('commerce.clip')} ·{' '}
            <span className="numeric">{formatDuration(album.totalRuntimeS)}</span>
          </span>
        </div>
      </div>
    </Link>
  )
}

/**
 * Cover art.
 *
 * Object-storage keys are not URLs. Until the media pipeline is wired, a key
 * that does not resolve to a local demo poster renders as a themed placeholder
 * rather than a broken-image icon — an empty grid of grey boxes reads as a
 * broken site, which is worse than an obviously-empty one.
 */
function CoverImage({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="flex size-full items-center justify-center bg-gradient-to-br from-ink to-secondary">
        <span className="text-3xl font-bold text-gold/30">{t('brand.name')}</span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  )
}
