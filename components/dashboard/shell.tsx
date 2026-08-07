import type { ReactNode } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import type { Session } from 'next-auth'
import type { DashboardNav } from './nav'
import { DashboardSidebar } from './sidebar'
import { MobileSidebar } from './mobile-sidebar'
import { UserMenu } from '@/components/layout/user-menu'
import { t } from '@/lib/i18n'

/**
 * The dashboard shell — sidebar + top bar + content, shared by studio and admin.
 *
 * A real control-panel frame rather than the bare centred container the
 * portals used to sit in. The sidebar is fixed chrome; the top bar carries the
 * page title, a route back to the public site, and the account menu; the
 * content scrolls independently. Operate mode throughout: familiar structure,
 * restrained colour, nothing decorative.
 */
export function DashboardShell({
  nav,
  session,
  children,
}: {
  /**
   * The nav's NAME, not its sections. Each link carries a lucide component,
   * and a component cannot be serialized across the server→client boundary —
   * passing the array from this server component crashed both dashboards into
   * their error boundary while still returning HTTP 200.
   */
  nav: DashboardNav
  session: Session | null
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh bg-background">
      <DashboardSidebar nav={nav} brand={t('brand.name')} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="dark sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/10 bg-chrome px-4 text-foreground backdrop-blur supports-[backdrop-filter]:bg-chrome/95">
          <MobileSidebar nav={nav} />

          {/* Slot the page can fill via the DashboardHeader below sits in the
              content, so the top bar stays thin: identity, exit, account. */}
          <div className="ms-auto flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ExternalLink className="size-4" data-flip-rtl />
              <span className="hidden sm:inline">{t('dash.viewSite')}</span>
            </Link>
            <UserMenu session={session} />
          </div>
        </header>

        <main className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
