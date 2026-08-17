'use client'

import * as React from 'react'

/**
 * Entrance choreography for the whole document.
 *
 * ── Why one engine instead of a <Reveal> wrapper ────────────────────────────
 * Almost every surface in this portal is a server component. Wrapping each
 * revealed thing in a client component would push a client boundary down into
 * the catalogue grid, the dashboard tables and the landing sections — dozens of
 * boundaries, each with its own hydration cost, to run the same four lines of
 * IntersectionObserver code.
 *
 * So the markup side is just an attribute. A server component writes
 * `data-reveal` and ships no JavaScript at all; this one client component,
 * mounted once in the root layout, finds every such element and reveals it.
 *
 * ── Why a MutationObserver ──────────────────────────────────────────────────
 * A single querySelectorAll on mount would only ever catch the first paint.
 * This app streams: a Suspense boundary resolves and injects a whole grid after
 * hydration, and an App Router navigation swaps the page without remounting the
 * layout. Both arrive as DOM mutations, and both must be picked up or the new
 * content stays at `opacity: 0` permanently — a blank page, which is a far
 * worse failure than no animation.
 *
 * ── The no-JS contract ──────────────────────────────────────────────────────
 * The hidden state is scoped to `html.js` in globals.css, and that class is set
 * by the inline script in <head>. If scripting never runs, `[data-reveal]` is
 * an inert attribute and the page renders exactly as it would have. Nothing
 * here is load-bearing for content being visible.
 */

const REVEAL_SELECTOR = '[data-reveal]:not([data-reveal="shown"])'

/**
 * Revealed a little after the edge rather than exactly at it. At `0px` an
 * element technically intersects while its first pixel is still off-screen, so
 * the animation is half over by the time it is readable and reads as a flicker.
 */
const ROOT_MARGIN = '0px 0px -8% 0px'

function show(element: Element) {
  element.setAttribute('data-reveal', 'shown')
}

export function RevealScope() {
  React.useEffect(() => {
    // Guard rather than assume: this runs in a browser, but jsdom in the unit
    // suite has no IntersectionObserver, and a missing API must degrade to
    // "everything visible" rather than to a blank document.
    if (typeof IntersectionObserver === 'undefined') {
      document.querySelectorAll(REVEAL_SELECTOR).forEach(show)
      return
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

    let everFired = false

    const observer = new IntersectionObserver(
      (entries) => {
        everFired = true
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          show(entry.target)
          // Reveals are one-way. Re-hiding on scroll-out means a reader who
          // scrolls back up watches the page rebuild itself, and it is the
          // single most common way this pattern turns from polish into noise.
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: ROOT_MARGIN, threshold: 0.01 },
    )

    function arm(root: ParentNode) {
      // If motion is unwelcome, resolve to the final state without ever
      // involving the observer — an element already on screen at load would
      // otherwise depend on a callback firing to become visible at all.
      if (reduced.matches) {
        root.querySelectorAll(REVEAL_SELECTOR).forEach(show)
        return
      }
      root.querySelectorAll(REVEAL_SELECTOR).forEach((el) => observer.observe(el))
    }

    arm(document)

    // Catches streamed-in Suspense content and client-side route changes.
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue
          if (node.matches(REVEAL_SELECTOR)) {
            reduced.matches ? show(node) : observer.observe(node)
          }
          arm(node)
        }
      }
    })
    mutations.observe(document.body, { childList: true, subtree: true })

    // Someone turning reduced motion on mid-session should not be left with a
    // half-revealed page waiting on scroll events they may never generate.
    const onPreferenceChange = () => {
      if (reduced.matches) document.querySelectorAll(REVEAL_SELECTOR).forEach(show)
    }
    reduced.addEventListener('change', onPreferenceChange)

    /*
     * The dead-man's switch.
     *
     * If the observer has not delivered a single entry by now, it is not going
     * to — and because the hidden state is real CSS, that leaves a reader
     * staring at an empty page. Browsers throttle IntersectionObserver in a
     * backgrounded tab, which is exactly what a middle-click "open in new tab"
     * produces, and it is easy to imagine other conditions with the same shape.
     *
     * Deliberately gated on "never fired at all" rather than "anything still
     * hidden": content below the fold is *supposed* to still be waiting, and a
     * blanket timeout would reveal the whole page and delete the effect.
     *
     * The trade is worth stating plainly — the worst case here is that a page
     * appears without its animation. The worst case without it is a page that
     * does not appear.
     */
    const deadMansSwitch = setTimeout(() => {
      if (everFired) return
      document.querySelectorAll(REVEAL_SELECTOR).forEach(show)
    }, 2500)

    return () => {
      observer.disconnect()
      mutations.disconnect()
      reduced.removeEventListener('change', onPreferenceChange)
      clearTimeout(deadMansSwitch)
    }
  }, [])

  return null
}

/** Stagger arithmetic lives in lib/motion.ts — see the note there for why. */
