import { cache } from 'react'

/**
 * Which language this request is being rendered in.
 *
 * ── Why a store and not an argument ─────────────────────────────────────────
 * `t()` is synchronous and called from 1,200 places, so the locale cannot be
 * threaded through as a parameter without touching all of them. A plain
 * module-level `let` would work exactly until two requests overlap — which on a
 * server is immediately — and then an Arabic reader gets an English page at
 * random.
 *
 * ── Why React's `cache()` and not AsyncLocalStorage ─────────────────────────
 * AsyncLocalStorage cannot wrap an RSC render. The obvious shape,
 *
 *     return runWithLocale(locale, () => children)
 *
 * does nothing: `children` is already-constructed JSX, and React renders it
 * later — long after that callback has returned and the ALS scope has closed.
 *
 * `cache()` is scoped to the render itself. Each server render gets its own
 * holder object, and because React renders a parent's body to completion before
 * it renders that parent's children, a `setLocale()` call in the root layout is
 * guaranteed to land before any descendant calls `t()`.
 *
 * ── The browser half ────────────────────────────────────────────────────────
 * On the client there is exactly one locale per tab, so a module variable is
 * correct there and the concurrency argument above does not apply. `cache()` in
 * the browser build has no per-render scope, so reading it there would silently
 * hand back the default — hence the explicit branch rather than one code path.
 */

export const LOCALES = ['ar', 'en'] as const
export type Locale = (typeof LOCALES)[number]

/** Arabic is the product's first language and the bare-path default. */
export const DEFAULT_LOCALE: Locale = 'ar'

export const DIRECTION: Record<Locale, 'rtl' | 'ltr'> = { ar: 'rtl', en: 'ltr' }

/**
 * The tag for `Intl` — region-qualified, because `ar-SA` and `ar-EG` disagree
 * about calendars, numerals and month names, and this product means the Saudi
 * one.
 */
export const BCP47: Record<Locale, string> = { ar: 'ar-SA', en: 'en' }

/**
 * The tag for `<html lang>` — the bare subtag, deliberately.
 *
 * Region on the document is a claim about the *reader*, not about the
 * formatting: it tells a screen reader and a translation prompt that this page
 * is for Saudi Arabia specifically, when in fact the Arabic here reads the same
 * from Cairo or Amman. Formatting still uses the region-qualified tag above.
 */
export const HTML_LANG: Record<Locale, string> = { ar: 'ar', en: 'en' }

/** Header the middleware writes and the root layout reads. */
export const LOCALE_HEADER = 'x-laqta-locale'

/**
 * Set by the middleware — for an admin only — when the URL carries
 * `?copyPreview=<id>`: this render shows that preview's unpublished copy
 * (DEV-64b). Always overwritten, so a visitor cannot send it.
 */
export const COPY_PREVIEW_HEADER = 'x-laqta-copy-preview'

const IS_SERVER = typeof window === 'undefined'

const holder = cache((): { current: Locale } => ({ current: DEFAULT_LOCALE }))

let clientLocale: Locale = DEFAULT_LOCALE

export function setLocale(locale: Locale): void {
  if (IS_SERVER) holder().current = locale
  else clientLocale = locale
}

/**
 * Falls back to Arabic rather than throwing.
 *
 * No store means something rendered outside a request — a build-time
 * evaluation, a script. Arabic is the right answer there, and a hard failure
 * would take a page down over a language preference.
 */
export function currentLocale(): Locale {
  return IS_SERVER ? holder().current : clientLocale
}

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'ar' || value === 'en'
}

/**
 * The path a given locale should serve.
 *
 * Arabic keeps the bare path — `laqta.sa/albums`, not `laqta.sa/ar/albums` —
 * because it is the default and the canonical form already indexed. English
 * takes an `/en` prefix, which the middleware rewrites away before routing, so
 * no route file has to exist twice.
 */
export function localePath(locale: Locale, pathname: string): string {
  const bare = pathname.replace(/^\/en(?=\/|$)/, '') || '/'
  return locale === 'en' ? (bare === '/' ? '/en' : `/en${bare}`) : bare
}

/**
 * The `alternates` block every indexable page needs.
 *
 * Two separate jobs that are easy to conflate:
 *
 *   - `canonical` is the URL of THIS page in THIS language. `/en/albums` must
 *     not point its canonical at `/albums`, or the English page asks Google to
 *     index the Arabic one instead and the translation never appears.
 *   - `languages` is the hreflang set — the other language of the same page. It
 *     is what stops two translations of one page being read as duplicates, and
 *     it has to be present on BOTH sides to be believed.
 */
/** `og:locale` for share cards — the language of THIS page, not always Arabic. */
export function ogLocale() {
  return currentLocale() === 'en' ? 'en_US' : 'ar_SA'
}

export function localeAlternates(path: string) {
  return {
    canonical: localePath(currentLocale(), path),
    languages: {
      ar: localePath('ar', path),
      en: localePath('en', path),
      'x-default': localePath('ar', path),
    },
  }
}

/** Strips an `/en` prefix — the path as the router will actually see it. */
export function stripLocale(pathname: string): string {
  return pathname.replace(/^\/en(?=\/|$)/, '') || '/'
}

/**
 * Picks the side of a bilingual DB column that matches the interface language.
 *
 * The component equivalent is `<Bilingual ar en />`; this is for the places a
 * component cannot go — `generateMetadata`, JSON-LD, an `alt` attribute, a
 * breadcrumb string.
 *
 * Falls back to Arabic rather than to nothing. A record with no English title
 * is a content gap, and an English page showing an Arabic album name is a far
 * smaller failure than one showing a blank heading or an empty page title.
 *
 * Handles arrays as well as strings, because a policy document's body is a list
 * of paragraphs and it falls back as one unit — a half-Arabic, half-English
 * section reads as a mistake rather than as a pending translation.
 */
export function pickLocalised<T>(ar: T, en: T | undefined | null): T {
  if (currentLocale() !== 'en') return ar
  if (en == null) return ar
  if (typeof en === 'string' && en.length === 0) return ar
  if (Array.isArray(en) && en.length === 0 && Array.isArray(ar) && ar.length > 0) return ar
  return en
}
