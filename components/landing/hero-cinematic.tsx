'use client'

import { useEffect, useRef } from 'react'
import { Link } from '@/components/ui/link'
import { Headline, Prose } from '@/components/ui/typography'
import { useT } from '@/lib/i18n-client'

/**
 * The scroll-scrubbed hero.
 *
 * One continuous film, scrubbed by scroll — no still scenes between the video,
 * so it reads as a single cinematic take rather than a slideshow of photos and
 * clips. The film is the header: a bounded scroll region (not the whole page),
 * so the moment it finishes the sticky stage releases and the rest of the
 * landing flows normally beneath it. Nothing here is `position: fixed`, which
 * is why the old engine's overlay could never leak past the hero again.
 *
 * The mechanism is a pinned `<video>` whose `currentTime` tracks the wrapper's
 * scroll progress. Two pieces of hard-won handling are kept: seek coalescing
 * (never issue a new seek while the decoder is still resolving the last, or a
 * fast flick freezes the picture) and a muted play→pause prime (iOS will not
 * paint a seeked-but-never-played muted video otherwise). The copy is real DOM
 * — the `<h1>` is server-rendered — so search engines and reduced-motion users
 * get the headline whether or not the film ever scrubs.
 */
export function HeroCinematic() {
  const t = useT()

  const wrapRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const video = videoRef.current
    const copy = copyRef.current
    if (!wrap || !video) return

    // Reduced motion: the poster still stands, the copy stands, nothing scrubs.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Serve the lighter 720p encode to phones; the 1080p master is wasted on a
    // small decoder and only makes the scrub cost more.
    const mobile = window.matchMedia('(max-width: 860px)').matches
    video.src = mobile ? '/hero/vid/hero-web-m.mp4' : '/hero/vid/hero-web.mp4'

    let raf = 0
    let seeking = false
    let target = 0
    let disposed = false

    const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
    const onSeeked = () => {
      seeking = false
    }
    video.addEventListener('seeked', onSeeked)

    const measure = () => {
      const scrollable = wrap.offsetHeight - window.innerHeight
      const progress = scrollable > 0 ? clamp(-wrap.getBoundingClientRect().top / scrollable) : 0
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1
      // Stop a hair short of the end — the very last frame can be a black tail.
      target = progress * duration * 0.997
      // The copy holds over the film's opening, then clears so the footage
      // plays unobstructed; it is back the moment you scroll up.
      if (copy) copy.style.opacity = String(clamp(1 - progress / 0.32))
    }

    const tick = () => {
      if (disposed) return
      if (!seeking && video.readyState >= 2) {
        const t2 = clamp(target, 0, video.duration || 1)
        if (Math.abs(video.currentTime - t2) > 0.03) {
          seeking = true
          try {
            video.currentTime = t2
          } catch {
            seeking = false
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }

    const onScroll = () => measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    // Prime the decoder so the first seek paints instead of showing black.
    const prime = () => {
      const p = video.play()
      if (p && typeof p.then === 'function') p.then(() => video.pause()).catch(() => {})
    }
    video.addEventListener('loadeddata', prime, { once: true })

    measure()
    raf = requestAnimationFrame(tick)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
      video.removeEventListener('seeked', onSeeked)
    }
  }, [])

  return (
    <section aria-label={t('landing.heroLabel')} className="dark bg-ink text-foreground">
      {/* The scroll length of the hero. ~3 screens: enough to let the film play
          as a scrub, then the sticky stage releases and the sections begin. */}
      <div ref={wrapRef} className="relative h-[300vh]">
        <div className="sticky top-0 flex h-dvh items-center overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 -z-10 size-full object-cover"
            poster="/hero/00-window-NIGHT.jpg"
            muted
            playsInline
            preload="auto"
            aria-hidden
          />
          {/* No watermark on the hero, deliberately — the one exception to the
              rule that every moving frame carries one.

              This film is the brand's own opening title, not a preview being
              offered for sale: it is a cut, not a shot anyone can buy, and the
              marks were tiling across the first thing a visitor ever sees.
              Every frame that IS purchasable — the wall, the grids, the
              trailers, the clip players — is still marked. */}

          {/* Legibility scrim: the copy sits at the inline-start (the right, in
              this RTL-only app), so the ground is darkened from the right and
              the bottom. `to-l` is a paint direction, not a layout property —
              it correctly weights the start edge here. */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/45 to-ink/10" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-l from-ink/85 via-ink/25 to-transparent" />

          <div ref={copyRef} className="container-tight w-full">
            <Headline
              as="h1"
              size="display"
              lead={t('landing.heroLead')}
              bold={t('landing.heroBold')}
              className="max-w-4xl"
            />
            <Prose size="lg" className="mt-6 max-w-xl text-foreground/85">
              {t('landing.heroBody')}
            </Prose>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/footage"
                className="inline-flex h-12 items-center rounded-md bg-gold px-6 text-base font-bold text-gold-foreground shadow-glow transition-colors hover:bg-gold-400"
              >
                {t('landing.heroExplore')}
              </Link>
              {/* Scrolls to the showreel in the footage wall below — a plain
                  anchor so a same-page hash never depends on the client router. */}
              <a
                href="#showreel"
                className="inline-flex h-12 items-center rounded-md border border-foreground/25 px-6 text-base font-medium text-foreground transition-colors hover:border-foreground/50"
              >
                {t('landing.heroWatchTrailer')}
              </a>
            </div>
          </div>

          {/* Scroll cue — the one authored motion moment on the hero. */}
          <span className="pointer-events-none absolute inset-x-0 bottom-6 mx-auto flex w-fit flex-col items-center gap-2 text-xs uppercase tracking-[0.16em] text-foreground/60">
            {t('landing.scrollHint')}
            <span className="grid h-8 w-5 place-items-start justify-center rounded-full border-2 border-foreground/30 pt-1.5">
              <span className="animate-scroll-cue h-1.5 w-1 rounded-full bg-gold" />
            </span>
          </span>
        </div>
      </div>
    </section>
  )
}
