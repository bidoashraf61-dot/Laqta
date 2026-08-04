import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

/**
 * `/account/*` — any authenticated user.
 *
 * middleware.ts already blocks this path, so reaching the redirect below means
 * the matcher has a hole. Keeping the check is the point: middleware is the
 * gate, the layout is the lock, and a route that ships without a matcher entry
 * still cannot leak a stranger's library.
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in?callbackUrl=/account')

  return <div className="container py-10">{children}</div>
}
