'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'

/**
 * A hairline of gold across the top of the window while a navigation is in
 * flight.
 *
 * ── Why this is needed at all ───────────────────────────────────────────────
 * An App Router navigation is asynchronous and silent. Between the click and
 * the new page there is no browser spinner, no cursor change and no repaint —
 * the old page just sits there looking finished. On a slow query that reads as
 * a dead link, and the reader clicks again.
 *
 * This codebase has a sharper reason: navigations here sometimes fetch their
 * payload and then decline to commit at all (see CLAUDE.md). Without feedback
 * that failure is invisible. With it, the bar runs and never resolves, which is
 * at least an honest picture of what happened.
 *
 * ── Why a document click listener, not useLinkStatus ────────────────────────
 * `useLinkStatus` only reports for the <Link> it is rendered inside, so a
 * global bar would mean wrapping the children of ~130 links. Watching clicks
 * catches every internal navigation at one point — and it also catches the
 * plain <a> elements this codebase deliberately uses for its load-bearing
 * routes, which useLinkStatus cannot see.
 */

/**
 * Nothing appears for a navigation faster than this. Most are, and a bar that
 * flashes on every click is worse than no bar — it makes an instant app look
 * busy.
 */
const SHOW_AFTER_MS = 140

/**
 * A navigation still unresolved this long has almost certainly failed to
 * commit. The bar retires rather than spinning forever, because a permanent
 * progress indicator stops reading as progress.
 */
const GIVE_UP_MS = 8000

export function RouteProgress() {
  const pathname = usePathname()
  const [pending, setPending] = React.useState(false)

  // Any completed navigation changes the path, which is the signal to stop.
  React.useEffect(() => {
    setPending(false)
  }, [pathname])

  React.useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | undefined
    let giveUpTimer: ReturnType<typeof setTimeout> | undefined

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented) return
      // Modified clicks open a tab or download; the current page is not going
      // anywhere and must not pretend otherwise.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }

      const anchor = (event.target as Element | null)?.closest?.('a')
      if (!anchor) return
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return

      let destination: URL
      try {
        destination = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      if (destination.origin !== window.location.origin) return
      // Same page with only a hash change scrolls; it does not navigate.
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return
      }

      clearTimeout(showTimer)
      clearTimeout(giveUpTimer)
      showTimer = setTimeout(() => setPending(true), SHOW_AFTER_MS)
      giveUpTimer = setTimeout(() => setPending(false), GIVE_UP_MS)
    }

    // Capture phase: a handler on the link itself may stop propagation, and a
    // navigation that happens anyway would leave the bar unarmed.
    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      clearTimeout(showTimer)
      clearTimeout(giveUpTimer)
    }
  }, [])

  if (!pending) return null

  return (
    <div
      // Progress, not an alert: announced politely if at all, and never
      // stealing focus from the page the reader is leaving.
      role="status"
      aria-live="polite"
      // A transform does not flip with `dir`, so the sweep is mirrored
      // explicitly — otherwise Arabic readers watch progress run backwards,
      // out of the corner of the page they finish sentences in.
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-gold/10 rtl:-scale-x-100"
    >
      {/*
        Indeterminate on purpose. The router cannot report how much of a
        navigation is done, and a bar that creeps to 90% and waits is a
        fabricated number — it tells the reader something the app does not know.

        Marked essential so it survives the reduced-motion reset: a frozen
        progress bar is indistinguishable from a hung page, which is exactly
        the anxiety this element exists to remove.
      */}
      <span
        data-motion="essential"
        className="block h-full w-1/4 animate-route-sweep bg-gold"
        aria-hidden
      />
    </div>
  )
}
