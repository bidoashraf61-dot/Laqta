'use client'

import NextLink from 'next/link'
import * as React from 'react'
import { useLocale } from '@/lib/i18n-client'
import { localePath } from '@/lib/locale'

/**
 * `next/link`, with the locale kept.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * English is served under `/en`, so a bare `href="/albums"` on an English page
 * navigates to the ARABIC albums page. Every internal link in the app was that
 * link: one click from `/en` and the reader was back in Arabic with no way to
 * tell what had happened. A translated site whose navigation leaves the
 * translation is worse than no translation.
 *
 * ── Why a component and not a helper at each call site ──────────────────────
 * A helper is a thing you can forget. There are ~130 internal hrefs; the one
 * that gets added next week without the wrapper is the one that drops someone
 * back into the wrong language, and nothing fails. Swapping the import means
 * the default is correct and getting it wrong takes deliberate effort.
 *
 * ── Why it is a client component ────────────────────────────────────────────
 * `next/link` already is one, so this costs nothing extra, and reading the
 * locale from context is the only source that works in both render passes —
 * see lib/i18n-client for why the server store is not visible here.
 */
export const Link = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<typeof NextLink>
>(function Link({ href, ...props }, ref) {
  const locale = useLocale()
  return <NextLink ref={ref} href={localiseHref(href, locale)} {...props} />
})

/**
 * A plain `<a>`, for the navigations that must not be soft.
 *
 * This codebase has been bitten three times by App Router client navigations
 * that fetch their payload, return 200, and then silently decline to commit —
 * see "Client-router navigations that never commit" in CLAUDE.md. Those call
 * sites deliberately use an anchor, and they need the locale prefix too.
 */
export const Anchor = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<'a'>
>(function Anchor({ href, ...props }, ref) {
  const locale = useLocale()
  return <a ref={ref} href={href ? String(localiseHref(href, locale)) : undefined} {...props} />
})

/**
 * Leaves anything that is not an app-internal path alone: an absolute URL, a
 * `mailto:`, a bare `#anchor`, or a path already carrying the prefix. Only
 * same-origin paths belong to the locale.
 */
function localiseHref(
  href: React.ComponentPropsWithoutRef<typeof NextLink>['href'],
  locale: 'ar' | 'en',
) {
  if (locale === 'ar') return href
  if (typeof href !== 'string') return href
  if (!href.startsWith('/') || href.startsWith('//')) return href

  const [path, rest] = splitPath(href)
  return localePath(locale, path) + rest
}

/** Keeps the query and hash out of the prefixing. */
function splitPath(href: string): [string, string] {
  const cut = href.search(/[?#]/)
  return cut === -1 ? [href, ''] : [href.slice(0, cut), href.slice(cut)]
}
