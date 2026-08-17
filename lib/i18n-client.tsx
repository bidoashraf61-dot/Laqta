'use client'

import * as React from 'react'
import { formatMoneyIn } from '@/lib/i18n'
import { translate } from '@/lib/i18n'
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

export function LocaleContextProvider({
  locale,
  children,
}: {
  locale: Locale
  children: React.ReactNode
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
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
  return React.useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  )
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
