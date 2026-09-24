import { t } from '@/lib/i18n'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ResetPasswordForm } from './reset-password-form'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'
import { BCP47, localePath } from '@/lib/locale'
import { isResetTokenLive, PASSWORD_MIN, RESET_TTL_MINUTES } from '@/lib/password-reset'

export async function generateMetadata(): Promise<Metadata> {
  await requestLocale()
  return {
    title: t('auth.resetTitle'),
    robots: { index: false, follow: false },
    // The token is in this page's URL. No outbound request may carry it in a
    // Referer header.
    referrer: 'no-referrer',
  }
}

/**
 * The page the reset email links to. The token is checked read-only on render
 * — a dead link gets the "ask for a new one" card, not a form that fails on
 * submit — and redeemed only by the action.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const locale = await requestLocale()
  const { token = '' } = await searchParams
  const live = await isResetTokenLive(token)
  const minutes = new Intl.NumberFormat(BCP47[locale]).format(RESET_TTL_MINUTES)

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle as="h1" className="font-display text-2xl">
            {t(live ? 'auth.resetTitle' : 'auth.resetInvalidTitle')}
          </CardTitle>
          <CardDescription>{live ? t('auth.resetIntro') : t('auth.resetInvalid', { minutes })}</CardDescription>
        </CardHeader>
        <CardContent>
          {live ? (
            <ResetPasswordForm token={token} minLength={PASSWORD_MIN} />
          ) : (
            <Button asChild variant="gold" className="w-full">
              {/* Plain anchor: the way out of a dead end must always commit. */}
              <a href={localePath(locale, '/forgot-password')}>{t('auth.resetRequestNew')}</a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
