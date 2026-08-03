import Link from 'next/link'
import type { Session } from 'next-auth'
import { ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LocaleSwitch } from '@/components/layout/locale-switch'
import { SearchEntry } from '@/components/layout/search-entry'
import { UserMenu } from '@/components/layout/user-menu'
import { MobileNav } from '@/components/layout/mobile-nav'
import { PRIMARY_NAV, ACCOUNT_NAV, roleNav } from '@/components/layout/nav'
import { getTranslator, type Locale } from '@/lib/i18n'

/**
 * Site header.
 *
 * Server component: it reads the session once and hands plain strings to the
 * three client islands below it (search, locale switch, account menu), so the
 * message dictionaries never cross into the client bundle.
 *
 * The cart badge count is intentionally absent — Brief 04 owns the cart and
 * will replace this button with a live one. Everything else here is stable.
 */
export function SiteHeader({ locale, session }: { locale: Locale; session: Session | null }) {
  const t = getTranslator(locale)
  const extra = roleNav(session?.user?.role)

  const labels: Record<string, string> = {
    signIn: t('auth.signIn'),
    signOut: t('auth.signOut'),
    account: t('nav.account'),
    'nav.menu': t('nav.menu'),
    ...Object.fromEntries(
      [...PRIMARY_NAV, ...ACCOUNT_NAV, ...extra].map((item) => [item.labelKey, t(item.labelKey)]),
    ),
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center gap-3">
        <MobileNav locale={locale} labels={labels} extra={extra} />

        <Link
          href={`/${locale}`}
          className="shrink-0 text-2xl font-bold tracking-tight text-gold"
          aria-label={t('brand.name')}
        >
          {t('brand.name')}
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label={t('nav.menu')}>
          {PRIMARY_NAV.map((item) => (
            <Button key={item.href} asChild variant="ghost" size="sm">
              <Link href={`/${locale}${item.href}`}>{t(item.labelKey)}</Link>
            </Button>
          ))}
        </nav>

        <div className="mx-auto hidden w-full max-w-md md:block">
          <SearchEntry
            locale={locale}
            placeholder={t('search.placeholder')}
            label={t('search.submit')}
          />
        </div>

        <div className="ms-auto flex items-center gap-1">
          {extra.map((item) => (
            <Button key={item.href} asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
              <Link href={`/${locale}${item.href}`}>{t(item.labelKey)}</Link>
            </Button>
          ))}

          <Button asChild variant="ghost" size="icon" aria-label={t('commerce.cart')}>
            <Link href={`/${locale}/cart`}>
              <ShoppingBag />
            </Link>
          </Button>

          <LocaleSwitch locale={locale} />
          <UserMenu locale={locale} session={session} labels={labels} />
        </div>
      </div>

      <div className="container pb-3 md:hidden">
        <SearchEntry
          locale={locale}
          placeholder={t('search.placeholder')}
          label={t('search.submit')}
        />
      </div>
    </header>
  )
}
