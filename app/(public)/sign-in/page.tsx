import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SignInForm } from './sign-in-form'

export const metadata = { title: t('auth.signIn') }

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { callbackUrl } = await searchParams

  const session = await auth()
  if (session?.user) redirect(callbackUrl ?? '/')

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display text-2xl">{t('auth.signInTitle')}</CardTitle>
          <CardDescription>{t('brand.promise')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SignInForm callbackUrl={callbackUrl} />
          <p className="text-center text-sm text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <Link href="/sign-up" className="font-medium text-gold hover:underline">
              {t('auth.signUp')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
