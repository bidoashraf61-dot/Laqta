'use client'

import { useActionState, useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/state'
import { SubmitButton, type ActionResult } from '@/components/dashboard/form'
import { useT } from '@/lib/i18n-client'
import { cn } from '@/lib/utils'

/**
 * «بياناتك» — download everything, or delete the account (DEV-52).
 *
 * The delete control is two steps on the page, not a modal: the first click
 * only opens the consequences and a field; the account goes when the reader
 * has typed their own email (or mobile) and pressed the red button. Typing it
 * is the confirmation — a native confirm() is one reflexive Enter away.
 */
export function PrivacyControls({
  canDelete,
  confirmBy,
  deleteAction,
}: {
  /** False for creators and admins — they are told to write to support. */
  canDelete: boolean
  /** Which credential the reader types to confirm. */
  confirmBy: 'email' | 'phone'
  deleteAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(deleteAction, null)

  return (
    <section aria-labelledby="privacy-title" className="space-y-4 rounded-lg border p-5">
      <div className="space-y-1">
        <h2 id="privacy-title" className="font-display text-lg font-bold">
          {t('account.privacyTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('account.privacyIntro')}</p>
      </div>

      <div data-privacy="export" className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div className="max-w-prose space-y-1">
          <h3 className="text-sm font-medium">{t('account.exportTitle')}</h3>
          <p className="text-sm text-muted-foreground">{t('account.exportHint')}</p>
        </div>
        {/* A plain anchor: the answer is a file, and a download must not be
            left to a client-router navigation (CLAUDE.md). */}
        <a href="/account/data-export" download className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Download aria-hidden className="size-4" />
          {t('account.exportAction')}
        </a>
      </div>

      <div data-privacy="delete" className="space-y-3">
        <div className="max-w-prose space-y-1">
          <h3 className="text-sm font-medium">{t('account.deleteTitle')}</h3>
          <p className="text-sm text-muted-foreground">
            {canDelete ? t('account.deleteHint') : t('account.deleteNotBuyer')}
          </p>
        </div>

        {canDelete && !open ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => setOpen(true)}
            aria-expanded={false}
            aria-controls="delete-account-form"
          >
            <Trash2 aria-hidden className="size-4" />
            {t('account.deleteStart')}
          </Button>
        ) : null}

        {canDelete && open ? (
          <form id="delete-account-form" action={formAction} className="space-y-4 rounded-md border border-destructive/40 p-4">
            <Alert variant="destructive">
              <AlertDescription>{t('account.deleteWarning')}</AlertDescription>
            </Alert>
            {state && !state.ok ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {state.message ?? t('state.error')}
              </p>
            ) : null}
            <div className="space-y-2">
              <label htmlFor="delete-confirm" className="text-sm font-medium">
                {confirmBy === 'phone' ? t('account.deleteConfirmLabelPhone') : t('account.deleteConfirmLabel')}
              </label>
              <Input
                id="delete-confirm"
                name="confirm"
                type={confirmBy === 'phone' ? 'tel' : 'email'}
                dir="ltr"
                required
                autoComplete="off"
                className="max-w-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <SubmitButton variant="destructive">{t('account.deleteSubmit')}</SubmitButton>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t('account.deleteCancel')}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  )
}
