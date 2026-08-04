import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

/** `/studio/*` — creator or admin. Brief 03 builds inside this shell. */
export default async function StudioLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in?callbackUrl=/studio')
  if (session.user.role !== 'creator' && session.user.role !== 'admin') redirect('/forbidden')

  return <div className="container py-10">{children}</div>
}
