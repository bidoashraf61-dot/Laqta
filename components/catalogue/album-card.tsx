import { Sparkles, Video } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Bilingual } from '@/components/ui/bilingual'
import { formatMoney, t } from '@/lib/i18n'
import { pickLocalised } from '@/lib/locale'

import { cn } from '@/lib/utils'
import { PreviewWatermark } from '@/components/catalogue/watermark'
import { Anchor } from '@/components/ui/link'
import { revealDelay } from '@/lib/motion'
import { mediaUrl } from '@/lib/media'

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
  origin: 'captured' | 'generated'
  orientation: 'landscape' | 'portrait' | 'mixed'
  coverKey: string | null
  creatorNameAr: string
  creatorNameEn: string
}

function orientationLabel(orientation: AlbumCardData['orientation']) {
  if (orientation === 'portrait') return t('catalogue.orientationPortrait')
  if (orientation === 'mixed') return t('catalogue.orientationMixed')
  return t('catalogue.orientationLandscape')
}

/**
 * Rounded DOWN, always.
 *
 * A 33.4% saving advertised as 34% is a claim the arithmetic does not support,
 * and it is the kind of small overstatement that a consumer-protection
 * regulator reads as a pattern. Rounding down can only ever understate.
 */
function percentOff(price: number, compareAt: number) {
  return Math.floor(((compareAt - price) / compareAt) * 100)
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

export function AlbumCard({
  album,
  className,
  index,
}: {
  album: AlbumCardData
  className?: string
  /**
   * Position in the grid, for the staggered entrance. Optional: a card shown
   * on its own — the "more from this creator" slot on an album page — should
   * arrive with everything else rather than waiting its turn in a queue of one.
   */
  index?: number
}) {
  const hue = albumHue(album.slug)

  return (
    <div
      className={cn('group relative', className)}
      data-reveal
      style={index === undefined ? undefined : revealDelay(index)}
    >
      <div className="relative aspect-[5/7] overflow-hidden rounded-lg border shadow-soft transition-[border-color,box-shadow] duration-hover ease-lens group-hover:border-foreground/25 group-hover:shadow-lift">
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

        {/*
          Top: brand mark + how the footage was made.

          This slot used to carry «مرخصة للاستخدام التجاري». Every album is
          licensed for commercial use — it is the only licence there is — so
          the badge distinguished nothing and spent the card's one loud
          position saying what the price already implies.

          Provenance genuinely varies, and buyers have to declare it: a brand
          running a paid campaign may need to disclose synthetic media, and an
          agency briefing a client on "real Saudi locations" is making a
          factual claim. It is never inferred from the look of a frame.
        */}
        {/*
          No brand mark on the cover.

          It carried the wordmark set as live text, which was a third statement
          of the brand on one card: the tiled watermark already says
          «لقطة · معاينة» across the whole frame, and the header says it above.
          The real artwork would have been worse here, not better — the lockup
          puts the Latin LAQTA under the calligraphy, and at the ~24px this slot
          allows that line renders as three pixels of mush.

          What the cover keeps is the one fact that varies: how the footage was
          made. The mark itself now sits in the header as real artwork.
        */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] flex items-start justify-end gap-2 p-3">
          <Badge
            variant="film"
            className={cn(
              'gap-1',
              album.origin === 'generated' && 'bg-clay-fill/85 text-off-white',
            )}
          >
            {album.origin === 'generated' ? (
              <Sparkles className="size-3" aria-hidden />
            ) : (
              <Video className="size-3" aria-hidden />
            )}
            {album.origin === 'generated'
              ? t('catalogue.originGenerated')
              : t('catalogue.originCaptured')}
          </Badge>
        </div>

        {/* Bottom: title, price, what's in the box, and the creator link. */}
        <div className="absolute inset-x-0 bottom-0 z-[2] space-y-2 p-3.5">
          <span
            aria-hidden
            className="block h-[3px] w-9 rounded-full"
            style={{ background: `hsl(${hue})` }}
          />
          <h2 className="pointer-events-none line-clamp-2 font-display text-lg font-bold leading-[1.4] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
            <Bilingual ar={album.titleAr} en={album.titleEn} />
          </h2>

          {/*
            How many shots, and what shape they are.

            The runtime used to sit here too, and «٢٢ لقطة · أفقي · ٥:٣٤» read
            as a code rather than as facts — three numbers separated by dots,
            two of which a buyer has to decode. Total runtime is a spec, and it
            belongs on the album page with the other specs; the shot count is
            what the price is FOR, so it leads.
          */}
          <p className="pointer-events-none flex items-baseline gap-2 text-off-white/80">
            {/*
              Only the NUMBER is LTR-isolated, not the phrase.

              `.numeric` sets `direction: ltr`, so wrapping «16 لقطة» in it laid
              the two out left-to-right as one box — and an Arabic reader,
              coming from the right, met «لقطة» before the number. Isolating
              just the digits leaves the phrase in RTL flow, so it reads
              «16 لقطة» the way it is spoken.
            */}
            <span className="text-sm font-bold text-off-white">
              <span className="numeric">{album.clipCount}</span> {t('commerce.clip')}
            </span>
            <span className="text-xs">·</span>
            <span className="text-xs">{orientationLabel(album.orientation)}</span>
          </p>

          {/* The price is the loudest thing on the card after the title. It was
              the same size as the shot count, which read as a spec rather than
              as what the object costs. */}
          <div className="pointer-events-none flex flex-wrap items-baseline gap-x-2.5 gap-y-1 pt-0.5">
            <span className="numeric text-2xl font-bold text-gold-200">
              {formatMoney(album.priceStandard, album.currency)}
            </span>
            {album.compareAtPrice ? (
              <>
                <s className="numeric text-sm text-off-white/55 decoration-clay decoration-2">
                  {formatMoney(album.compareAtPrice, album.currency)}
                </s>
                <span className="numeric rounded-sm bg-clay-fill px-1.5 py-0.5 text-2xs font-bold text-off-white">
                  {percentOff(album.priceStandard, album.compareAtPrice)}%{' '}
                  {t('catalogue.offSuffix')}
                </span>
              </>
            ) : null}
          </div>

          {/* The creator's own link, lifted above the stretched album anchor. */}
          {/* Up from `text-xs` and always underlined. It was styled as a
              caption and only revealed itself as a link on hover, which is no
              affordance at all on a touch screen — and this is the one route
              off the card that is not the album. */}
          <Anchor
            href={`/creators/${album.creatorHandle}`}
            // `-my-1 py-1` keeps the visual position and lifts the hit area over the
            // 24px minimum — this link sits on top of a stretched anchor, so a
            // near-miss does not fail, it opens the wrong page.
            className="pointer-events-auto relative z-[3] -my-1 inline-block max-w-full truncate py-1 text-sm text-off-white/85 underline decoration-off-white/30 underline-offset-4 transition-colors duration-hover ease-lens hover:text-off-white hover:decoration-off-white"
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
function CoverImage({ src: key, alt }: { src: string | null; alt: string }) {
  const src = mediaUrl(key)
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
      className="size-full object-cover transition-transform duration-frame ease-lens group-hover:scale-105"
    />
  )
}
