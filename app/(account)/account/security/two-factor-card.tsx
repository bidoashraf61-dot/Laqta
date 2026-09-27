'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/state'
import { toast } from '@/components/ui/toast'
import {
  beginTwoFactorEnrolment,
  confirmTwoFactor,
  disableTwoFactor,
  refreshTwoFactorSession,
} from './actions'
import { useT } from '@/lib/i18n-client'

/**
 * `next` is set when a creator or admin was held here on the way to /admin or
 * /studio (lib/two-factor.ts). Leaving uses a full navigation, not the client
 * router: the session cookie has just been re-issued, and the dashboard's
 * middleware gate must read the new one — a soft navigation that silently
 * declined to commit (CLAUDE.md) would strand them on this page.
 */
export function TwoFactorCard({
  enabled,
  mandatory,
  next,
}: {
  enabled: boolean
  mandatory: boolean
  next: string | null
}) {
  const t = useT()

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
        setError(t(result.messageKey))
        return
      }
      setSecret(null)
      toast.success(t(result.messageKey))
      if (next) window.location.assign(next)
      else router.refresh()
    })
  }

  function carryOn() {
    if (!next) return
    const target = next
    startTransition(async () => {
      await refreshTwoFactorSession()
      window.location.assign(target)
    })
  }

  const held = mandatory && !enabled

  function turnOff() {
    startTransition(async () => {
      const result = await disableTwoFactor()
      if (!result.ok) {
        setError(t(result.messageKey))
        return
      }
      toast.success(t(result.messageKey))
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {held ? (
        <Alert variant="info" data-two-factor="required">
          <AlertTitle>{t('security.requiredTitle')}</AlertTitle>
          <AlertDescription>{t('security.requiredBody')}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>{t('security.twoFactor')}</CardTitle>
            <Badge variant={enabled ? 'success' : 'neutral'}>
              {enabled ? t('security.enabled') : t('security.disabled')}
            </Badge>
          </div>
          <CardDescription>{t('security.twoFactorWhy')}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {secret ? (
            <form action={confirm} className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('security.setupIntro')}</p>

              {/* The key is shown as text rather than only a QR: every
                authenticator accepts manual entry, and a QR would mean adding
                a rendering dependency to the account-security path. */}
              <Field label={t('security.secretKey')} htmlFor="secret">
                <Input
                  id="secret"
                  readOnly
                  value={secret}
                  dir="ltr"
                  className="numeric tracking-widest"
                  onFocus={(event) => event.currentTarget.select()}
                />
              </Field>

              <Field label={t('security.enterCodeToEnable')} htmlFor="token" required>
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

              <Button type="submit" variant="default" disabled={pending}>
                {t('security.enable')}
              </Button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {enabled ? (
                mandatory ? (
                  <p className="text-sm text-muted-foreground">{t('security.twoFactorWhy')}</p>
                ) : (
                  <Button variant="outline" onClick={turnOff} disabled={pending}>
                    {t('security.disable')}
                  </Button>
                )
              ) : (
                <Button variant="default" onClick={start} disabled={pending}>
                  {t('security.enable')}
                </Button>
              )}
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          )}

          {enabled && next ? (
            <div className="space-y-3 border-t pt-4" data-two-factor="ready">
              <p className="text-sm">
                <span className="font-medium">{t('security.readyTitle')}.</span>{' '}
                <span className="text-muted-foreground">{t('security.readyBody')}</span>
              </p>
              <Button variant="default" onClick={carryOn} disabled={pending}>
                {t('security.continue')}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
