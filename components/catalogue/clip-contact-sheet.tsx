import { PreviewWatermark } from '@/components/catalogue/watermark'
import { Link } from '@/components/ui/link'
import { formatDuration } from '@/lib/utils'
import { REVEAL, revealDelay } from '@/lib/motion'
import { t } from '@/lib/i18n'
import { pickLocalised } from '@/lib/locale'
import { mediaUrl } from '@/lib/media'

/**
 * Every clip in an album, at its true shape.
 *
 * ── Why the tiles are not all 16:9 ──────────────────────────────────────────
 * They were. Every clip was forced into `aspect-video` and cropped to fit,
 * which meant a vertical album looked identical to a horizontal one right up
 * until the buyer opened a clip — and orientation is not a detail here. A
 * social-first buyer needs 9:16 and a broadcast buyer needs 16:9, and selling
 * one to the other is a refund. The grid states the shape by BEING the shape.
 *
 * ── Why a contact sheet and not a column grid ───────────────────────────────
 * A fixed-column grid with mixed aspects either crops (which is the bug) or
 * leaves holes under every landscape tile in a row that contains a portrait
 * one. Fixing the HEIGHT and letting width follow the aspect ratio is how a
 * contact sheet has always worked, and it is what an editor recognises: same
 * strip height, frames of different shapes along it, nothing cropped and
 * nothing empty.
 *
 * The last row is ragged by design. Justifying it would mean stretching the
 * final frames, which reintroduces the distortion the whole component exists
 * to avoid.
 */

export type ContactSheetClip = {
  id: string
  slug: string
  titleAr: string
  titleEn: string
  /** Prisma hands this over as a Decimal; only `Number()` is ever called on it. */
  durationS: number | string | { toString(): string }
  width: number
  height: number
  thumbnailKeys: string[]
}

function clipLabel(clip: ContactSheetClip) {
  return pickLocalised(clip.titleAr, clip.titleEn)
}

export function ClipContactSheet({ clips }: { clips: ContactSheetClip[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {clips.map((clip, index) => (
        <li
          key={clip.id}
          {...REVEAL}
          style={{
            // The tile's shape IS the clip's shape. Falls back to 16:9 only if
            // the probe never recorded dimensions, which is a broken ingest
            // rather than a portrait clip — guessing tall there would be worse.
            aspectRatio:
              clip.width > 0 && clip.height > 0 ? `${clip.width}/${clip.height}` : '16/9',
            ...revealDelay(index),
          }}
          /*
           * Strip height, and it is deliberately short.
           *
           * The album page keeps a sticky price panel, so the content column is
           * ~620px even on a wide screen. At 176px tall a landscape frame is
           * 313px wide and only two fit per row — and a row holding one
           * landscape plus one portrait filled 412 of 620px, leaving a third of
           * the row empty. Raggedness is fine at the END of a sheet and reads
           * as broken in the MIDDLE of one. Shorter frames pack three or four
           * to a row and the gaps close.
           */
          className="h-24 shrink-0 grow-0 sm:h-28 lg:h-32"
        >
          <Link
            href={`/footage/${clip.slug}`}
            /*
             * The title is the accessible name and the tooltip, and is NOT
             * drawn on the frame.
             *
             * It was, and it read «الرياض — شوارع النهار — لقطة ٣» on all
             * twenty-one tiles: the album's own name repeated back at someone
             * already on the album's page, plus an index. On a 72px-wide
             * portrait frame it wrapped to three lines and spilled past the
             * bottom edge. A contact sheet is for looking at frames; the
             * duration is the only number worth printing on one.
             */
            aria-label={clipLabel(clip)}
            title={clipLabel(clip)}
            className="group relative block size-full overflow-hidden rounded-md border bg-ink"
          >
            {mediaUrl(clip.thumbnailKeys[0]) ? (
              <img
                src={mediaUrl(clip.thumbnailKeys[0]) ?? undefined}
                alt={t('catalogue.altClipThumb', { clip: clipLabel(clip) })}
                loading="lazy"
                className="size-full object-cover transition-transform duration-frame ease-lens group-hover:scale-105"
              />
            ) : (
              <span className="grid size-full place-items-center bg-gradient-to-br from-ink to-secondary">
                <span className="font-display text-sm font-bold text-gold/30">
                  {t('brand.name')}
                </span>
              </span>
            )}

            <PreviewWatermark />

            <span className="numeric absolute end-1.5 top-1.5 z-[3] rounded-sm bg-ink/80 px-1.5 py-0.5 text-2xs text-off-white backdrop-blur">
              {formatDuration(Number(clip.durationS))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
