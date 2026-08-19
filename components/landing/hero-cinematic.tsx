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
  const railRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const video = videoRef.current
    const copy = copyRef.current
    const rail = railRef.current
    if (!wrap || !video) return

    // Reduced motion: the poster still stands, the copy stands, nothing scrubs.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Serve the lighter 720p encode to phones; the 1080p master is wasted on a
    // small decoder and only makes the scrub cost more.
    const mobile = window.matchMedia('(max-width: 860px)').matches
    video.src = mobile ? '/hero/vid/hero-web-m.mp4' : '/hero/vid/hero-web.mp4'

    let raf = 0
    let target = 0
    let disposed = false
    let seekIssuedAt = 0
    let recovered = false
    let running = false
    let lastRailOpacity = ''
    let lastRailIndex = -1

    /*
     * How long a seek may be outstanding before we issue another.
     *
     * ── The bug this replaces ───────────────────────────────────────────────
     * The scrub used to keep its own `seeking` boolean: set true before
     * assigning `currentTime`, set false in the `seeked` handler. If that event
     * never arrived the flag stayed true FOREVER and the film froze for the
     * rest of the session — which is exactly the "stops responding after the
     * first pass" behaviour.
     *
     * And it does not always arrive. A browser can coalesce two seeks issued in
     * consecutive frames into one event, drop the event entirely when the
     * requested time resolves to the frame already displayed, or abandon the
     * seek when the target falls outside the buffered range and the network is
     * slow. Fast scrolling produces all three.
     *
     * So the element's own `video.seeking` is the source of truth — it cannot
     * be stranded, because the browser owns it — and this deadline covers the
     * case where the browser itself gets stuck: after 400ms mid-seek we simply
     * ask again, which is harmless if the first one lands.
     */
    const SEEK_DEADLINE_MS = 400

    const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))

    const measure = () => {
      const scrollable = wrap.offsetHeight - window.innerHeight
      const progress = scrollable > 0 ? clamp(-wrap.getBoundingClientRect().top / scrollable) : 0
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1
      // Stop a hair short of the end — the very last frame can be a black tail.
      target = progress * duration * 0.997
      // The copy holds over the film's opening, then clears so the footage
      // plays unobstructed; it is back the moment you scroll up.
      if (copy) copy.style.opacity = String(clamp(1 - progress / 0.32))

      /*
       * The USP rail takes over where the headline leaves off.
       *
       * It starts fading in at 0.30 — just before the headline is fully gone,
       * so the two cross rather than leaving a beat of bare film — and then
       * steps through its points across the rest of the scrub. The film is
       * doing the arguing by that stage; these are the four facts a viewer
       * needs alongside it, one at a time rather than as a list nobody reads.
       *
       * Driven by the SAME progress value as the video, which is what makes it
       * a ruler rather than a carousel: the marks are positions in the film,
       * so scrolling back up walks them backwards.
       */
      if (rail) {
        const RAIL_START = 0.3
        const opacity = String(clamp((progress - RAIL_START) / 0.08))
        // Writing the same value still dirties style and costs a recalculation.
        if (opacity !== lastRailOpacity) {
          rail.style.opacity = opacity
          lastRailOpacity = opacity
        }

        const items = rail.children
        const span = (1 - RAIL_START) / items.length
        const index = clamp(Math.floor((progress - RAIL_START) / span), 0, items.length - 1)
        // Four attribute writes per scroll event, every scroll event, is how a
        // decorative rail ends up costing more than the film it sits on.
        if (index !== lastRailIndex) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i] as HTMLElement
            // `data-state` rather than a class: three states, and the CSS reads
            // more like the thing it describes.
            item.dataset.state = i === index ? 'on' : i < index ? 'past' : 'ahead'
          }
          lastRailIndex = index
        }
      }
    }

    const tick = () => {
      if (disposed) return

      const duration = video.duration
      /*
       * `>= 1`, not `>= 2`.
       *
       * HAVE_METADATA is enough to ISSUE a seek, and issuing one is what makes
       * the browser fetch the frames. Requiring HAVE_CURRENT_DATA first was a
       * deadlock in Safari: with `preload="metadata"` it settles at readyState
       * 1 and waits to be asked for something, so the loop refused to seek, so
       * it was never asked, so it stayed at 1. Chrome hid this by speculatively
       * buffering to readyState 4 on its own.
       */
      if (video.readyState >= 1 && Number.isFinite(duration) && duration > 0) {
        const want = clamp(target, 0, duration)
        const now = performance.now()
        // Busy only while the ELEMENT says so, and only until the deadline.
        const busy = video.seeking && now - seekIssuedAt < SEEK_DEADLINE_MS

        if (!busy && Math.abs(video.currentTime - want) > 0.03) {
          seekIssuedAt = now
          try {
            video.currentTime = want
          } catch {
            // A seek can throw while the element is re-initialising. Nothing to
            // clean up — the next frame simply tries again.
          }
        }
      }

      if (running) raf = requestAnimationFrame(tick)
    }

    /*
     * The scrub loop runs only while the hero is on screen.
     *
     * It used to run for the life of the page — a requestAnimationFrame every
     * frame reading `video.duration` and `currentTime`, long after the film had
     * scrolled away. There is nothing to scrub when the hero is not visible,
     * and a loop that never stops is felt as the whole site being slow rather
     * than as this one section being slow.
     */
    const start = () => {
      if (running || disposed) return
      running = true
      raf = requestAnimationFrame(tick)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    const visibility = new IntersectionObserver(
      (entries) => (entries.some((e) => e.isIntersecting) ? start() : stop()),
      { rootMargin: '50% 0px' },
    )
    visibility.observe(wrap)

    // A background tab has nothing to scrub either.
    const onVisibilityChange = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVisibilityChange)

    /*
     * Decoder recovery.
     *
     * A media error leaves the element permanently unable to paint, and there
     * is no state the scrub loop can reach that fixes it — every subsequent
     * frame would seek a dead decoder. Reloading the source rebuilds it. Once
     * only: if the file itself is missing, retrying forever is a request loop
     * rather than a recovery.
     */
    const onError = () => {
      if (recovered || disposed) return
      recovered = true
      const src = video.currentSrc || video.src
      video.load()
      if (src) video.src = src
    }
    video.addEventListener('error', onError)

    const onScroll = () => measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)

    // Prime the decoder so the first seek paints instead of showing black.
    // Safari — on the phone AND on the desktop — will not render a muted video
    // that has been seeked but never played.
    const prime = () => {
      const played = video.play()
      if (played && typeof played.then === 'function') {
        played.then(() => video.pause()).catch(() => {})
      }
    }
    /*
     * `loadedmetadata`, not `loadeddata`.
     *
     * `loadeddata` fires at readyState 2 — which is the state Safari never
     * reaches unprompted, so the priming play() that exists specifically FOR
     * Safari was the one thing Safari never ran. `loadedmetadata` fires at
     * readyState 1 and is therefore reached in every browser.
     */
    video.addEventListener('loadedmetadata', prime, { once: true })

    measure()

    return () => {
      disposed = true
      stop()
      visibility.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
      video.removeEventListener('error', onError)
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
            /*
             * `metadata`, not `auto`.
             *
             * `auto` tells the browser to fetch the ENTIRE file as fast as it
             * can — 30MB on desktop — before anything else on the page gets
             * bandwidth. The landing page was pulling 41MB of video in its
             * first six seconds while the reader watched a poster.
             *
             * A scrub does not need the whole file; it needs the duration and
             * the seek index, which is what `metadata` fetches. The encodes are
             * faststart (moov atom at the front), so that is a few KB, and the
             * browser then range-requests only the parts actually scrubbed to.
             */
            preload="metadata"
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

          {/*
            The USP rail.

            Absolutely positioned against the stage rather than placed in flow,
            so it cannot push the headline around while it fades in. It sits at
            the inline-END edge — the headline owns the start edge — and the
            marks stack down the side like a ruler with the film as its scale.

            Hidden from assistive tech: every one of these facts is stated in
            full, as ordinary prose, in the sections below. A screen reader
            walking the hero should hear the headline and the two buttons, not
            four scroll positions.
          */}
          <ul ref={railRef} aria-hidden className="hero-usp-rail" style={{ opacity: 0 }}>
            {[1, 2, 3, 4].map((n) => (
              <li key={n} data-state="ahead">
                <span className="hero-usp-tick" />
                <span className="hero-usp-text">
                  <strong>{t(`landing.usp${n}`)}</strong>
                  <em>{t(`landing.usp${n}Note`)}</em>
                </span>
              </li>
            ))}
          </ul>

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
