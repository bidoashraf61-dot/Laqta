'use client'

import { Link } from '@/components/ui/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/toggles'
import { LocaleToggle } from '@/components/layout/locale-toggle'
import { PRIMARY_NAV, type NavItem } from '@/components/layout/nav'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n-client'

/**
 * Mobile drawer.
 *
 * Opens from `side="start"` — the right edge in Arabic — so it slides out from
 * under the thumb that opened it, matching every native app on the device.
 */
export function MobileNav({ extra }: { extra: NavItem[] }) {
  const t = useT()

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
          {/* On phones the header has no room for the language control, and a
              reader who lands on the wrong one needs a way out from wherever the
              navigation lives. */}
          <div className="mt-4 border-t pt-4">
            <LocaleToggle className="w-full justify-start px-3" />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
