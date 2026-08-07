import Link from 'next/link'
import type { Session } from 'next-auth'
import { ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchEntry } from '@/components/layout/search-entry'
import { UserMenu } from '@/components/layout/user-menu'
import { MobileNav } from '@/components/layout/mobile-nav'
import { PRIMARY_NAV, roleNav } from '@/components/layout/nav'
import { t } from '@/lib/i18n'

/**
 * Site header.
 *
 * The cart badge count is intentionally absent — Brief 04 owns the cart and
 * replaces this button with a live one. Everything else here is stable.
 */
export function SiteHeader({ session }: { session: Session | null }) {
  const extra = roleNav(session?.user?.role)

  // Dark chrome. The reference carries a near-black as its 15% secondary, and
  // giving it to the header does two things: it frames the paper content the
  // way a gallery wall frames a print, and it stops the sticky bar dissolving
  // into the page as you scroll. `.dark` scopes the token flip so every control
  // inside inherits the right foreground automatically.
  return (
    <header className="on-olive sticky top-0 z-40 border-b border-border bg-background text-foreground shadow-lift backdrop-blur supports-[backdrop-filter]:bg-background/95">
      <div className="container flex h-16 items-center gap-3">
        <MobileNav extra={extra} />

        <Link
          href="/"
          className="shrink-0 font-display text-2xl font-bold tracking-tight text-gold"
          aria-label={t('brand.name')}
        >
          {t('brand.name')}
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label={t('nav.menu')}>
          {PRIMARY_NAV.map((item) => (
            <Button key={item.href} asChild variant="ghost" size="sm">
              <Link href={item.href}>{t(item.labelKey)}</Link>
            </Button>
          ))}
        </nav>

        <div className="mx-auto hidden w-full max-w-md md:block">
          <SearchEntry />
        </div>

        <div className="ms-auto flex items-center gap-1">
          {extra.map((item) => (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              size="sm"
              className="hidden lg:inline-flex"
            >
              <Link href={item.href}>{t(item.labelKey)}</Link>
            </Button>
          ))}

          <Button asChild variant="ghost" size="icon" aria-label={t('commerce.cart')}>
            <Link href="/cart">
              <ShoppingBag />
            </Link>
          </Button>

          <UserMenu session={session} />
        </div>
      </div>

      <div className="container pb-3 md:hidden">
        <SearchEntry />
      </div>
    </header>
  )
}
