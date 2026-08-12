import { Badge } from '@/components/ui/badge'
import { Bilingual } from '@/components/ui/bilingual'
import { formatMoney, t } from '@/lib/i18n'
import { pickLocalised } from '@/lib/locale'
import { formatDuration } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { PreviewWatermark } from '@/components/catalogue/watermark'
import { Anchor } from '@/components/ui/link'

/**
 * The album poster.
 *
 * **The price is not optional.** Laqta sells albums outright; a card without a
 * number on it reads as a subscription catalogue, and the whole positioning
 * ("لا اشتراكات") collapses. Every surface that shows an album shows what it
 * costs, and routes to the album page.
 *
 * A flat, cover-led 5:7 poster — not a faux-3D box. The 3D "pack" read as fake
 * because there is no real cover art yet, only a tinted placeholder; a clean
 * poster is honest about that and drops straight into a real cover when one is
 * uploaded. It deliberately keeps the 5:7 portrait crop (closing the 16:9 open
 * item in docs/design-language.md) so the object still reads as something you
 * own rather than something you stream past.
 *
 * Two sibling links, never nested: a stretched anchor over the whole poster
 * goes to the album (the buyer's primary path), and the creator name is its own
 * anchor, lifted above the stretch, to the creator's page.
 */

export type AlbumCardData = {
  slug: string
  creatorHandle: string
  titleAr: string
  titleEn: string
  priceStandard: number
  compareAtPrice: number | null
  offerLabelAr: string | null
  offerLabelEn: string | null
  currency: string
  clipCount: number
  totalRuntimeS: number
  clearedForCommercial: boolean
  coverKey: string | null
  creatorNameAr: string
  creatorNameEn: string
}

export function albumHref(album: { creatorHandle: string; slug: string }) {
  return `/albums/${album.creatorHandle}/${album.slug}`
}

/**
 * Each album keeps one colour for life.
 *
 * Derived from the slug rather than the grid index, so an album is the same
 * colour on the landing page, in search results and on a creator's profile. A
 * position-based cycle would repaint the same product every time it moved,
 * which is the opposite of a product line.
 */
const ALBUM_HUES = [
  '60 11% 33%', // olive
  '21 51% 42%', // clay
  '148 40% 30%', // oasis
  '205 42% 34%', // deep sea
  '43 44% 32%', // gold ground
  '265 22% 36%', // night
] as const

function albumHue(slug: string) {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return ALBUM_HUES[h % ALBUM_HUES.length]
}

export function AlbumCard({ album, className }: { album: AlbumCardData; className?: string }) {
  const hue = albumHue(album.slug)

  return (
    <div className={cn('group relative', className)}>
      <div className="relative aspect-[5/7] overflow-hidden rounded-lg border shadow-soft">
        <div className="absolute inset-0">
          <CoverImage src={album.coverKey} alt={coverAlt(album)} />
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ background: `linear-gradient(155deg, hsl(${hue} / 0.4) 0%, transparent 46%)` }}
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/20 to-ink/90"
          />
          <PreviewWatermark />
        </div>

        {/* The primary link — stretched over the whole poster. A plain anchor,
            not next/link: the client router intermittently declines to commit a
            card navigation (see CLAUDE.md), and this is the buyer's main path. */}
        <Anchor
          href={albumHref(album)}
          aria-label={coverAlt(album)}
          className="absolute inset-0 z-[1]"
        />

        {/* Top: brand mark + the one status/offer badge. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] flex items-start justify-between p-3">
          <span className="font-display text-base font-bold text-gold-200">{t('brand.name')}</span>
          {album.offerLabelAr ? (
            <Badge variant="neutral" className="bg-ink/70 text-off-white/90 backdrop-blur">
              <Bilingual ar={album.offerLabelAr} en={album.offerLabelEn} />
            </Badge>
          ) : album.clearedForCommercial ? (
            <Badge variant="success" className="bg-ink/70 backdrop-blur">
              {t('commerce.clearedForCommercial')}
            </Badge>
          ) : null}
        </div>

        {/* Bottom: title, price, what's in the box, and the creator link. */}
        <div className="absolute inset-x-0 bottom-0 z-[2] space-y-2 p-3.5">
          <span
            aria-hidden
            className="block h-[3px] w-9 rounded-full"
            style={{ background: `hsl(${hue})` }}
          />
          <h2 className="pointer-events-none line-clamp-3 font-display text-lg font-bold leading-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
            <Bilingual ar={album.titleAr} en={album.titleEn} />
          </h2>

          <div className="pointer-events-none flex items-baseline justify-between gap-2 pt-0.5">
            <span className="flex items-baseline gap-2">
              <span className="numeric text-base font-bold text-gold-200">
                {formatMoney(album.priceStandard, album.currency)}
              </span>
              {album.compareAtPrice ? (
                <s className="numeric text-xs text-off-white/55 decoration-clay">
                  {formatMoney(album.compareAtPrice, album.currency)}
                </s>
              ) : null}
            </span>
            <span className="numeric text-xs text-off-white/70">
              {album.clipCount} {t('commerce.clip')} · {formatDuration(album.totalRuntimeS)}
            </span>
          </div>

          {/* The creator's own link, lifted above the stretched album anchor. */}
          <Anchor
            href={`/creators/${album.creatorHandle}`}
            className="pointer-events-auto relative z-[3] inline-block max-w-full truncate text-xs text-off-white/70 underline-offset-2 hover:text-off-white hover:underline"
          >
            {t('commerce.byCreator', {
              creator: pickLocalised(album.creatorNameAr, album.creatorNameEn),
            })}
          </Anchor>
        </div>
      </div>
    </div>
  )
}

/**
 * §A4 of docs/website-content.md: never empty, never `image1.jpg`, never
 * stuffed. This shipped as `alt=""`, which is invisible to a screen reader and
 * to image search alike.
 */
function coverAlt(album: AlbumCardData) {
  return t('catalogue.altAlbumCover', {
    album: pickLocalised(album.titleAr, album.titleEn),
    count: String(album.clipCount),
  })
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
      <span
        role="img"
        aria-label={alt}
        className="flex size-full items-center justify-center bg-gradient-to-br from-ink to-secondary"
      >
        <span className="font-display text-3xl font-bold text-gold/30">{t('brand.name')}</span>
      </span>
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
