'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/state'
import { toast } from '@/components/ui/toast'
import { beginTwoFactorEnrolment, confirmTwoFactor, disableTwoFactor } from './actions'

export function TwoFactorCard({
  enabled,
  mandatory,
  labels,
}: {
  enabled: boolean
  mandatory: boolean
  labels: Record<string, string>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [secret, setSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function start() {
    setError(null)
    startTransition(async () => {
      const setup = await beginTwoFactorEnrolment()
      setSecret(setup.secret)
    })
  }

  function confirm(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await confirmTwoFactor(formData)
      if (!result.ok) {
        setError(labels[result.messageKey] ?? result.messageKey)
        return
      }
      setSecret(null)
      toast.success(labels[result.messageKey] ?? result.messageKey)
      router.refresh()
    })
  }

  function turnOff() {
    startTransition(async () => {
      const result = await disableTwoFactor()
      if (!result.ok) {
        setError(labels[result.messageKey] ?? result.messageKey)
        return
      }
      toast.success(labels[result.messageKey] ?? result.messageKey)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle>{labels.twoFactor}</CardTitle>
          <Badge variant={enabled ? 'success' : 'neutral'}>
            {enabled ? labels.enabled : labels.disabled}
          </Badge>
        </div>
        <CardDescription>{labels.twoFactorWhy}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {secret ? (
          <form action={confirm} className="space-y-4">
            <p className="text-sm text-muted-foreground">{labels.setupIntro}</p>

            {/* The key is shown as text rather than only a QR: authenticator
                apps all accept manual entry, and a QR image would mean adding
                a rendering dependency to the critical account-security path. */}
            <Field label={labels.secretKey} htmlFor="secret">
              <Input
                id="secret"
                readOnly
                value={secret}
                dir="ltr"
                className="numeric tracking-widest"
                onFocus={(event) => event.currentTarget.select()}
              />
            </Field>

            <Field label={labels.enterCodeToEnable} htmlFor="token" required>
              <Input
                id="token"
                name="token"
                inputMode="numeric"
                maxLength={6}
                dir="ltr"
                className="numeric tracking-[0.4em]"
                autoComplete="one-time-code"
                required
              />
            </Field>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" variant="gold" disabled={pending}>
              {labels.enable}
            </Button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {enabled ? (
              mandatory ? (
                <p className="text-sm text-muted-foreground">{labels.twoFactorWhy}</p>
              ) : (
                <Button variant="outline" onClick={turnOff} disabled={pending}>
                  {labels.disable}
                </Button>
              )
            ) : (
              <Button variant="gold" onClick={start} disabled={pending}>
                {labels.enable}
              </Button>
            )}
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
