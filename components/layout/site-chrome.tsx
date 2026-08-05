import type { ReactNode } from 'react'
import type { Session } from 'next-auth'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'

/**
 * The public chrome: sticky header, main landmark, footer.
 *
 * Lives here rather than in the root layout because the dashboards do NOT
 * want it — they carry a sidebar and their own top bar, and stacking the site
 * header on top produced two brands and two account menus on every studio and
 * admin screen.
 */
export function SiteChrome({
  session,
  children,
}: {
  session: Session | null
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader session={session} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
