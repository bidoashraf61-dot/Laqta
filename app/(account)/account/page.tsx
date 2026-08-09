import Link from 'next/link'
import { auth } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ACCOUNT_NAV } from '@/components/layout/nav'
import { PageTitle } from '@/components/ui/typography'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('nav.account'),
  }
}

/** Account hub. Brief 04 fills in library, boards and orders. */
export default async function AccountPage() {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const session = await auth()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <PageTitle>{t('nav.account')}</PageTitle>
        <Badge variant="neutral">{t(`role.${session?.user?.role ?? 'buyer'}`)}</Badge>
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
              <Link href="/account/security">{t('security.twoFactor')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
