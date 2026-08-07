import Link from 'next/link'
import { albumHref } from '@/components/catalogue/album-card'
import { PreviewWatermark } from '@/components/catalogue/watermark'
import { Bilingual } from '@/components/ui/bilingual'
import { Headline, Section } from '@/components/ui/typography'
import type { FootageTile } from '@/lib/catalogue'
import { formatMoney, t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * The footage wall.
 *
 * A masonry of real frames pulled from across the catalogue — the "Saudi
 * everywhere" beat and, while the catalogue is young, the thing that makes a
 * handful of albums read as abundance (the eye counts frames, not albums).
 *
 * The rule the whole section obeys: **a clip is bait, the album is the
 * product.** Every tile links to its album, never to a clip checkout, and
 * carries the album's price so the doorway is honest. On hover the album name
 * and price surface; the price is the one gold thing on the tile, and only the
 * hovered tile shows it — so the One Voice Rule holds across the wall.
 */
export function FootageWall({ footage }: { footage: FootageTile[] }) {
  if (footage.length === 0) return null

  return (
    <Section tone="base">
      <div className="mb-10 max-w-2xl">
        <Headline lead={t('landing.wallLead')} bold={t('landing.wallBold')} size="lg" />
      </div>

      {/* CSS columns, not grid: mixed aspect ratios flow without being forced
          to a single crop — a 9:16 vertical stays vertical, honest about the
          product. `break-inside-avoid` keeps a tile from splitting a column. */}
      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
        {footage.map((tile) => (
          <Link
            key={tile.slug}
            href={albumHref(tile.album)}
            aria-label={t('commerce.fromAlbum', { album: tile.album.titleAr })}
            className="group relative block break-inside-avoid overflow-hidden rounded-lg border bg-muted transition-colors hover:border-foreground/25"
          >
            <div className={cn('relative overflow-hidden', aspectClass(tile.aspectRatio))}>
              {tile.thumbKey ? (
                <img
                  src={tile.thumbKey}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="dark grid size-full place-items-center bg-gradient-to-br from-ink to-secondary">
                  <span className="text-2xl font-bold text-gold/30">{t('brand.name')}</span>
                </div>
              )}

              <PreviewWatermark />

              {/* The doorway label — which album, and what it costs. Held back
                  until hover so the wall reads as frames first, a shelf second. */}
              <div className="absolute inset-x-0 bottom-0 z-[2] flex items-end justify-between gap-2 bg-gradient-to-t from-ink/85 via-ink/40 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="line-clamp-2 text-xs font-medium text-sand">
                  <Bilingual ar={tile.album.titleAr} en={tile.album.titleEn} />
                </span>
                <span className="numeric shrink-0 rounded-full bg-gold px-2.5 py-1 text-xs font-bold text-gold-foreground">
                  {formatMoney(tile.album.priceStandard, tile.album.currency)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  )
}

/**
 * Honour the clip's real aspect. Forcing 16:9 on a 9:16 vertical lies about
 * the product — the design system bans it outright.
 */
function aspectClass(aspectRatio: string | null): string {
  switch (aspectRatio) {
    case '9:16':
      return 'aspect-[9/16]'
    case '1:1':
      return 'aspect-square'
    case '4:5':
      return 'aspect-[4/5]'
    case '2.39:1':
      return 'aspect-[2.39/1]'
    default:
      return 'aspect-video'
  }
}
