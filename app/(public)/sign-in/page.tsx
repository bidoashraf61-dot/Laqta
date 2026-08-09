import { Link } from '@/components/ui/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SignInForm } from './sign-in-form'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('auth.signIn'),
  }
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
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
