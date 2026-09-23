'use client'

import * as React from 'react'
import { Play } from 'lucide-react'
import { PreviewWatermark } from '@/components/catalogue/watermark'
import { Anchor } from '@/components/ui/link'
import { cn, formatDuration } from '@/lib/utils'
import { useT, useLocale } from '@/lib/i18n-client'
import { mediaUrl } from '@/lib/media'

/**
 * The album's shots, as a uniform grid of links.
 *
 * ── Why every box is 16:9 even though the clips are not ─────────────────────
 * A uniform three-column grid is what makes twenty shots scannable; rows of
 * differing widths make the eye re-find the edge on every line. But cropping a
 * 9:16 clip into a 16:9 box hides the very thing a buyer needs to know, which
 * is what shape this album is.
 *
 * So the BOX is uniform and the FRAME is not: `object-contain` on an ink
 * ground, so a portrait clip shows as a tall frame with the ground either side.
 * Nothing is cropped, nothing is stretched, and the shape reads at a glance
 * from the letterboxing itself.
 *
 * ── Why a tile is a link and not a selector ─────────────────────────────────
 * An earlier version swapped a player at the top of the page. That made the
 * album a viewer, but it also meant the one thing a buyer does after finding a
 * shot they like — read its specs, check its clearance — was still a
 * navigation, and the page above it was now showing something other than the
 * trailer they arrived for. A tile goes to the shot's own page, which carries
 * the rest of the album underneath it, so browsing continues from there.
 */

export type AlbumShot = {
  id: string
  slug: string
  titleAr: string
  titleEn: string
  durationS: number | string | { toString(): string }
  thumbnailKeys: string[]
  /**
   * KEY of the shot's OWN watermarked preview (`Clip.previewKey`), resolved
   * here through `lib/media.ts#mediaUrl`. Null or unresolvable: the tile
   * stays a still.
   */
  previewKey: string | null
}

export function AlbumShots({
  shots,
  /** Marks the shot being viewed, when this grid sits on a clip's own page. */
  currentSlug,
  className,
}: {
  shots: AlbumShot[]
  currentSlug?: string
  className?: string
}) {
  const t = useT()
  const locale = useLocale()
  const watermarkLabel = `${t('brand.name')} · ${t('catalogue.preview')}`

  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <ul className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3', className)}>
      {shots.map((shot) => (
        <li key={shot.id}>
          <ShotTile
            shot={shot}
            current={shot.slug === currentSlug}
            label={locale === 'en' ? shot.titleEn : shot.titleAr}
            watermarkLabel={watermarkLabel}
            reduced={reduced}
          />
        </li>
      ))}
    </ul>
  )
}

function ShotTile({
  shot,
  current,
  label,
  watermarkLabel,
  reduced,
}: {
  shot: AlbumShot
  current: boolean
  label: string
  watermarkLabel: string
  reduced: boolean
}) {
  const [armed, setArmed] = React.useState(false)
  const [hovered, setHovered] = React.useState(false)
  const poster = mediaUrl(shot.thumbnailKeys[0])
  const preview = mediaUrl(shot.previewKey)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)

  /*
   * Play from an effect, not from the pointer handler.
   *
   * On the first hover the <video> does not exist yet — React has not committed
   * it — so calling play() in the handler hits a null ref and the tile stays a
   * still. The element is created lazily because a twenty-shot album is twenty
   * decoders otherwise, and Safari caps how many a page may hold at once.
   */
  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (hovered && !reduced) {
      video.play().catch(() => {})
    } else {
      video.pause()
      video.currentTime = 0
    }
  }, [hovered, reduced])

  const start = () => {
    if (reduced || !preview) return
    setArmed(true)
    setHovered(true)
  }

  return (
    <Anchor
      href={`/footage/${shot.slug}`}
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      onMouseEnter={start}
      onMouseLeave={() => setHovered(false)}
      // Focus arms the preview exactly as hover does, so the interaction is
      // not mouse-only.
      onFocus={start}
      onBlur={() => setHovered(false)}
      className={cn(
        'group relative block aspect-video w-full overflow-hidden rounded-md border bg-ink',
        'transition-[border-color,box-shadow] duration-hover ease-lens',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        current ? 'border-gold shadow-glow' : 'border-border hover:border-foreground/25',
      )}
    >
      {poster ? (
        <img
          src={poster}
          alt=""
          loading="lazy"
          // `contain`, not `cover`: a 9:16 clip shows as a tall frame inside the
          // box rather than being cropped to look like a 16:9 one.
          className="size-full object-contain"
        />
      ) : (
        <span className="grid size-full place-items-center bg-gradient-to-br from-ink to-secondary" />
      )}

      {armed && preview ? (
        <video
          ref={videoRef}
          src={preview}
          poster={poster ?? undefined}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          className="absolute inset-0 size-full object-contain"
        />
      ) : null}

      <PreviewWatermark className="z-[2]" label={watermarkLabel} />

      <span className="numeric absolute end-1.5 top-1.5 z-[3] rounded-sm bg-ink/80 px-1.5 py-0.5 text-2xs text-off-white backdrop-blur">
        {formatDuration(Number(shot.durationS))}
      </span>

      {current ? null : (
        <span
          aria-hidden
          className="absolute inset-0 z-[3] grid place-items-center opacity-0 transition-opacity duration-hover ease-lens group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <span className="grid size-9 place-items-center rounded-full bg-ink/70 text-off-white backdrop-blur">
            <Play className="size-4" />
          </span>
        </span>
      )}
    </Anchor>
  )
}
