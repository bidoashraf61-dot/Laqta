'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { navSections, type DashboardNav } from './nav'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Dashboard sidebar.
 *
 * The second neutral layer Operate mode calls for — card tone against the ink
 * content area, so the rail reads as chrome and the work reads as content. It
 * sits at the inline-start edge, which is the RIGHT in this RTL app; the
 * collapse toggle and the slide are all authored with logical properties so
 * nothing is hand-mirrored.
 *
 * Active state is the one place gold does work here (One Voice Rule): the
 * current section takes a gold text + faint gold fill; everything else is
 * muted until hovered. Collapsed, it shows icons only with the label as a
 * native tooltip.
 */
export function DashboardSidebar({
  nav,
  brand,
}: {
  nav: DashboardNav
  brand: string
}) {
  const sections = navSections(nav)
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        // Dark chrome, matching the site header: the rail frames the paper
        // work surface instead of blending into it, and `.dark` flips the
        // tokens so nav labels, icons and the active state all resolve against
        // the near-black without a single hand-picked colour.
        'dark sticky top-0 hidden h-dvh shrink-0 flex-col border-e border-white/10 bg-chrome text-foreground transition-[width] duration-200 lg:flex',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b border-border/60 px-4">
        <Link href="/" className="truncate font-display text-xl font-bold text-gold">
          {collapsed ? brand.charAt(0) : brand}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={t(collapsed ? 'dash.expand' : 'dash.collapse')}
          className="ms-auto grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {collapsed ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}
        </button>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto py-4">
        {sections.map((section) => (
          <div key={section.titleKey} className="mb-4 px-3">
            {collapsed ? (
              <div className="mx-2 mb-2 border-t border-border/40" />
            ) : (
              <p className="mb-1.5 px-2 text-2xs font-medium uppercase tracking-wider text-muted-foreground/70">
                {t(section.titleKey)}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.links.map((link) => {
                const active = isActive(link.href, link.exact)
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      title={collapsed ? t(link.labelKey) : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors',
                        collapsed && 'justify-center',
                        active
                          ? 'bg-gold/12 font-medium text-gold'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <link.icon className="size-4 shrink-0" />
                      {collapsed ? null : <span className="truncate">{t(link.labelKey)}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
