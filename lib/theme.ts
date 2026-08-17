/**
 * Theme constants, deliberately outside the client component.
 *
 * `THEME_SCRIPT` is inlined into <head> by the root layout, which is a SERVER
 * component. Importing it from a `'use client'` module would pull a client
 * boundary into the server tree for the sake of one string.
 *
 * It has to be a string rather than a module: anything React loads runs after
 * first paint, so the page would render paper and then repaint ink. Wrapped in
 * try/catch because `localStorage` throws in private mode on some browsers,
 * and a theme preference is never worth a blank page.
 */
export const THEME_KEY = 'laqta-theme'

/**
 * It also marks the document `js`, which is what lets entrance motion exist at
 * all.
 *
 * A reveal has to start invisible, and "invisible" is a promise that something
 * will later make it visible. If scripting is off, or the bundle fails, or a
 * crawler never executes it, that promise is broken and the page is blank —
 * so the hidden state is scoped to `html.js` and the default is fully visible.
 * Setting the class here rather than from React is the whole point: React runs
 * after first paint, so the content would flash in and then be yanked back out
 * to animate.
 */
export const THEME_SCRIPT = `(function(){var e=document.documentElement;e.classList.add('js');try{var t=localStorage.getItem('${THEME_KEY}');var d=t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches);e.classList.toggle('dark',d);}catch(e2){}})()`
