'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu } from 'lucide-react'
import type { DashboardSection } from './nav'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Mobile dashboard nav — the same sections in a drawer.
 *
 * Opens from the inline-start edge (right in RTL). Closing on navigation is
 * the expected behaviour for a control panel on a phone; a drawer that stays
 * open after a tap feels broken.
 */
export function MobileSidebar({ sections }: { sections: DashboardSection[] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('nav.menu')}>
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="start" className="w-72 p-0">
        <SheetHeader>
          <SheetTitle className="font-display text-gold">{t('brand.name')}</SheetTitle>
        </SheetHeader>
        <nav className="scrollbar-thin h-[calc(100dvh-5rem)] overflow-y-auto px-3 pb-6">
          {sections.map((section) => (
            <div key={section.titleKey} className="mb-4">
              <p className="mb-1.5 px-2 text-2xs font-medium uppercase tracking-wider text-muted-foreground/70">
                {t(section.titleKey)}
              </p>
              <ul className="space-y-0.5">
                {section.links.map((link) => {
                  const active = isActive(link.href, link.exact)
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors',
                          active
                            ? 'bg-gold/12 font-medium text-gold'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                      >
                        <link.icon className="size-4 shrink-0" />
                        <span className="truncate">{t(link.labelKey)}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
