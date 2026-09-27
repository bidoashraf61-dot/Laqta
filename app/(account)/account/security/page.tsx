import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { safeDashboardReturn, twoFactorRequired } from '@/lib/two-factor'
import { t } from '@/lib/i18n'
import { TwoFactorCard } from './two-factor-card'
import { PageTitle } from '@/components/ui/typography'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('security.title'),
  }
}

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const sessionUser = await requireUser()
  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { twoFactorEnabled: true, twoFactorSecret: true, role: true },
  })
  const enabled = Boolean(user?.twoFactorEnabled && user.twoFactorSecret)
  const mandatory = twoFactorRequired(user?.role ?? 'buyer')

  // Where the 2FA hold came from (middleware / the dashboard layouts). Only a
  // dashboard path is honoured — see safeDashboardReturn.
  const raw = (await searchParams).next
  const next = mandatory ? safeDashboardReturn(Array.isArray(raw) ? raw[0] : raw) : null

  return (
    <div className="max-w-2xl space-y-6">
      <PageTitle>{t('security.title')}</PageTitle>
      <TwoFactorCard enabled={enabled} mandatory={mandatory} next={next} />
    </div>
  )
}
