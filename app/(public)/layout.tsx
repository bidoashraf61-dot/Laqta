import type { ReactNode } from 'react'
import { auth } from '@/lib/auth'
import { SiteChrome } from '@/components/layout/site-chrome'

/** Everything a signed-out visitor can reach: marketing, catalogue, policy. */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  return <SiteChrome session={session}>{children}</SiteChrome>
}
