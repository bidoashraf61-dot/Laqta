'use client'

import type { ReactNode } from 'react'
import { DirectionProvider } from '@radix-ui/react-direction'
import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'
import { TooltipProvider } from '@/components/ui/overlays'

/**
 * Client-side context, mounted once by app/layout.tsx.
 *
 * `DirectionProvider` is the important one: Radix reads direction from
 * context, not from the DOM. Without it, dropdowns align to the wrong edge,
 * `Select` opens on the wrong side, and arrow-key navigation in tabs and menus
 * runs backwards — the class of RTL bug that only shows up once someone
 * actually uses a keyboard.
 */
export function Providers({ children, session }: { children: ReactNode; session: Session | null }) {
  return (
    <SessionProvider session={session}>
      <DirectionProvider dir="rtl">
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </DirectionProvider>
    </SessionProvider>
  )
}
