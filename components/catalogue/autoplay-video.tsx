'use client'

import * as React from 'react'
import { Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PreviewWatermark } from '@/components/catalogue/watermark'
import { useT } from '@/lib/i18n-client'

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
  src,
  poster,
  label,
  className,
}: {
  src: string
  poster?: string | null
  /** Describes the footage for anyone who cannot see it. */
  label: string
  className?: string
}) {
  const t = useT()
  // See watermark.tsx: a client component must supply this itself.
  const watermarkLabel = `${t('brand.name')} · ${t('catalogue.preview')}`

  const ref = React.useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = React.useState(false)
  const [reduced, setReduced] = React.useState(false)

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
  }, [reduced])

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

  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-ink', className)}>
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={label}
        className="size-full object-cover"
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
