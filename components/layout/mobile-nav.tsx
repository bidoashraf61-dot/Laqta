'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/toggles'
import { PRIMARY_NAV, type NavItem } from '@/components/layout/nav'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'

/**
 * Mobile drawer.
 *
 * Opens from `side="start"` — the right edge in Arabic — so it slides out from
 * under the thumb that opened it, matching every native app on the device.
 */
export function MobileNav({ extra }: { extra: NavItem[] }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const link = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'rounded-md px-3 py-2 text-base transition-colors hover:bg-accent',
          active && 'bg-accent font-bold text-gold',
        )}
      >
        {t(item.labelKey)}
      </Link>
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('nav.menu')}>
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="start" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>{t('nav.menu')}</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4 pb-6">
          {PRIMARY_NAV.map(link)}
          <Separator className="my-3" />
          {extra.map(link)}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
