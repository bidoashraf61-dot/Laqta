import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { SiteChrome } from '@/components/layout/site-chrome'
import { requestLocale } from '@/lib/locale-request'

/**
 * `/account/*` — any authenticated user.
 *
 * middleware.ts already blocks this path, so reaching the redirect below means
 * the matcher has a hole. Keeping the check is the point: middleware is the
 * gate, the layout is the lock, and a route that ships without a matcher entry
 * still cannot leak a stranger's library.
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
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
  if (!session?.user) redirect('/sign-in?callbackUrl=/account')

  return (
    <SiteChrome session={session}>
      <div className="container py-10">{children}</div>
    </SiteChrome>
  )
}
