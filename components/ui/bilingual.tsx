'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { isArabic } from '@/lib/i18n'
import { useLocale } from '@/lib/i18n-client'

/**
 * Direction islands.
 *
 * Every catalogue record carries both an Arabic and an English string.
 *
 *   <Bilingual ar={album.titleAr} en={album.titleEn} />
 *
 * picks the side matching the interface language, falls back to the other when
 * that side is empty, and marks whichever it actually used with the right
 * direction island.
 *
 * ── Why the island matters even so ──────────────────────────────────────────
 * Whenever a Latin run lands inside Arabic (a creator's English handle, a
 * camera model, a file key) the browser's bidi algorithm drags its punctuation
 * and numerals to the wrong end of the surrounding sentence unless it is
 * isolated. That is true in both directions, and it is why the island follows
 * the string that WON rather than the page's language: an English title on an
 * Arabic page and an Arabic title on an English page are the same problem
 * mirrored.
 *
 * ── Why this is a client component ──────────────────────────────────────────
 * It is a presentational leaf with no server-only dependency, and it is
 * rendered from both trees. A client component reads the locale from context,
 * which works in either; a server-only read would silently fall back to Arabic
 * everywhere this is used inside a client component.
 */

function RtlIsland({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('rtl-island', className)} {...props} />
}

function LtrIsland({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('ltr-island', className)} {...props} />
}

function Bilingual({
  ar,
  en,
  className,
}: {
  ar: string | null | undefined
  en: string | null | undefined
  className?: string
}) {
  const locale = useLocale()
  // Fall back rather than blank: a record with no English title is a content
  // gap, and showing its Arabic is far better than showing nothing.
  const value = locale === 'en' ? en || ar : ar || en
  if (!value) return null

  // Which script actually won, not which one we hoped for — a record with no
  // Arabic title falls back to English and must then be isolated LTR.
  const arabic = isArabic(value)
  const Island = arabic ? RtlIsland : LtrIsland
  return (
    <Island className={className} lang={arabic ? 'ar' : 'en'}>
      {value}
    </Island>
  )
}

/** Numerals, order numbers, IBANs and file keys — always LTR, tabular. */
function Numeric({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('numeric', className)} {...props} />
}

/**
 * Text whose script we do not control: a buyer's search query, a claimant's
 * name, a permit's issuing authority.
 *
 * `<bdi>` is the right primitive here rather than `.ltr-island`, because the
 * direction is genuinely unknown per value — "Empty Quarter timelapse" and
 * "الربع الخالي" both arrive through the same field, and forcing LTR on the
 * second would be as wrong as leaving the first un-isolated. `<bdi>` defaults
 * to `dir="auto"` with `unicode-bidi: isolate`, so each value picks its own
 * direction and none of them can leak into the Arabic sentence around it.
 */
function UserText({ children, className }: { children: React.ReactNode; className?: string }) {
  return <bdi className={className}>{children}</bdi>
}

export { Bilingual, RtlIsland, LtrIsland, Numeric, UserText }
