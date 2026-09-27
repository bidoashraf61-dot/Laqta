'use client'

import type { ReactNode } from 'react'
import { LocaleContextProvider } from '@/lib/i18n-client'
import type { Locale } from '@/lib/locale'
import type { CopyOverrideMap } from '@/lib/i18n'

/**
 * Hands the request's locale to the browser half of the tree.
 *
 * Thin on purpose: the context itself lives in `lib/i18n-client` beside `useT`,
 * because they are two halves of one mechanism and splitting them across
 * `lib/` and `components/` is how one gets changed without the other. This file
 * exists only so the root layout has a component to render.
 *
 * Why client components need their own channel at all — rather than reading the
 * same store the server components read — is recorded in `lib/i18n-client`.
 */
export function LocaleProvider({
  locale,
  copy,
  children,
}: {
  locale: Locale
  /** The owner's edited copy for this locale (DEV-64b). */
  copy?: CopyOverrideMap
  children: ReactNode
}) {
  return (
    <LocaleContextProvider locale={locale} copy={copy}>
      {children}
    </LocaleContextProvider>
  )
}
