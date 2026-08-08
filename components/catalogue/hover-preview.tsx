'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Poster that becomes a muted loop while the pointer is on it.
 *
 * ── Why the <video> is created lazily ───────────────────────────────────────
 * A wall of twelve tiles is twelve video elements. Mounting them all — even
 * with `preload="none"` — costs memory and decoder slots, and Safari caps the
 * number of simultaneous decoders on a page. The element is created on first
 * hover and kept afterwards, so the second hover is instant and the first one
 * costs a fetch nobody was going to make anyway.
 *
 * ── Why it degrades rather than breaks ──────────────────────────────────────
 * `src` is NULL until the transcode pipeline exists. A tile without a preview
 * must stay a poster and never render an empty <video>, which paints a black
 * rectangle where a photograph was.
 *
 * ── Touch and reduced motion ────────────────────────────────────────────────
 * Hover does not exist on touch, so nothing here is the only route to the
 * content — the whole tile is a link, and the explicit button is what a touch
 * user taps. Under `prefers-reduced-motion` the loop never starts: autoplaying
 * video is exactly what that preference is asking us not to do.
 */
export function HoverPreview({
  src,
  poster,
  alt,
  className,
}: {
  src: string | null
  poster: string | null
  alt: string
  className?: string
}) {
  const [armed, setArmed] = React.useState(false)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const [hovered, setHovered] = React.useState(false)

  // Play from an effect, not from the event handler. On first hover the
  // <video> does not exist yet — React has not committed it — so calling
  // play() there (even inside requestAnimationFrame) hits a null ref and the
  // tile stays a still. The effect runs after commit, when the element is
  // real.
  React.useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (hovered && !reduced) {
      v.play().catch(() => {
        // Autoplay can still be refused (low power mode, a policy we cannot
        // see). The poster is underneath and the tile stays correct.
      })
    } else {
      v.pause()
      v.currentTime = 0
    }
  }, [hovered, armed, reduced])

  function start() {
    if (!src || reduced) return
    setArmed(true)
    setHovered(true)
  }

  function stop() {
    setHovered(false)
  }

  return (
    <span
      className={cn('relative block size-full', className)}
      onPointerEnter={start}
      onPointerLeave={stop}
      onFocus={start}
      onBlur={stop}
    >
      {poster ? (
        <img src={poster} alt={alt} loading="lazy" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center bg-gradient-to-br from-ink to-secondary" />
      )}

      {armed && src ? (
        <video
          ref={videoRef}
          src={src}
          poster={poster ?? undefined}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </span>
  )
}
