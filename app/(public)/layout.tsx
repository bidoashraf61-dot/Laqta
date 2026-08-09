import type { ReactNode } from 'react'
import { auth } from '@/lib/auth'
import { SiteChrome } from '@/components/layout/site-chrome'
import { requestLocale } from '@/lib/locale-request'

/** Everything a signed-out visitor can reach: marketing, catalogue, policy. */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const session = await auth()
  return <SiteChrome session={session}>{children}</SiteChrome>
}
