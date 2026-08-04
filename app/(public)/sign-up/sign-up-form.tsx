'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/state'
import { t } from '@/lib/i18n'
import { signUpWithEmail } from '../sign-in/actions'

export function SignUpForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await signUpWithEmail(formData)
      if (result.status === 'ok') {
        router.push(result.redirectTo)
        router.refresh()
        return
      }
      if (result.status === 'error') setError(t(result.messageKey))
    })
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <Field label={t('auth.name')} htmlFor="name" required>
        <Input id="name" name="name" autoComplete="name" required minLength={2} />
      </Field>

      <Field label={t('auth.email')} htmlFor="email" required>
        <Input id="email" name="email" type="email" dir="ltr" autoComplete="email" required />
      </Field>

      <Field label={t('auth.password')} htmlFor="password" hint={t('auth.passwordMin')} required>
        <Input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" variant="gold" className="w-full" disabled={pending}>
        {pending ? t('state.loading') : t('auth.signUp')}
      </Button>
    </form>
  )
}
