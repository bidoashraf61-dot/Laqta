import type { Metadata } from 'next'
import { t } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'
import { PageTitle } from '@/components/ui/typography'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/state'
import { unsubscribe } from './actions'

export async function generateMetadata(): Promise<Metadata> {
  await requestLocale()
  return { title: t('waitlist.title'), robots: { index: false, follow: false } }
}

/**
 * Leave the launch waitlist (DEV-45). The link in every waitlist email lands
 * here; the page asks, and a POST does it — so a mail scanner opening the link
 * does not unsubscribe anyone.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string; invalid?: string }>
}) {
  await requestLocale()
  const { token, done, invalid } = await searchParams

  return (
    <div className="container max-w-lg space-y-6 py-20">
      <PageTitle>{t('waitlist.title')}</PageTitle>
      {done ? (
        <Alert variant="success">
          <AlertDescription>{t('waitlist.done')}</AlertDescription>
        </Alert>
      ) : invalid || !token ? (
        <Alert variant="destructive">
          <AlertDescription>{t('waitlist.invalid')}</AlertDescription>
        </Alert>
      ) : (
        <form action={unsubscribe} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <p className="text-muted-foreground">{t('waitlist.confirm')}</p>
          <Button type="submit">{t('waitlist.cta')}</Button>
        </form>
      )}
    </div>
  )
}
