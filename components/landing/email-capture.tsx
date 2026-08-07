'use client'

import { useState, useTransition } from 'react'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/state'
import { t } from '@/lib/i18n'
import { captureEmail } from '@/app/(public)/actions'
import { PageTitle } from '@/components/ui/typography'

/**
 * Launch-notification capture.
 *
 * Stored as a CmsEntry of kind `landing_copy` rather than a new table — the
 * schema belongs to Foundation and a waiting list does not justify a migration
 * request. If this list ever needs segmentation or double opt-in it earns its
 * own model then.
 */
export function EmailCapture() {
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
    <section className="bg-off-white border-y border-olive/12">
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

        {error ? (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </section>
  )
}
