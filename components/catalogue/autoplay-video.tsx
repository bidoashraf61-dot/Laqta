'use client'

import * as React from 'react'
import { Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PreviewWatermark } from '@/components/catalogue/watermark'
import { useT } from '@/lib/i18n-client'
import { mediaUrl } from '@/lib/media'

/**
 * A large video that plays itself when it scrolls into view.
 *
 * Used for the showreel on the shots section and for an album's trailer.
 *
 * ── Why IntersectionObserver and not `autoplay` ─────────────────────────────
 * A bare `autoplay` starts the moment the element mounts — so a video four
 * screens down is decoding, and burning a phone's battery and data, before
 * anyone has seen it. Playing on intersection means it starts when it becomes
 * the thing you are looking at, and stops when it is not.
 *
 * ── Muted is not a style choice ─────────────────────────────────────────────
 * Every browser refuses to autoplay audio. A video that expects sound simply
 * does not start, which reads as a broken player. It is muted, and the control
 * below says so rather than pretending otherwise.
 *
 * ── There is always a manual control ────────────────────────────────────────
 * Autoplay that cannot be stopped is a dark pattern and an accessibility
 * failure — WCAG asks for a mechanism to pause anything that moves for more
 * than five seconds. Under `prefers-reduced-motion` it never starts on its
 * own, and the button becomes the only way in, which is the point.
 */
export function AutoplayVideo({
  src: srcKey,
  poster: posterKey,
  label,
  fit = 'cover',
  className,
}: {
  /** A media KEY or "/"-rooted path, resolved here through `lib/media.ts`. */
  src: string
  poster?: string | null
  /** Describes the footage for anyone who cannot see it. */
  label: string
  /**
   * `contain` for a single clip, whose shape is part of what is being sold —
   * a 9:16 shot letterboxed on ink, never cropped into a 16:9 lie. `cover`
   * for a trailer or reel, which is cut to fill its frame.
   */
  fit?: 'cover' | 'contain'
  className?: string
}) {
  const src = mediaUrl(srcKey)
  const poster = mediaUrl(posterKey)
  const t = useT()
  // See watermark.tsx: a client component must supply this itself.
  const watermarkLabel = `${t('brand.name')} · ${t('catalogue.preview')}`

  const ref = React.useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = React.useState(false)
  const [reduced, setReduced] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  React.useEffect(() => {
    const el = ref.current
    if (!el || reduced) return

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play()
            .then(() => setPlaying(true))
            .catch(() => {
              // Low power mode, a data saver, a policy we cannot see. The
              // poster stays and the manual control still works.
            })
        } else {
          el.pause()
          setPlaying(false)
        }
      },
      // Half of it has to be on screen. A 10% threshold fires while the
      // section is still a sliver at the bottom of the viewport.
      { threshold: 0.5 },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [reduced, src, failed])

  function toggle() {
    const el = ref.current
    if (!el) return
    if (el.paused) {
      el.play()
        .then(() => setPlaying(true))
        .catch(() => {})
    } else {
      el.pause()
      setPlaying(false)
    }
  }

  /*
   * No playable source — the key has no CDN to resolve against, or the file
   * failed to load — and the player steps down to its poster. No play button:
   * a control that can never do anything is how a still becomes "broken".
   */
  if (!src || failed) {
    return (
      <div className={cn('relative overflow-hidden rounded-lg bg-ink', className)}>
        {poster ? (
          <img
            src={poster}
            alt={label}
            className={cn('size-full', fit === 'contain' ? 'object-contain' : 'object-cover')}
          />
        ) : null}
        <PreviewWatermark label={watermarkLabel} />
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-ink', className)}>
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        muted
        loop
        playsInline
        // The element is the source of truth for the control's label — a
        // browser can pause a video on its own (tab hidden, power saver).
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setFailed(true)}
        /*
         * `none`. This component already waits for the element to scroll into
         * view before it plays, so preloading anything is fetching for a
         * moment that may never come — and on the landing page it sits below
         * a full-screen hero, so it almost never does on a first visit.
         *
         * The poster carries the frame until then, which is the whole reason
         * a poster exists.
         */
        preload="none"
        aria-label={label}
        className={cn('size-full', fit === 'contain' ? 'object-contain' : 'object-cover')}
      />

      {/*
        The mark travels with the PLAYER, not with the card around it.
        
        It used to live on the poster container, so a still frame was marked
        and the moment the footage actually moved — which is the only moment
        worth screen-recording — it was clean. The trailer had no mark at all.
        Every surface that can show moving footage owns its own watermark, so
        there is no arrangement of components that produces an unmarked frame.
      */}
      <PreviewWatermark label={watermarkLabel} />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t('media.pause') : t('media.play')}
        className="absolute bottom-4 end-4 grid size-11 place-items-center rounded-full bg-ink/70 text-sand backdrop-blur transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>

      {/* Says the video is silent rather than leaving someone hunting for a
          volume control that will never do anything. */}
      <span className="absolute bottom-4 start-4 rounded-full bg-ink/70 px-3 py-1 text-xs text-sand backdrop-blur">
        {t('media.muted')}
      </span>
    </div>
  )
}
