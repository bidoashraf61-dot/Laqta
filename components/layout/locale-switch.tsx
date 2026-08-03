'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Globe } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { localeLabel, locales, localisePath, type Locale } from '@/lib/i18n'

/**
 * Language switch.
 *
 * Swaps only the locale segment, so the user stays exactly where they were —
 * `/ar/albums/alula-golden-hour` becomes `/en/albums/alula-golden-hour`, query
 * string included. Bouncing people to the homepage on a language change is the
 * fastest way to teach them never to use the switch again.
 */
export function LocaleSwitch({ locale }: { locale: Locale }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function switchTo(next: Locale) {
    const query = searchParams.toString()
    router.push(`${localisePath(pathname, next)}${query ? `?${query}` : ''}`)
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" aria-label={localeLabel[locale]}>
          <Globe />
          <span className="hidden sm:inline">{localeLabel[locale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((option) => (
          <DropdownMenuItem
            key={option}
            onSelect={() => switchTo(option)}
            aria-current={option === locale}
            className={option === locale ? 'font-semibold text-gold' : undefined}
          >
            {localeLabel[option]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
