import * as React from 'react'
import { cn } from '@/lib/utils'
import type { Locale } from '@/lib/i18n'

/**
 * Direction islands.
 *
 * Every catalogue record carries both an Arabic and an English string. Whenever
 * one is rendered inside a document of the *other* direction — Arabic album
 * titles in the LTR admin shell, an English creator handle in an Arabic page —
 * the browser's bidi algorithm will otherwise drag trailing punctuation and
 * numerals to the wrong end. These wrappers isolate the run.
 *
 *   <Bilingual ar={album.titleAr} en={album.titleEn} locale={locale} />
 *
 * renders the locale's string and marks it with the correct island class.
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
  locale,
  className,
}: {
  ar: string | null | undefined
  en: string | null | undefined
  locale: Locale
  className?: string
}) {
  const preferred = locale === 'ar' ? (ar ?? en) : (en ?? ar)
  if (!preferred) return null

  // Which script actually won, rather than which one we asked for — a missing
  // Arabic title falls back to English and must then be isolated LTR.
  const isArabic = preferred === ar
  const Island = isArabic ? RtlIsland : LtrIsland
  return (
    <Island className={className} lang={isArabic ? 'ar' : 'en'}>
      {preferred}
    </Island>
  )
}

/** Numerals, order numbers, IBANs and file keys — always LTR, tabular. */
function Numeric({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('numeric', className)} {...props} />
}

export { Bilingual, RtlIsland, LtrIsland, Numeric }
