import Link from 'next/link'
import { BadgeCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Bilingual } from '@/components/ui/bilingual'
import { formatMoney, t } from '@/lib/i18n'
import { formatDuration, cn } from '@/lib/utils'
import type { ClipHit } from '@/lib/search'
import { albumHref } from '@/components/catalogue/album-card'

/**
 * The clip card — and the album ribbon underneath it.
 *
 * ── The rule this component exists to enforce ───────────────────────────────
 * Buyers search at the CLIP level and pay at the ALBUM level. Artlist can show
 * a flat grid of clips because a subscription makes every clip "free" once
 * you're in; Laqta breaks that symmetry, so a clip on its own is not a thing
 * anyone can buy.
 *
 * Therefore every clip surface carries the album it belongs to, that album's
 * price, and a route to the album page. Strip the ribbon and buyers form the
 * expectation that they are buying this one clip, then hit a wall at checkout.
 * That is the single most expensive mistake available on this screen.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function ClipCard({ clip, className }: { clip: ClipHit; className?: string }) {
  const resolution = clip.width >= 6000 ? '6K' : clip.width >= 3840 ? '4K' : 'HD'

  return (
    <article
      className={cn(
        'group overflow-hidden rounded-lg border bg-card transition-colors hover:border-foreground/25',
        className,
      )}
    >
      <Link href={`/footage/${clip.slug}`} className="block">
        <div className="relative aspect-video overflow-hidden bg-muted">
          {clip.thumbnail ? (
            <img
              src={clip.thumbnail}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="dark grid size-full place-items-center bg-gradient-to-br from-ink to-secondary">
              <span className="text-2xl font-bold text-gold/30">{t('brand.name')}</span>
            </div>
          )}

          <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
            <Badge variant="neutral" className="numeric bg-ink/80 backdrop-blur">
              {formatDuration(clip.durationS)}
            </Badge>
            <Badge variant="neutral" className="ltr-island bg-ink/80 backdrop-blur">
              {resolution}
            </Badge>
          </div>
        </div>

        <h2 className="line-clamp-2 px-3 pt-3 text-sm font-medium leading-snug group-hover:text-foreground">
          <Bilingual ar={clip.titleAr} en={clip.titleEn} />
        </h2>
      </Link>

      {/* The ribbon. Its own link, so the buyer can go straight to the thing
          they can actually purchase without passing through the clip page. */}
      <Link
        href={albumHref({ creatorHandle: clip.album.creatorHandle, slug: clip.album.slug })}
        className="mt-2 block border-t bg-secondary/40 px-3 py-2 transition-colors hover:bg-secondary"
      >
        <p className="truncate text-xs text-muted-foreground">
          {t('commerce.fromAlbum', { album: '' })}
          <span className="font-medium text-foreground">
            <Bilingual ar={clip.album.titleAr} en={clip.album.titleEn} />
          </span>
        </p>
        <p className="mt-1 flex items-center gap-2 text-xs">
          <span className="numeric rounded-full bg-gold/12 px-2 py-0.5 font-bold text-gold">
            {formatMoney(clip.album.priceStandard, clip.album.currency)}
          </span>
          <span className="text-muted-foreground">
            · <span className="numeric">{clip.album.clipCount}</span> {t('commerce.clip')}
          </span>
          {clip.album.clearedForCommercial ? (
            <BadgeCheck
              className="size-3.5 shrink-0 text-success"
              aria-label={t('commerce.clearedForCommercial')}
            />
          ) : null}
        </p>
      </Link>
    </article>
  )
}
