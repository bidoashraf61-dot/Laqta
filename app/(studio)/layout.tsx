import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { DashboardShell } from '@/components/dashboard/shell'

/**
 * `/studio/*` — creator or admin.
 *
 * The guard is repeated here even though middleware.ts already runs it: the
 * layout is the last place a role can be checked before any page below it
 * fetches data, so duplicating the check is cheap insurance.
 */
export default async function StudioLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in?callbackUrl=/studio')
  if (session.user.role !== 'creator' && session.user.role !== 'admin') redirect('/forbidden')

  return (
    <DashboardShell nav="studio" session={session}>
      {children}
    </DashboardShell>
  )
}
