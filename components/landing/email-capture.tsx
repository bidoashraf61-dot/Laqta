'use client'

import { useState, useTransition } from 'react'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/state'
import { captureEmail } from '@/app/(public)/actions'
import { PageTitle } from '@/components/ui/typography'
import { useT } from '@/lib/i18n-client'
import { Link } from '@/components/ui/link'

/**
 * Launch-notification capture — the waiting list (DEV-45, `lib/waitlist.ts`).
 *
 * `source` records where the form was. The consent line under the form is
 * what the person agrees to by sending it; its version is stored with them.
 * Shown on the landing page only while `SITE_MODE=prelaunch`.
 */
export function EmailCapture({ source = 'landing' }: { source?: string }) {
  const t = useT()

  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await captureEmail(formData)
      if (result.ok) {
        setDone(true)
        return
      }
      setError(t(result.messageKey))
    })
  }

  return (
    <section className="border-y border-border bg-ground-quiet">
      <div className="container max-w-xl py-16 text-center">
        <PageTitle as="h2">{t('landing.notifyTitle')}</PageTitle>
        <p className="mt-2 text-muted-foreground">{t('landing.notifyBody')}</p>

        {done ? (
          <Alert variant="success" className="mt-6 flex items-center justify-center gap-2">
            <MailCheck className="size-4 text-success" />
            <AlertDescription>{t('landing.notifyThanks')}</AlertDescription>
          </Alert>
        ) : (
          <form action={onSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="source" value={source} />
            <Input
              name="email"
              type="email"
              required
              dir="ltr"
              placeholder={t('landing.notifyPlaceholder')}
              aria-label={t('landing.notifyPlaceholder')}
            />
            <Button type="submit" variant="gold" disabled={pending} className="shrink-0">
              {pending ? t('state.loading') : t('landing.notifyCta')}
            </Button>
          </form>
        )}
        {!done ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {t('landing.waitlistConsent')}{' '}
            <Link href="/privacy" className="underline underline-offset-4">
              {t('landing.waitlistPrivacy')}
            </Link>
          </p>
        ) : null}

        {error ? (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </section>
  )
}
