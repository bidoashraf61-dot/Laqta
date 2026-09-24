'use client'

import * as React from 'react'
import { Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Anchor } from '@/components/ui/link'
import { PreviewWatermark } from '@/components/catalogue/watermark'
import { useT } from '@/lib/i18n-client'
import { mediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'

/** One album, already formatted for the locale by the server section. */
export type TheatreItem = {
  slug: string
  title: string
  href: string
  trailerKey: string
  posterKey: string | null
  clips: string
  price: string
  videoLabel: string
}

/**
 * The trailer theatre: one letterboxed player and the albums it can show.
 *
 * ── Weight ──────────────────────────────────────────────────────────────────
 * The landing already carries a full-screen hero film, so this section must
 * cost nothing until it is reached. The `<video>` is rendered WITHOUT a `src`
 * until the theatre is within one viewport of the screen, and with
 * `preload="none"` after that; list posters are `loading="lazy"`. Before the
 * reader scrolls here the section is HTML and a poster that is not requested.
 *
 * ── Motion ──────────────────────────────────────────────────────────────────
 * Plays muted when half the player is on screen, pauses when it leaves (the
 * same contract as `AutoplayVideo`). Under `prefers-reduced-motion` it never
 * starts on its own; picking an album only swaps the poster, and the play
 * button is the only way in. A reader who presses pause stays paused — the
 * observer does not override a decision a person made.
 *
 * ── Failure ─────────────────────────────────────────────────────────────────
 * A trailer that fails to load drops back to its poster with no controls — a
 * dead play button reads as a broken product; a still reads as a still.
 */
export function TrailerTheatre({ items }: { items: TheatreItem[] }) {
  const t = useT()
  const watermarkLabel = `${t('brand.name')} · ${t('catalogue.preview')}`

  const frameRef = React.useRef<HTMLDivElement | null>(null)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)

  const [index, setIndex] = React.useState(0)
  const [near, setNear] = React.useState(false)
  const [inView, setInView] = React.useState(false)
  const [reduced, setReduced] = React.useState(false)
  const [playing, setPlaying] = React.useState(false)
  const [muted, setMuted] = React.useState(true)
  const [userPaused, setUserPaused] = React.useState(false)
  const [failed, setFailed] = React.useState<Record<string, true>>({})

  const current = items[index] ?? items[0]
  const src = near ? mediaUrl(current.trailerKey) : null
  const poster = mediaUrl(current.posterKey)
  const broken = Boolean(failed[current.slug])

  React.useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  // Two observers: one far out to attach the source, one at half-visible to play.
  React.useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const nearIo = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true)
          nearIo.disconnect()
        }
      },
      { rootMargin: '100% 0px' },
    )
    const viewIo = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.5,
    })
    nearIo.observe(el)
    viewIo.observe(el)
    return () => {
      nearIo.disconnect()
      viewIo.disconnect()
    }
  }, [])

  // The single place the player is told to play or stop.
  React.useEffect(() => {
    const video = videoRef.current
    if (!video || !src || broken) return
    if (inView && !reduced && !userPaused) {
      video.play().catch(() => {
        // Low power mode or a data saver. The poster stays; the button works.
      })
    } else {
      video.pause()
    }
    // `current.slug`: the element is re-keyed per album, and two albums may
    // share a source, so `src` alone does not mark a new element.
  }, [inView, reduced, userPaused, src, broken, current.slug])

  function toggle() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      setUserPaused(false)
      // Explicit intent: play even under reduced motion or off-threshold.
      video.play().catch(() => {})
    } else {
      setUserPaused(true)
      video.pause()
    }
  }

  function toggleMute() {
    const video = videoRef.current
    const next = !muted
    setMuted(next)
    if (video) video.muted = next
  }

  function select(i: number) {
    if (i === index) return
    setIndex(i)
    setPlaying(false)
    // Choosing an album is a request to see it — but not under reduced motion,
    // where only the play button starts footage.
    if (!reduced) setUserPaused(false)
  }

  return (
    <div>
      {/* The letterbox. 16:9 on a phone, where 2.39:1 would be a strip. */}
      <div
        ref={frameRef}
        className="relative aspect-video overflow-hidden rounded-lg bg-ink shadow-soft md:aspect-[2.39/1]"
      >
        {src && !broken ? (
          <video
            // A new element per album: swapping `src` on a playing element
            // leaves a frame of the previous trailer on some browsers.
            key={current.slug}
            ref={videoRef}
            src={src}
            poster={poster ?? undefined}
            muted={muted}
            loop
            playsInline
            preload="none"
            aria-label={current.videoLabel}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => setFailed((f) => ({ ...f, [current.slug]: true }))}
            className="size-full object-cover"
          />
        ) : poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt={current.videoLabel}
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : null}

        <PreviewWatermark label={watermarkLabel} />

        {src && !broken ? (
          <div className="absolute bottom-4 end-4 z-[3] flex gap-2">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? t('media.unmute') : t('media.mute')}
              aria-pressed={!muted}
              className="grid size-11 place-items-center rounded-full bg-ink/70 text-sand backdrop-blur transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand"
            >
              {muted ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
            </button>
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? t('media.pause') : t('media.play')}
              className="grid size-11 place-items-center rounded-full bg-ink/70 text-sand backdrop-blur transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand"
            >
              {playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* What is on screen, and the way to it. Announced when it changes. */}
        <div aria-live="polite">
          <h3 className="font-display text-2xl font-bold leading-[1.3] text-foreground">
            {current.title}
          </h3>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-base text-muted-foreground">{current.clips}</span>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            {/* The one gold thing in the section: what it costs. */}
            <span className="numeric text-2xl font-bold text-gold">{current.price}</span>
          </p>
          <Button asChild size="lg" className="mt-6">
            {/* A plain anchor: the album is the load-bearing navigation here. */}
            <Anchor href={current.href}>
{t('catalogue.openAlbum')}</Anchor>
          </Button>
        </div>

        {items.length > 1 ? (
          <ul aria-label={t('landing.trailersListLabel')} className="divide-y divide-border border-y">
            {items.map((item, i) => {
              const thumb = mediaUrl(item.posterKey)
              const selected = i === index
              return (
                <li key={item.slug}>
                  <button
                    type="button"
                    onClick={() => select(i)}
                    aria-pressed={selected}
                    className={cn(
                      'group flex w-full items-center gap-4 py-3 text-start transition-colors duration-hover ease-lens focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      selected ? 'text-foreground' : 'text-foreground/70 hover:text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'relative block aspect-[2.39/1] w-28 shrink-0 overflow-hidden rounded-sm bg-ink ring-offset-2 ring-offset-background transition-shadow sm:w-36',
                        selected && 'ring-2 ring-foreground',
                      )}
                    >
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="size-full object-cover"
                        />
                      ) : null}
                      {selected && playing ? (
                        <span className="absolute inset-0 grid place-items-center bg-ink/40 text-sand">
                          <Play className="size-4" aria-hidden />
                        </span>
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 font-medium">{item.title}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-2 text-sm text-muted-foreground">
                        <span>{item.clips}</span>
                        <span aria-hidden>·</span>
                        <span className="numeric">{item.price}</span>
                      </span>
                    </span>
                    {selected ? (
                      <span className="shrink-0 text-xs font-medium text-foreground">
                        {t('landing.trailersNowShowing')}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
