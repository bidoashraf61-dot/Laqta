import { Link } from '@/components/ui/link'
import { Button } from '@/components/ui/button'
import { albumHref } from '@/components/catalogue/album-card'
import { PreviewWatermark } from '@/components/catalogue/watermark'
import { HoverPreview } from '@/components/catalogue/hover-preview'
import { AutoplayVideo } from '@/components/catalogue/autoplay-video'
import { Bilingual } from '@/components/ui/bilingual'
import { Headline, Section } from '@/components/ui/typography'
import type { FootageTile } from '@/lib/catalogue'
import { formatMoney, t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { pickLocalised } from '@/lib/locale'

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
/**
 * ⚠️ PLACEHOLDER — awaiting the real showreel cut.
 *
 * This currently points at the hero's own file, which is a cinematic sequence
 * rather than a catalogue reel. It is here so the section, the player and the
 * autoplay behaviour are all real and reviewable; only the footage is stand-in.
 *
 * To ship the real one: drop the cut at `public/hero/vid/showreel-web.mp4`,
 * point `SHOWREEL_SRC` at it, and set `SHOWREEL_POSTER` to a frame from it.
 * Nothing else changes — that is the whole reason these are constants rather
 * than literals inline on the element, where "temporary" becomes permanent
 * because nobody can see that it was ever temporary.
 *
 * `public/hero/vid/` is gitignored (staged media, see CLAUDE.md), so the file
 * is dropped in locally and by the deploy, not committed.
 */
const SHOWREEL_SRC = '/hero/vid/hero-web-m.mp4'
const SHOWREEL_POSTER = '/hero/06-alula.jpg'

export function FootageWall({ footage }: { footage: FootageTile[] }) {
  if (footage.length === 0) return null

  return (
    <Section tone="base">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <Headline lead={t('landing.wallLead')} bold={t('landing.wallBold')} size="lg" />
        </div>
        {/* The way through to the full grid and every facet. Without it the
            wall is a dead end — twelve tiles and no route to the other 170. */}
        <Button asChild variant="outline" size="sm">
          <Link href="/footage">{t('landing.viewAll')}</Link>
        </Button>
      </div>

      {/* The showreel: every shot cut together, so a buyer can judge the
          whole catalogue in one viewing before deciding whether to browse it
          tile by tile. It plays when the section arrives and stops when it
          leaves — see AutoplayVideo for why that is not plain `autoplay`. */}
      {/* Anchor target for the hero's «شاهد التريلر» button. */}
      <div id="showreel" className="scroll-mt-24">
        <AutoplayVideo
          src={SHOWREEL_SRC}
          poster={SHOWREEL_POSTER}
          label={t('media.showreelAlt')}
          className="mb-10 aspect-video w-full"
        />
      </div>

      {/* CSS columns, not grid: mixed aspect ratios flow without being forced
          to a single crop — a 9:16 vertical stays vertical, honest about the
          product. `break-inside-avoid` keeps a tile from splitting a column. */}
      <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 [&>*]:mb-5">
        {footage.map((tile) => (
          <Link
            key={tile.slug}
            href={albumHref(tile.album)}
            aria-label={t('commerce.fromAlbum', {
              album: pickLocalised(tile.album.titleAr, tile.album.titleEn),
            })}
            className="group relative block break-inside-avoid overflow-hidden rounded-lg border bg-muted transition-colors hover:border-foreground/25"
          >
            <div className={cn('relative overflow-hidden', aspectClass(tile.aspectRatio))}>
              <HoverPreview
                src={tile.previewKey}
                poster={tile.thumbKey}
                alt={t('catalogue.altClipThumb', {
                  clip: pickLocalised(tile.titleAr, tile.titleEn),
                })}
              />

              <PreviewWatermark />

              {/* The doorway label — which album, and what it costs. Held back
                  until hover so the wall reads as frames first, a shelf second. */}
              <div className="absolute inset-x-0 bottom-0 z-[2] flex items-end justify-between gap-2 bg-gradient-to-t from-ink/85 via-ink/40 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="line-clamp-2 text-xs font-medium text-sand">
                  <Bilingual ar={tile.album.titleAr} en={tile.album.titleEn} />
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="numeric rounded-full bg-gold px-2.5 py-1 text-xs font-bold text-gold-foreground">
                    {formatMoney(tile.album.priceStandard, tile.album.currency)}
                  </span>
                  <span className="rounded-full border border-sand/50 px-2.5 py-1 text-xs font-medium text-sand">
                    {t('catalogue.openAlbum')}
                  </span>
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
