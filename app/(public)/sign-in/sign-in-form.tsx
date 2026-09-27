'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Link } from '@/components/ui/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/state'
import { signInWithEmail, requestPhoneCode, signInWithPhone } from './actions'
import { useT } from '@/lib/i18n-client'

/**
 * Sign-in.
 *
 * Two rails, both first-class once SMS is wired. Phone-OTP is not a fallback —
 * a large share of buyers in KSA and Egypt have no email habit, and a form that
 * hides the phone option behind "other methods" loses them. Until a provider
 * delivers the code (`phoneEnabled` false) the phone tab is not rendered at
 * all: a tab that can only fail is worse than no tab.
 */
export function SignInForm({
  callbackUrl,
  phoneEnabled,
}: {
  callbackUrl?: string
  phoneEnabled: boolean
}) {
  const t = useT()

  if (!phoneEnabled) return <EmailForm callbackUrl={callbackUrl} />

  return (
    <Tabs defaultValue="email" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="email">{t('auth.withEmail')}</TabsTrigger>
        <TabsTrigger value="phone">{t('auth.withPhone')}</TabsTrigger>
      </TabsList>

      <TabsContent value="email">
        <EmailForm callbackUrl={callbackUrl} />
      </TabsContent>
      <TabsContent value="phone">
        <PhoneForm callbackUrl={callbackUrl} />
      </TabsContent>
    </Tabs>
  )
}

function EmailForm({ callbackUrl }: { callbackUrl?: string }) {
  const t = useT()

  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [needsTotp, setNeedsTotp] = useState(false)
  // Controlled on purpose. A form `action` resets every uncontrolled field when
  // it settles, so the step that asks for the 2FA code used to arrive with the
  // email and password wiped — and submitting it failed on the blank fields.
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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
      if (result.status === 'error') setError(t(result.messageKey))
    })
  }

  return (
    <form action={onSubmit} className="space-y-4 pt-2">
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}

      <Field label={t('auth.email')} htmlFor="email" required>
        {/* Latin content on an Arabic page — forced LTR so the caret behaves. */}
        <Input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </Field>

      <Field label={t('auth.password')} htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </Field>

      {/* Under the field it rescues, at the inline end. Muted, not gold — the
          submit button is this form's one gold voice. */}
      <p className="-mt-2 text-end text-sm">
        <Link
          href="/forgot-password"
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t('auth.forgotLink')}
        </Link>
      </p>

      {needsTotp ? (
        <Field label={t('auth.twoFactor')} htmlFor="totp" hint={t('auth.twoFactorPrompt')} required>
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
        {pending ? t('state.loading') : t('auth.signIn')}
      </Button>
    </form>
  )
}

function PhoneForm({ callbackUrl }: { callbackUrl?: string }) {
  const t = useT()

  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  function sendCode(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await requestPhoneCode(formData)
      if (result.status === 'code_sent') {
        setSentTo(result.phone)
        return
      }
      if (result.status === 'error') setError(t(result.messageKey))
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
      if (result.status === 'error') setError(t(result.messageKey))
    })
  }

  if (!sentTo) {
    return (
      <form action={sendCode} className="space-y-4 pt-2">
        <Field label={t('auth.phone')} htmlFor="phone" hint={t('auth.phoneHint')} required>
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
          {pending ? t('state.loading') : t('auth.sendCode')}
        </Button>
      </form>
    )
  }

  return (
    <form action={verify} className="space-y-4 pt-2">
      <input type="hidden" name="phone" value={sentTo} />
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}

      <p className="text-sm text-muted-foreground">{t('auth.codeSent', { phone: sentTo })}</p>

      <Field label={t('auth.codeLabel')} htmlFor="code" required>
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
        {pending ? t('state.loading') : t('auth.verify')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => setSentTo(null)}
      >
        {t('auth.changeNumber')}
      </Button>
    </form>
  )
}
