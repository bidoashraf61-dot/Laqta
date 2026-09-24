'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/state'
import { useLocale, useT } from '@/lib/i18n-client'
import { localePath } from '@/lib/locale'
import { completeReset } from '../forgot-password/actions'

/**
 * New password + confirm. On success the form gives way to a single way
 * forward — sign in — because every session the account had is now over.
 */
export function ResetPasswordForm({ token, minLength }: { token: string; minLength: number }) {
  const t = useT()
  const locale = useLocale()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function onSubmit(formData: FormData) {
    setError(null)
    // The same checks the action makes, answered without a round trip.
    const password = String(formData.get('password') ?? '')
    if (password.length < minLength) return setError(t('auth.passwordTooShort'))
    if (password !== String(formData.get('confirm') ?? '')) return setError(t('auth.passwordMismatch'))

    startTransition(async () => {
      const result = await completeReset(formData)
      if (result.status === 'ok') {
        setDone(true)
        return
      }
      setError(t(result.messageKey))
    })
  }

  if (done) {
    return (
      <div className="space-y-5">
        <div role="status" className="space-y-2">
          <h2 className="text-lg font-semibold">{t('auth.resetDoneTitle')}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t('auth.resetDone')}</p>
        </div>
        <Button asChild variant="gold" className="w-full">
          {/* Plain anchor, full load: the old session cookie is dead and the
              header must re-render signed out. */}
          <a href={localePath(locale, '/sign-in')}>{t('auth.signIn')}</a>
        </Button>
      </div>
    )
  }

  return (
    <form action={onSubmit} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />

      <Field label={t('auth.newPassword')} htmlFor="password" hint={t('auth.passwordMin')} required>
        <Input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          minLength={minLength}
          required
          autoFocus
        />
      </Field>

      <Field label={t('auth.confirmPassword')} htmlFor="confirm" required>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          minLength={minLength}
          required
        />
      </Field>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" variant="gold" className="w-full" disabled={pending}>
        {pending ? t('state.loading') : t('auth.resetSubmit')}
      </Button>
    </form>
  )
}
