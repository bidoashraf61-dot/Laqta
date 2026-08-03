'use client'

import type { ReactNode } from 'react'
import { DirectionProvider } from '@radix-ui/react-direction'
import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'
import { TooltipProvider } from '@/components/ui/overlays'
import type { Locale } from '@/lib/i18n'

/**
 * Client-side context, mounted once by app/[locale]/layout.tsx.
 *
 * `DirectionProvider` is the important one: Radix reads direction from context,
 * not from the DOM. Without it, dropdowns align to the wrong edge, `Select`
 * opens on the wrong side and arrow-key navigation in tabs and menus runs
 * backwards on Arabic pages — the exact class of RTL bug that only shows up
 * once someone actually uses a keyboard.
 */
export function Providers({
  children,
  locale,
  session,
}: {
  children: ReactNode
  locale: Locale
  session: Session | null
}) {
  return (
    <SessionProvider session={session}>
      <DirectionProvider dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </DirectionProvider>
    </SessionProvider>
  )
}
