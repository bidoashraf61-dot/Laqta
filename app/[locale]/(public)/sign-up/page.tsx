import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTranslator, isLocale, defaultLocale, type Locale } from '@/lib/i18n'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SignUpForm } from './sign-up-form'

export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : defaultLocale

  const session = await auth()
  if (session?.user) redirect(`/${locale}`)

  const t = getTranslator(locale)

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.signUpTitle')}</CardTitle>
          <CardDescription>{t('brand.promise')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SignUpForm
            locale={locale}
            labels={{
              name: t('auth.name'),
              email: t('auth.email'),
              password: t('auth.password'),
              passwordMin: t('auth.passwordMin'),
              signUp: t('auth.signUp'),
              loading: t('state.loading'),
              'auth.invalidCredentials': t('auth.invalidCredentials'),
              'auth.accountExists': t('auth.accountExists'),
              'auth.somethingWentWrong': t('auth.somethingWentWrong'),
            }}
          />
          <p className="text-center text-sm text-muted-foreground">
            {t('auth.haveAccount')}{' '}
            <Link href={`/${locale}/sign-in`} className="font-medium text-gold hover:underline">
              {t('auth.signIn')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
