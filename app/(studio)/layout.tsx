import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { DashboardShell } from '@/components/dashboard/shell'
import { requestLocale } from '@/lib/locale-request'

/**
 * `/studio/*` — creator or admin.
 *
 * The guard is repeated here even though middleware.ts already runs it: the
 * layout is the last place a role can be checked before any page below it
 * fetches data, so duplicating the check is cheap insurance.
 */
export default async function StudioLayout({ children }: { children: ReactNode }) {
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
  if (!session?.user) redirect('/sign-in?callbackUrl=/studio')
  if (session.user.role !== 'creator' && session.user.role !== 'admin') redirect('/forbidden')

  return (
    <DashboardShell nav="studio" session={session}>
      {children}
    </DashboardShell>
  )
}
