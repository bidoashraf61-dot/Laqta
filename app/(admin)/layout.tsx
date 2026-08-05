import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { DashboardShell } from '@/components/dashboard/shell'

/** `/admin/*` — admin only. Same double-guard as the studio shell. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in?callbackUrl=/admin')
  if (session.user.role !== 'admin') redirect('/forbidden')

  return (
    <DashboardShell nav="admin" session={session}>
      {children}
    </DashboardShell>
  )
}
