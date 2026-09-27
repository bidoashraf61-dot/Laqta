'use client'

import * as React from 'react'
import { countIn, formatMoneyIn, translate, type CopyOverrideMap, type CountNoun } from '@/lib/i18n'
import { BCP47, DEFAULT_LOCALE, type Locale } from '@/lib/locale'

/**
 * The locale, for client components.
 *
 * ── Why client components can't use the server store ────────────────────────
 * Server rendering a client component is a SECOND React render, separate from
 * the RSC render that produced the tree around it. React's `cache()` scope does
 * not span the two, so a locale set during the RSC pass is simply not visible
 * here — which is exactly how the first version of this shipped an English page
 * with an Arabic header.
 *
 * ── Why not a module variable ───────────────────────────────────────────────
 * It would work in the browser, where a tab has one language. It would not work
 * during server rendering: two requests in different languages render
 * concurrently in one process, and every Suspense boundary is a point where
 * Node can interleave them. An Arabic reader would get an English button, at
 * random, under load — a bug that never reproduces locally and is invisible in
 * a build. Context is per-render by construction, so the question does not
 * arise.
 */

const LocaleContext = React.createContext<Locale>(DEFAULT_LOCALE)
const EMPTY: CopyOverrideMap = {}

/**
 * The owner's edited copy for this locale (DEV-64b) — published edits plus,
 * on a preview render, the drafts. Context for the same reason as the locale:
 * a module variable would be shared by every concurrent server render.
 */
const CopyContext = React.createContext<CopyOverrideMap | null>(null)

export function LocaleContextProvider({
  locale,
  copy = null,
  children,
}: {
  locale: Locale
  copy?: CopyOverrideMap | null
  children: React.ReactNode
}) {
  return (
    <LocaleContext.Provider value={locale}>
      <CopyContext.Provider value={copy}>{children}</CopyContext.Provider>
    </LocaleContext.Provider>
  )
}

/**
 * `t`, bound to this render's locale.
 *
 * Returns a function rather than a string so a component keeps calling
 * `t('some.key')` exactly as it did before — the only change at a call site is
 * one line at the top of the component.
 */
export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const locale = React.useContext(LocaleContext)
  // An empty map, never null, so the browser never falls through to the
  // server-only published store.
  const copy = React.useContext(CopyContext) ?? EMPTY
  return React.useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars, copy),
    [locale, copy],
  )
}

/**
 * `countOf`, for client components: «٦ لقطات», "22 clips". Reads the same
 * locale and edited copy as `useT()`.
 */
export function useCount(): (noun: CountNoun, n: number) => string {
  const locale = React.useContext(LocaleContext)
  const copy = React.useContext(CopyContext) ?? EMPTY
  return React.useCallback((noun: CountNoun, n: number) => countIn(locale, noun, n, copy), [locale, copy])
}

/** For formatting inside client components — `Intl` needs the same locale. */
export function useLocale(): Locale {
  return React.useContext(LocaleContext)
}

/**
 * Money, formatted for the locale in context.
 *
 * Client components must not call `formatMoney` — see the note beside
 * `formatMoneyIn` in lib/i18n.ts. This is the hook that makes doing the right
 * thing as short as doing the wrong one.
 */
export function useMoney() {
  const locale = useLocale()
  return (amount: number | string, currency = 'USD') =>
    formatMoneyIn(BCP47[locale], amount, currency)
}

/** `pickLocalised`, against the locale in context rather than the RSC store. */
export function usePick() {
  const locale = useLocale()
  return <T,>(ar: T, en: T | undefined | null): T => {
    if (locale !== 'en') return ar
    if (en == null) return ar
    if (typeof en === 'string' && en.length === 0) return ar
    return en
  }
}
