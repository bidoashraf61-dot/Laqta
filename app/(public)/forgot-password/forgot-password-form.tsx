'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Link } from '@/components/ui/link'
import { Alert, AlertDescription } from '@/components/ui/state'
import { useLocale, useT } from '@/lib/i18n-client'
import { BCP47 } from '@/lib/locale'
import { requestReset } from './actions'

/**
 * One field, then one answer. The answer is identical whether or not the
 * address has an account — the page must not be a way to find out.
 */
export function ForgotPasswordForm({ minutes }: { minutes: number }) {
  const t = useT()
  const locale = useLocale()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ email: string; devLink: string | null } | null>(null)

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await requestReset(formData)
      if (result.status === 'sent') {
        setSent({ email: result.email, devLink: result.devLink })
        return
      }
      setError(t(result.messageKey))
    })
  }

  const backLink = (
    <p className="text-center text-sm">
      <Link href="/sign-in" className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        {t('auth.backToSignIn')}
      </Link>
    </p>
  )

  if (sent) {
    return (
      <div className="space-y-5">
        <div role="status" className="space-y-2">
          <h2 className="text-lg font-semibold">{t('auth.forgotSentTitle')}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t('auth.forgotSent', {
              // First-strong isolate: a Latin address inside an Arabic
              // sentence would otherwise drag the punctuation around it.
              email: `⁨${sent.email}⁩`,
              minutes: new Intl.NumberFormat(BCP47[locale]).format(minutes),
            })}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">{t('auth.forgotSentHint')}</p>
        </div>

        {/* No mail provider in development: the link is shown here instead of
            being left in the server console. Never in production. */}
        {sent.devLink ? (
          <Alert variant="warning">
            <AlertDescription className="space-y-2">
              <span className="block">{t('auth.devLinkNotice')}</span>
              <a href={sent.devLink} className="font-medium text-foreground underline underline-offset-4">
                {t('auth.devLinkOpen')}
              </a>
            </AlertDescription>
          </Alert>
        ) : null}

        <Button type="button" variant="outline" className="w-full" onClick={() => setSent(null)}>
          {t('auth.forgotAgain')}
        </Button>
        {backLink}
      </div>
    )
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <Field label={t('auth.email')} htmlFor="email" required>
        {/* Latin content on an Arabic page — forced LTR so the caret behaves. */}
        <Input id="email" name="email" type="email" dir="ltr" autoComplete="email" required autoFocus />
      </Field>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" variant="gold" className="w-full" disabled={pending}>
        {pending ? t('state.loading') : t('auth.forgotSubmit')}
      </Button>

      <p className="text-sm leading-relaxed text-muted-foreground">{t('auth.forgotPhoneHint')}</p>
      {backLink}
    </form>
  )
}
