import { headers } from 'next/headers'
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
