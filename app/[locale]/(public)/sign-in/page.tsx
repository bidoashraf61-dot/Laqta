import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTranslator, isLocale, defaultLocale, type Locale } from '@/lib/i18n'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SignInForm } from './sign-in-form'

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : defaultLocale
  const { callbackUrl } = await searchParams

  // Already signed in — nothing to do here.
  const session = await auth()
  if (session?.user) redirect(callbackUrl ?? `/${locale}`)

  const t = getTranslator(locale)
  const labels = {
    signIn: t('auth.signIn'),
    withEmail: t('auth.withEmail'),
    withPhone: t('auth.withPhone'),
    email: t('auth.email'),
    password: t('auth.password'),
    phone: t('auth.phone'),
    phoneHint: t('auth.phoneHint'),
    sendCode: t('auth.sendCode'),
    codeLabel: t('auth.codeLabel'),
    codeSent: t('auth.codeSent'),
    verify: t('auth.verify'),
    changeNumber: t('auth.changeNumber'),
    devCodeNotice: t('auth.devCodeNotice'),
    twoFactor: t('auth.twoFactor'),
    twoFactorPrompt: t('auth.twoFactorPrompt'),
    loading: t('state.loading'),
    'auth.invalidCredentials': t('auth.invalidCredentials'),
    'auth.invalidCode': t('auth.invalidCode'),
    'auth.accountExists': t('auth.accountExists'),
    'auth.somethingWentWrong': t('auth.somethingWentWrong'),
  }

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.signInTitle')}</CardTitle>
          <CardDescription>{t('brand.promise')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SignInForm locale={locale} callbackUrl={callbackUrl} labels={labels} />
          <p className="text-center text-sm text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <Link href={`/${locale}/sign-up`} className="font-medium text-gold hover:underline">
              {t('auth.signUp')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
