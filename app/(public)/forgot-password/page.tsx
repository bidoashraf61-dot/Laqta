import { t } from '@/lib/i18n'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ForgotPasswordForm } from './forgot-password-form'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'
import { RESET_TTL_MINUTES } from '@/lib/password-reset'

export async function generateMetadata(): Promise<Metadata> {
  await requestLocale()
  return {
    title: t('auth.forgotTitle'),
    robots: { index: false },
  }
}

/**
 * «نسيت كلمة المرور؟» — same card as /sign-in, one field. Open to anyone,
 * signed in or not: asking for a link proves nothing and changes nothing.
 */
export default async function ForgotPasswordPage() {
  // Every segment resolves its own locale — see CLAUDE.md.
  await requestLocale()

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle as="h1" className="font-display text-2xl">
            {t('auth.forgotTitle')}
          </CardTitle>
          <CardDescription>{t('auth.forgotIntro')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm minutes={RESET_TTL_MINUTES} />
        </CardContent>
      </Card>
    </div>
  )
}
