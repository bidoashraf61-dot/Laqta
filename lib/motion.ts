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

/**
 * The only way a server component should opt into the entrance:
 *
 *     <div className="…" {...REVEAL}>…</div>
 *
 * `RevealScope` flips `data-reveal` to `"shown"` from an effect, and that
 * effect runs as soon as the *root* hydrates. Streamed Suspense boundaries
 * hydrate later, so an element that is already on screen gets its attribute
 * rewritten while React still believes it holds the server's `""`. React 19
 * reports that as a hydration mismatch — and it reports an *extra* attribute or
 * class the same way, so moving the state to another attribute does not help.
 *
 * The difference is intended, so it is declared: `suppressHydrationWarning`
 * silences the attribute diff on this one element and nothing below it. React
 * keeps the DOM's value during hydration and only writes `data-reveal` again
 * if the prop itself changes — it never does — so a revealed element stays
 * revealed.
 *
 * Written bare, `data-reveal` renders as `"true"` and carries no suppression;
 * the lint rule in .eslintrc.json sends every call site through here.
 */
export const REVEAL = { 'data-reveal': '', suppressHydrationWarning: true } as const
