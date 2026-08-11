'use client'

import * as React from 'react'
import { requestFootage } from '@/app/(public)/actions'
import { Button } from '@/components/ui/button'
import { Headline, Section } from '@/components/ui/typography'
import { useT } from '@/lib/i18n-client'

/**
 * "Ask for footage that does not exist yet."
 *
 * ── Why this belongs on the page ────────────────────────────────────────────
 * Every stock library has a dead end: the search that returns nothing. On a
 * shot library that dead end is permanent — nobody is flying to Taif this week
 * because one editor asked. Here it is a production job, so the dead end
 * becomes the strongest thing on the site: the buyer names what they want and
 * we can actually make it.
 *
 * It is also the cheapest demand signal in the product. Every submission is a
 * customer telling us what to build next, in their own words, with an address
 * to notify when it ships.
 *
 * ── Why it does not require an account ──────────────────────────────────────
 * Most people who hit an empty result have not signed up. Putting a sign-up
 * wall in front of the request is how you never hear it.
 */
export function RequestFootage({ compact = false }: { compact?: boolean }) {
  const t = useT()

  const [state, setState] = React.useState<{ ok: boolean; messageKey: string } | null>(null)
  const [pending, startTransition] = React.useTransition()

  function onSubmit(formData: FormData) {
    startTransition(async () => setState(await requestFootage(formData)))
  }

  const form = (
    <form action={onSubmit} className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
      <div className="grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{t('request.briefLabel')}</span>
          <input
            name="brief"
            required
            minLength={6}
            maxLength={600}
            placeholder={t('request.briefPlaceholder')}
            className="h-11 rounded-md border border-input bg-card px-3 text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{t('request.emailLabel')}</span>
          <input
            name="email"
            type="email"
            required
            dir="ltr"
            className="ltr-island h-11 rounded-md border border-input bg-card px-3 text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>
      <div className="flex items-end">
        <Button type="submit" variant="gold" disabled={pending} className="w-full sm:w-auto">
          {t('request.submit')}
        </Button>
      </div>

      {/* Announced, not just shown: a visitor using a screen reader gets no
          signal from a colour change. */}
      <p
        role="status"
        aria-live="polite"
        className="text-sm sm:col-span-2"
        data-state={state?.ok ? 'ok' : state ? 'error' : undefined}
      >
        {state ? (
          <span className={state.ok ? 'text-success' : 'text-destructive'}>
            {t(state.messageKey)}
          </span>
        ) : null}
      </p>
    </form>
  )

  // Inline variant, for the zero-results dead end where a full band would be
  // too much furniture.
  if (compact) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border bg-card p-6 text-start">
        <p className="font-subhead text-lg font-medium">{t('request.bold')}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t('request.body')}</p>
        {form}
      </div>
    )
  }

  return (
    <Section tone="olive">
      <div className="mx-auto max-w-2xl">
        <Headline lead={t('request.lead')} bold={t('request.bold')} size="lg" />
        <p className="mt-4 text-foreground">{t('request.body')}</p>
        {form}
      </div>
    </Section>
  )
}
