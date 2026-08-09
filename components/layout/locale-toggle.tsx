'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { currentLocale, localePath } from '@/lib/locale'
import { cn } from '@/lib/utils'

/**
 * Arabic ⇄ English, on the page you are already on.
 *
 * ── Why a plain `<a>` and not `next/link` ───────────────────────────────────
 * Two reasons, and either alone would be enough.
 *
 * First, this codebase has been bitten three times by App Router client
 * navigations that fetch their RSC payload, return 200, and then silently
 * decline to commit — the URL never changes and nothing errors. A language
 * switch that appears to do nothing is indistinguishable from a broken site.
 *
 * Second, and specific to this control: `dir` and `lang` live on `<html>`,
 * which the root layout owns. A client-side navigation re-renders the tree but
 * does not re-run the document shell, so a soft switch would load English strings
 * into a document still marked `dir="rtl"` — every line of English laid out
 * right-to-left. A full document load is not a cost here, it is the requirement.
 *
 * ── Why the label is in the target language ─────────────────────────────────
 * "English" on the Arabic page, "العربية" on the English one. A switcher
 * labelled in the language you are already reading asks you to guess what it
 * does; labelled in the destination, it shows you.
 */
export function LocaleToggle({ className }: { className?: string }) {
  const pathname = usePathname() ?? '/'
  const params = useSearchParams()
  const active = currentLocale()
  const target = active === 'ar' ? 'en' : 'ar'

  const query = params?.toString()
  const href = localePath(target, pathname) + (query ? `?${query}` : '')

  return (
    <a
      href={href}
      // `lang` on the element itself: without it a screen reader announces
      // "English" with Arabic phonemes, and "العربية" with English ones.
      lang={target}
      dir={target === 'ar' ? 'rtl' : 'ltr'}
      hrefLang={target}
      aria-label={target === 'en' ? 'Switch to English' : 'التبديل إلى العربية'}
      className={cn(
        'grid h-9 min-w-9 place-items-center rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {target === 'en' ? 'EN' : 'ع'}
    </a>
  )
}
