/**
 * The pre-paint inline script.
 *
 * Inlined into <head> by the root layout, which is a SERVER component —
 * importing this from a `'use client'` module would pull a client boundary into
 * the server tree for the sake of one string.
 *
 * It has to be a string rather than a module: anything React loads runs after
 * first paint, and the whole point is to run before it.
 *
 * ── Why there is no theme in here any more ──────────────────────────────────
 * The portal is light. It has one ground — paper — and `.dark` is no longer a
 * document mode a visitor chooses; it is a SCOPE, applied to the things that
 * are a frame rather than chrome: the site header, the dashboard shells, the
 * hero, a footage placeholder. Those are dark because film is dark, not
 * because of an OS preference, so nothing here reads `prefers-color-scheme`
 * and nothing is stored.
 *
 * What remains is the `js` marker, and it is load-bearing. Entrance motion
 * hides content by default, and hidden-by-default is a promise that something
 * will reveal it. Scoping that promise to `html.js` means no JavaScript gives
 * a fully visible page rather than a blank one — and setting the class here,
 * before the first paint, is what stops content flashing in and being pulled
 * back out to animate. See components/ui/reveal.tsx.
 */
export const THEME_SCRIPT = `document.documentElement.classList.add('js')`
