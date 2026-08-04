import * as React from 'react'
import { cn } from '@/lib/utils'
import { isArabic } from '@/lib/i18n'

/**
 * Direction islands.
 *
 * Every catalogue record carries both an Arabic and an English string. The UI
 * is Arabic, but the English side is still present in the data — and whenever
 * a Latin run is rendered inside Arabic (a creator's English handle, a camera
 * model, a file key) the browser's bidi algorithm will drag its punctuation
 * and numerals to the wrong end of the surrounding sentence unless it is
 * isolated.
 *
 *   <Bilingual ar={album.titleAr} en={album.titleEn} />
 *
 * renders the Arabic string, falls back to English when Arabic is missing,
 * and marks whichever it used with the correct island.
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
  const value = ar ?? en
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

export { Bilingual, RtlIsland, LtrIsland, Numeric }
