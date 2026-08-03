import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getTranslator, isLocale, defaultLocale, type Locale } from '@/lib/i18n'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ACCOUNT_NAV } from '@/components/layout/nav'

/** Account hub placeholder — Brief 04 owns everything under `/account`. */
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : defaultLocale
  const t = getTranslator(locale)
  const session = await auth()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-headline font-semibold">{t('nav.account')}</h1>
        <Badge variant="neutral" className="ltr-island">
          {session?.user?.role}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACCOUNT_NAV.filter((item) => item.href !== '/account').map((item) => (
          <Card key={item.href}>
            <CardHeader>
              <CardTitle>{t(item.labelKey)}</CardTitle>
              <CardDescription>{t('state.scaffold')}</CardDescription>
            </CardHeader>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>{t('security.title')}</CardTitle>
            <CardDescription>{t('security.twoFactorWhy')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href={`/${locale}/account/security`}>{t('security.twoFactor')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
