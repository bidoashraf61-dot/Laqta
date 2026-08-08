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

export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var d=t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})()`
