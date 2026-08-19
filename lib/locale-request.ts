import { headers } from 'next/headers'
import { translate } from '@/lib/i18n'
import { DEFAULT_LOCALE, isLocale, LOCALE_HEADER, setLocale, type Locale } from '@/lib/locale'

/**
 * Reads the locale the middleware resolved, and seeds the store with it.
 *
 * ── Why this is separate from lib/locale.ts ─────────────────────────────────
 * `next/headers` is server-only and throws if it reaches a client bundle.
 * `lib/locale.ts` is imported by `lib/i18n.ts`, which every client component
 * that calls `t()` pulls in — so the header read has to live in its own module
 * that only server code touches.
 *
 * ── Why it is async, and why `t()` is not ───────────────────────────────────
 * `headers()` returns a promise in Next 15. A synchronous `t()` therefore
 * cannot read it, which is exactly why the value is lifted out once — here, at
 * the top of the tree — and parked in a store the rest of the render reads
 * synchronously.
 *
 * Safe to call more than once: it is a header read and an idempotent write, so
 * `generateMetadata` and the layout can each call it without coordinating.
 */
export async function requestLocale(): Promise<Locale> {
  const value = (await headers()).get(LOCALE_HEADER)
  const locale = isLocale(value) ? value : DEFAULT_LOCALE
  setLocale(locale)
  return locale
}

/**
 * A translator bound to the language of THIS request, for use in server actions.
 *
 * ── Why an action cannot use `t()` ──────────────────────────────────────────
 * `t()` reads the locale from the ambient store above, which is built on
 * React's `cache()`. `cache()` memoises per RENDER — and a server action does
 * not run inside one. Outside a render, every call to the cached factory
 * returns a FRESH holder, so `setLocale()` writes to one object and
 * `currentLocale()` reads another. The store is therefore permanently at its
 * default, and that default is deliberately Arabic.
 *
 * The symptom is an Arabic sentence answering an English page while the
 * request header, the middleware and `requestLocale()` are all correct. The
 * page itself is right, so no screenshot and no page-level Arabic check can
 * see it — the leak arrives afterwards, in a response to a button.
 *
 * `requestLocale()` still RETURNS the correct locale; only its side effect is
 * useless here. So take the return value and pass it explicitly.
 *
 * Enforced by `npm run verify:action-locale`.
 */
export async function actionT() {
  const locale = await requestLocale()
  return (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars)
}
