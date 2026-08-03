'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/state'
import { signUpWithEmail } from '../sign-in/actions'
import type { Locale } from '@/lib/i18n'

export function SignUpForm({
  locale,
  labels,
}: {
  locale: Locale
  labels: Record<string, string>
}) {
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
      if (result.status === 'error') setError(labels[result.messageKey] ?? result.messageKey)
    })
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      <Field label={labels.name} htmlFor="name" required>
        <Input id="name" name="name" autoComplete="name" required minLength={2} />
      </Field>

      <Field label={labels.email} htmlFor="email" required>
        <Input id="email" name="email" type="email" dir="ltr" autoComplete="email" required />
      </Field>

      <Field label={labels.password} htmlFor="password" hint={labels.passwordMin} required>
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
        {pending ? labels.loading : labels.signUp}
      </Button>
    </form>
  )
}
