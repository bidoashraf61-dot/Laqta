import { Badge } from '@/components/ui/badge'
import { Bilingual } from '@/components/ui/bilingual'
import { formatMoney, t } from '@/lib/i18n'
import { pickLocalised } from '@/lib/locale'
import { formatDuration } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { PreviewWatermark } from '@/components/catalogue/watermark'
import { Anchor } from '@/components/ui/link'

/**
 * The album pack.
 *
 * **The price is not optional.** Laqta sells albums outright; a card without a
 * number on it reads as a subscription catalogue, and the whole positioning
 * ("لا اشتراكات") collapses. Every surface that shows an album shows what it
 * costs, and routes to the album page.
 *
 * ── Why it is a box and not a thumbnail ─────────────────────────────────────
 * The offer is «تشتري مرة واحدة وتملكها للأبد». A 16:9 thumbnail is the visual
 * grammar of a streaming catalogue — something you scroll past. A boxed
 * product is the grammar of something you own. The format makes the argument
 * before the copy gets a chance to.
 *
 * Three planes, hinged in CSS (see `.pack-*` in globals.css): the face, a
 * spine on the inline-end edge, and a lid carrying the clip count. No image
 * assets, no JavaScript, and the whole thing still degrades to a flat card if
 * 3D transforms are unavailable.
 *
 * This deliberately gives up the 16:9 crop — which closes an open item in
 * docs/design-language.md, where forcing album covers to 16:9 was already
 * recorded as wrong.
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
const PACK_HUES = [
  '60 11% 33%', // olive
  '21 51% 42%', // clay
  '148 40% 30%', // oasis
  '205 42% 34%', // deep sea
  '43 44% 32%', // gold ground
  '265 22% 36%', // night
] as const

function packHue(slug: string) {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return PACK_HUES[h % PACK_HUES.length]
}

export function AlbumCard({ album, className }: { album: AlbumCardData; className?: string }) {
  const hue = packHue(album.slug)

  return (
    // A plain anchor, not next/link. The client router intermittently fetches
    // a card's route and then declines to commit, so the click does nothing —
    // see "Client-router navigations that never commit" in CLAUDE.md. This is
    // the buyer's primary path to the thing they can actually purchase, so it
    // takes the reliable navigation rather than the fast one.
    <Anchor href={albumHref(album)} className={cn('pack group block', className)}>
      <div className="pack-box">
        <div className="pack-face relative aspect-[5/7] rounded-sm">
          {/* The art is its own clipped layer: the face has to keep
              `preserve-3d` so the spine and lid stay hinged to it, and
              `overflow:hidden` on a preserve-3d element flattens the children
              back into the plane. */}
          <div className="absolute inset-0 overflow-hidden rounded-sm">
            <CoverImage src={album.coverKey} alt={coverAlt(album)} />
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background: `linear-gradient(155deg, hsl(${hue} / 0.4) 0%, transparent 46%)`,
              }}
            />
            <span
              aria-hidden
              className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/20 to-ink/90"
            />
            <PreviewWatermark />
          </div>

          {/* Spine — hinged on the inline-end edge, which is the right in RTL.
              It carries colour and depth, not type: at card scale a spine
              legend is unreadable, and an unreadable label is noise. */}
          <span
            aria-hidden
            className="pack-spine inset-block-0 absolute end-0 w-[7%] min-w-[18px] rounded-s-sm"
            style={{ background: `hsl(${hue})` }}
          />

          {/* Lid — what is in the box, before you read the title. */}
          <span
            aria-hidden
            className="pack-lid inset-inline-0 absolute top-0 flex h-[7%] min-h-[22px] items-center justify-between rounded-t-sm px-3"
            style={{ background: `hsl(${hue})` }}
          >
            <span className="numeric text-xs font-bold tracking-wide text-off-white">
              {album.clipCount} · {formatDuration(album.totalRuntimeS)}
            </span>
          </span>

          <div className="absolute inset-x-0 top-0 z-[2] flex items-start justify-between p-3">
            <span className="font-display text-base font-bold text-gold-200">
              {t('brand.name')}
            </span>
            {album.offerLabelAr ? (
              <Badge variant="destructive" className="bg-clay-fill text-off-white backdrop-blur">
                <Bilingual ar={album.offerLabelAr} en={album.offerLabelEn} />
              </Badge>
            ) : album.clearedForCommercial ? (
              <Badge variant="success" className="bg-ink/70 backdrop-blur">
                {t('commerce.clearedForCommercial')}
              </Badge>
            ) : null}
          </div>

          <div className="absolute inset-x-0 bottom-0 z-[2] space-y-2 p-3.5">
            <span
              aria-hidden
              className="block h-[3px] w-9 rounded-full"
              style={{ background: `hsl(${hue})` }}
            />
            <h2 className="line-clamp-3 font-display text-lg font-bold leading-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
              <Bilingual ar={album.titleAr} en={album.titleEn} />
            </h2>
            <div className="flex items-baseline justify-between gap-2 pt-0.5">
              <span className="flex items-baseline gap-2">
                <span className="numeric text-base font-bold text-gold-200">
                  {formatMoney(album.priceStandard, album.currency)}
                </span>
                {/* The original price, struck through. `line-through` alone is
                    colour-blind-safe; the offer badge above carries the same
                    information in words, so the saving is never signalled by
                    colour or decoration on its own. */}
                {album.compareAtPrice ? (
                  <s className="numeric text-xs text-off-white/55 decoration-clay">
                    {formatMoney(album.compareAtPrice, album.currency)}
                  </s>
                ) : null}
              </span>
              <span className="truncate text-xs text-off-white/70">
                {/* Flattened rather than a <Bilingual>: this is interpolated into a
                    sentence ("by {creator}"), and an element there would split the
                    message into fragments a translator cannot reorder. */}
                {t('commerce.byCreator', {
                  creator: pickLocalised(album.creatorNameAr, album.creatorNameEn),
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Anchor>
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
