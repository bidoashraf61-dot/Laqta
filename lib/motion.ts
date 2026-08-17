import type { CSSProperties } from 'react'

/**
 * Motion helpers that server components can call.
 *
 * Deliberately NOT in components/ui/reveal.tsx. That file is `'use client'`, so
 * everything it exports becomes a client reference — importing this helper from
 * a server component would hand back a module proxy rather than a function, and
 * calling it during the server render would throw. The engine has to be a
 * client component; the arithmetic does not.
 */

/**
 * The delay for one item in a staggered group:
 *
 *     {albums.map((album, i) => (
 *       <AlbumCard key={album.slug} album={album} index={i} />
 *     ))}
 *
 * Capped, because the delay is per item. An uncapped grid of forty albums
 * would leave the last one waiting almost two seconds behind the first — long
 * past the point where a reader decides the page is broken. Past the cap the
 * remainder lands together, which is what someone scrolling quickly perceives
 * regardless.
 */
const MAX_STAGGER_STEPS = 8

export function revealDelay(index: number): CSSProperties {
  const steps = Math.min(Math.max(index, 0), MAX_STAGGER_STEPS)
  // Multiplied against the token rather than baked into a number here, so
  // retuning the stagger is one edit in globals.css and not a rebuild of every
  // grid in the portal.
  return { '--reveal-delay': `calc(${steps} * var(--stagger-step))` } as CSSProperties
}
