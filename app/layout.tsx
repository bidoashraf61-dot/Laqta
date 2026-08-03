import type { ReactNode } from 'react'
import '@/styles/globals.css'

/**
 * Root layout — deliberately a pass-through.
 *
 * `<html>` cannot be rendered here, because `lang` and `dir` depend on the
 * `[locale]` segment and a root layout sits above it. app/[locale]/layout.tsx
 * emits the document shell instead; everything reachable by a browser is
 * behind a locale prefix, enforced by middleware.ts.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
