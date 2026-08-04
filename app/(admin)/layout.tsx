import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

/** `/admin/*` — admin only. Brief 06 builds inside this shell. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in?callbackUrl=/admin')
  if (session.user.role !== 'admin') redirect('/forbidden')

  return <div className="container py-10">{children}</div>
}
