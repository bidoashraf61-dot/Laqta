'use client'

import * as React from 'react'
import { useLocale } from '@/lib/i18n-client'
import { DIRECTION } from '@/lib/locale'

/**
 * Three panels read as one section, advanced by scrolling.
 *
 * The stage pins for the length of the deck and vertical scroll drives the
 * track sideways, so «كيف تعمل لقطة», the value case and the FAQ arrive as one
 * continuous movement instead of three more stacked bands.
 *
 * ── Scroll-jacking, and the four ways out of it ─────────────────────────────
 * Taking over someone's scroll is a hostile pattern by default. It is allowed
 * here only because every way it normally goes wrong is closed:
 *
 *   1. **No JavaScript** → the panels are a plain vertical stack. The pinned
 *      layout lives entirely behind `html.js`, so a crawler and a reader
 *      without scripting both get ordinary sections in document order.
 *   2. **Reduced motion** → the same plain stack. Someone who has asked the
 *      system for less movement should not be handed the most movement on the
 *      page.
 *   3. **Small screens** → the same plain stack. A pinned deck on a phone
 *      fights the one gesture the whole device is built around, and a panel
 *      taller than the viewport becomes unreachable.
 *   4. **It always releases.** The pin is exactly as long as the deck is wide,
 *      so the section cannot swallow scroll indefinitely; overscrolling past
 *      the last panel continues down the page normally.
 *
 * Content is in the DOM either way. Nothing here decides whether the FAQ
 * exists — only how it is laid out.
 *
 * ── RTL ─────────────────────────────────────────────────────────────────────
 * `transform` does not flip with `dir`, so the sign is applied explicitly.
 * Arabic reads right to left, so the track travels the other way.
 */
export function ScrollDeck({ children, label }: { children: React.ReactNode; label: string }) {
  const locale = useLocale()
  const rtl = DIRECTION[locale] === 'rtl'

  const deckRef = React.useRef<HTMLDivElement>(null)
  const trackRef = React.useRef<HTMLDivElement>(null)
  const [active, setActive] = React.useState(0)

  const panels = React.Children.count(children)

  React.useEffect(() => {
    const deck = deckRef.current
    const track = trackRef.current
    if (!deck || !track) return

    // The same three gates the CSS uses, so JS never drives a layout that is
    // not pinned. `matchMedia` rather than a resize listener: the query
    // re-evaluates itself and reports only when the answer actually changes.
    const pinned = window.matchMedia('(min-width: 1024px) and (min-height: 640px)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

    let raf = 0
    let disposed = false

    const clear = () => {
      track.style.transform = ''
      setActive(0)
    }

    const measure = () => {
      if (!pinned.matches || reduced.matches) return clear()

      const scrollable = deck.offsetHeight - window.innerHeight
      if (scrollable <= 0) return clear()

      const progress = Math.min(1, Math.max(0, -deck.getBoundingClientRect().top / scrollable))
      const distance = track.scrollWidth - window.innerWidth
      // Negative in LTR (the track moves left), positive in RTL.
      track.style.transform = `translate3d(${(rtl ? 1 : -1) * progress * distance}px, 0, 0)`
      setActive(Math.min(panels - 1, Math.round(progress * (panels - 1))))
    }

    const tick = () => {
      if (disposed) return
      measure()
      raf = requestAnimationFrame(tick)
    }

    // rAF rather than reacting to each scroll event: the transform is read back
    // from layout every frame anyway, and a scroll handler that writes styles
    // interleaves reads and writes into a layout thrash.
    raf = requestAnimationFrame(tick)

    const onChange = () => measure()
    pinned.addEventListener('change', onChange)
    reduced.addEventListener('change', onChange)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      pinned.removeEventListener('change', onChange)
      reduced.removeEventListener('change', onChange)
    }
  }, [panels, rtl])

  return (
    <section
      ref={deckRef}
      aria-label={label}
      className="deck"
      // Drives the pinned height in CSS: one viewport of scroll per panel.
      style={{ '--deck-panels': panels } as React.CSSProperties}
    >
      <div className="deck-stage">
        <div ref={trackRef} className="deck-track">
          {React.Children.map(children, (child, index) => (
            <div className="deck-panel" aria-hidden={undefined} data-panel={index}>
              {child}
            </div>
          ))}
        </div>

        {/*
          Where you are in the deck.

          Not a control. Making these clickable would mean animating the page's
          scroll position, and a reader who then scrolled by hand would fight
          the animation. They tell you three panels exist and which one you are
          on, which is the thing a pinned section otherwise hides.

          `aria-hidden` because the panels themselves are all in the accessibility
          tree in document order — a screen reader is already reading the
          content straight through and has no use for a visual position.
        */}
        <div aria-hidden className="deck-dots">
          {Array.from({ length: panels }).map((_, index) => (
            <span key={index} data-on={index === active ? '' : undefined} />
          ))}
        </div>
      </div>
    </section>
  )
}
