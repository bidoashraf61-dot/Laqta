'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/state'
import { signInWithEmail, requestPhoneCode, signInWithPhone } from './actions'
import type { Locale } from '@/lib/i18n'

type Labels = Record<string, string>

/**
 * Sign-in.
 *
 * Two rails, both first-class. Phone-OTP is not a fallback — a large share of
 * buyers in KSA and Egypt have no email habit at all, and a form that hides
 * the phone option behind "other methods" loses them.
 */
export function SignInForm({
  locale,
  callbackUrl,
  labels,
}: {
  locale: Locale
  callbackUrl?: string
  labels: Labels
}) {
  return (
    <Tabs defaultValue="email" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="email">{labels.withEmail}</TabsTrigger>
        <TabsTrigger value="phone">{labels.withPhone}</TabsTrigger>
      </TabsList>

      <TabsContent value="email">
        <EmailForm locale={locale} callbackUrl={callbackUrl} labels={labels} />
      </TabsContent>
      <TabsContent value="phone">
        <PhoneForm locale={locale} callbackUrl={callbackUrl} labels={labels} />
      </TabsContent>
    </Tabs>
  )
}

function EmailForm({
  locale,
  callbackUrl,
  labels,
}: {
  locale: Locale
  callbackUrl?: string
  labels: Labels
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [needsTotp, setNeedsTotp] = useState(false)

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await signInWithEmail(formData)
      if (result.status === 'ok') {
        router.push(result.redirectTo)
        router.refresh()
        return
      }
      if (result.status === 'two_factor') {
        setNeedsTotp(true)
        return
      }
      if (result.status === 'error') setError(labels[result.messageKey] ?? result.messageKey)
    })
  }

  return (
    <form action={onSubmit} className="space-y-4 pt-2">
      <input type="hidden" name="locale" value={locale} />
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}

      <Field label={labels.email} htmlFor="email" required>
        {/* Latin content on an Arabic page — forced LTR so the caret behaves. */}
        <Input id="email" name="email" type="email" dir="ltr" autoComplete="email" required />
      </Field>

      <Field label={labels.password} htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          required
        />
      </Field>

      {needsTotp ? (
        <Field label={labels.twoFactor} htmlFor="totp" hint={labels.twoFactorPrompt} required>
          <Input
            id="totp"
            name="totp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            dir="ltr"
            className="numeric tracking-[0.4em]"
            autoFocus
            required
          />
        </Field>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" variant="gold" className="w-full" disabled={pending}>
        {pending ? labels.loading : labels.signIn}
      </Button>
    </form>
  )
}

function PhoneForm({
  locale,
  callbackUrl,
  labels,
}: {
  locale: Locale
  callbackUrl?: string
  labels: Labels
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)

  function sendCode(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await requestPhoneCode(formData)
      if (result.status === 'code_sent') {
        setSentTo(result.phone)
        setDevCode(result.devCode)
        return
      }
      if (result.status === 'error') setError(labels[result.messageKey] ?? result.messageKey)
    })
  }

  function verify(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await signInWithPhone(formData)
      if (result.status === 'ok') {
        router.push(result.redirectTo)
        router.refresh()
        return
      }
      if (result.status === 'error') setError(labels[result.messageKey] ?? result.messageKey)
    })
  }

  if (!sentTo) {
    return (
      <form action={sendCode} className="space-y-4 pt-2">
        <Field label={labels.phone} htmlFor="phone" hint={labels.phoneHint} required>
          <Input
            id="phone"
            name="phone"
            type="tel"
            dir="ltr"
            autoComplete="tel"
            className="numeric"
            required
          />
        </Field>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" variant="gold" className="w-full" disabled={pending}>
          {pending ? labels.loading : labels.sendCode}
        </Button>
      </form>
    )
  }

  return (
    <form action={verify} className="space-y-4 pt-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="phone" value={sentTo} />
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}

      <p className="text-sm text-muted-foreground">
        {labels.codeSent.replace('{phone}', sentTo)}
      </p>

      {/* No SMS provider is wired in development, so the code is surfaced here
          rather than silently logged where nobody will look for it. */}
      {devCode ? (
        <Alert variant="warning">
          <AlertDescription className="numeric">
            {labels.devCodeNotice.replace('{code}', devCode)}
          </AlertDescription>
        </Alert>
      ) : null}

      <Field label={labels.codeLabel} htmlFor="code" required>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          dir="ltr"
          className="numeric tracking-[0.4em]"
          autoFocus
          required
        />
      </Field>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" variant="gold" className="w-full" disabled={pending}>
        {pending ? labels.loading : labels.verify}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => {
          setSentTo(null)
          setDevCode(null)
        }}
      >
        {labels.changeNumber}
      </Button>
    </form>
  )
}
