'use client'

import { Sparkles, Video } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Bilingual } from '@/components/ui/bilingual'

import { formatDuration, cn } from '@/lib/utils'
import type { ClipHit } from '@/lib/search'
import { albumHref } from '@/components/catalogue/album-card'
import { PreviewWatermark } from '@/components/catalogue/watermark'
import { HoverPreview } from '@/components/catalogue/hover-preview'

import { Anchor } from '@/components/ui/link'
import { revealDelay } from '@/lib/motion'
import { useMoney, usePick, useT } from '@/lib/i18n-client'

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
export function ClipCard({
  clip,
  className,
  index,
}: {
  clip: ClipHit
  className?: string
  /** Position in the grid, for the staggered entrance. See AlbumCard. */
  index?: number
}) {
  // 4K is the ceiling. There is no generation model that outputs 6K, so a 6K
  // chip was a spec claim a buyer could check and find false; most of the
  // catalogue ships 1080p today.
  /*
   * Client component, and it has to be.
   *
   * The results grid appends pages fetched as JSON, so these cards are built in
   * the browser — where the server `t()` and `formatMoney()` read an RSC store
   * that does not exist and silently fall back to Arabic. That is exactly what
   * happened: /en/footage failed `verify:arabic` the moment the grid became
   * infinite.
   */
  const t = useT()
  const money = useMoney()
  const pick = usePick()

  const resolution = clip.width >= 3840 ? '4K' : clip.width >= 1920 ? '1080p' : 'HD'

  return (
    <article
      data-reveal
      style={index === undefined ? undefined : revealDelay(index)}
      className={cn(
        'group overflow-hidden rounded-lg border bg-card transition-[border-color,box-shadow] duration-hover ease-lens hover:border-foreground/25 hover:shadow-lift',
        className,
      )}
    >
      <Anchor href={`/footage/${clip.slug}`} className="block">
        <div className="relative aspect-video overflow-hidden bg-ink">
          {/* Hover — or focus — plays the shot. A still tells you what is in
              frame; only motion tells you whether the move is usable, which is
              the thing an editor is actually judging. */}
          <HoverPreview
            src={clip.previewKey}
            poster={clip.thumbnail}
            alt={t('catalogue.altClipThumb', { clip: pick(clip.titleAr, clip.titleEn) })}
            className="size-full"
          />

          <PreviewWatermark label={`${t('brand.name')} · ${t('catalogue.preview')}`} />

          <div className="absolute inset-x-2 bottom-2 z-[2] flex items-center justify-between gap-2">
            <Badge variant="film" className="numeric">
              {formatDuration(clip.durationS)}
            </Badge>
            <Badge variant="film" className="ltr-island">
              {resolution}
            </Badge>
          </div>
        </div>

        <h2 className="line-clamp-2 px-3 pt-3 text-sm font-medium leading-snug group-hover:text-foreground">
          <Bilingual ar={clip.titleAr} en={clip.titleEn} />
        </h2>
      </Anchor>

      {/* The ribbon. Its own link, so the buyer can go straight to the thing
          they can actually purchase without passing through the clip page. */}
      <Anchor
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
            {money(clip.album.priceStandard, clip.album.currency)}
          </span>
          <span className="text-muted-foreground">
            · <span className="numeric">{clip.album.clipCount}</span> {t('commerce.clip')}
          </span>
          {/* How it was made, not whether it is cleared. Every album is
              licensed for commercial use — that badge distinguished nothing
              once the tiers collapsed. */}
          <span
            className={cn(
              'ms-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-2xs',
              clip.album.origin === 'generated'
                ? 'bg-clay-fill/15 text-clay'
                : 'bg-secondary text-secondary-foreground',
            )}
          >
            {clip.album.origin === 'generated' ? (
              <Sparkles className="size-3" aria-hidden />
            ) : (
              <Video className="size-3" aria-hidden />
            )}
            {clip.album.origin === 'generated'
              ? t('catalogue.originGenerated')
              : t('catalogue.originCaptured')}
          </span>
        </p>
      </Anchor>
    </article>
  )
}
