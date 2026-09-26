'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/state'
import { useT } from '@/lib/i18n-client'
import type { ActionResult } from '@/components/dashboard/form'

/**
 * "Verify this channel" — the mechanism the profile warning promised.
 *
 * The warning on /account/profile says that changing an email or a mobile
 * clears its verification «حتى تؤكّده مرة أخرى». That sentence was true and
 * the way to confirm it did not exist, which made it a dead end rather than a
 * warning. These two controls are that way.
 *
 * ── Why the development fallback is shown, loudly ───────────────────────────
 * No mail provider is wired yet. The mail driver says so honestly
 * (lib/mail.ts) and hands back the link instead of pretending to have sent
 * one. The phone code never comes back this way: with no SMS provider the
 * profile page does not render `VerifyPhone` at all (lib/otp.ts
 * `phoneSignInEnabled`). This surfaces that rather than
 * hiding it: a screen that says "check your inbox" for a message that was
 * never sent is a support ticket nobody can reproduce.
 *
 * When a provider is configured the fallback simply stops arriving, and this
 * renders the ordinary "we sent it" message with no change here.
 */
export function VerifyEmail({
  send,
}: {
  send: () => Promise<ActionResult & { devLink?: string }>
}) {
  const t = useT()
  const [state, setState] = React.useState<(ActionResult & { devLink?: string }) | null>(null)
  const [pending, start] = React.useTransition()

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => start(async () => setState(await send()))}
      >
        {t('account.verifySendEmail')}
      </Button>

      {state ? (
        <Alert variant={state.ok ? 'info' : 'destructive'} className="space-y-2 text-sm">
          <p>{state.message}</p>
          {state.devLink ? (
            /* A real anchor, not a code block. The point is to finish the
               flow, and asking someone to hand-copy a 64-character token is
               how a test gets skipped. */
            <a
              href={state.devLink}
              className="ltr-island block break-all text-xs underline underline-offset-2"
            >
              {state.devLink}
            </a>
          ) : null}
        </Alert>
      ) : null}
    </div>
  )
}

export function VerifyPhone({
  send,
  confirm,
}: {
  send: () => Promise<ActionResult>
  confirm: (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>
}) {
  const t = useT()
  const [sent, setSent] = React.useState<ActionResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, start] = React.useTransition()

  return (
    <div className="space-y-2">
      {!sent ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => start(async () => setSent(await send()))}
        >
          {t('account.verifySendCode')}
        </Button>
      ) : (
        <form
          className="flex flex-wrap items-end gap-2"
          action={(formData) =>
            start(async () => {
              const result = await confirm(null, formData)
              // A successful confirm redirects, so anything that comes back
              // here is a failure worth showing beside the field.
              if (result && !result.ok) setError(result.message ?? t('state.error'))
            })
          }
        >
          <Input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            required
            maxLength={8}
            placeholder="000000"
            className="w-32"
            aria-label={t('account.verifyCodeLabel')}
          />
          <Button type="submit" size="sm" disabled={pending}>
            {t('account.verifyConfirm')}
          </Button>
        </form>
      )}

      {sent ? (
        <Alert variant="info" className="space-y-1 text-sm">
          <p>{sent.message}</p>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive" className="text-sm">
          {error}
        </Alert>
      ) : null}
    </div>
  )
}
