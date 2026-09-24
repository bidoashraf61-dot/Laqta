'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { ActionButton } from '@/components/dashboard/form'
import { approvePayout, markPayoutPaid } from '@/app/(admin)/admin/actions'
import { useT } from '@/lib/i18n-client'

/**
 * Payout verbs.
 *
 * Approving freezes the destination; marking paid requires the bank reference,
 * because a transfer with no reference cannot be reconciled against a
 * statement later and is the single most common cause of "you never paid me"
 * disputes.
 *
 * A payout inside a run shows the run instead: it is paid with the run, from
 * the run panel, so the files and the ledger cannot disagree.
 */
export function PayoutControls({
  payoutId,
  status,
  runLabel = null,
}: {
  payoutId: string
  status: string
  /** Set when the payout sits in a run — the run is paid as a whole, not here. */
  runLabel?: string | null
}) {
  const t = useT()

  const router = useRouter()
  const [reference, setReference] = useState('')
  const [pending, startTransition] = useTransition()

  if (status === 'requested') {
    return (
      <ActionButton
        action={approvePayout.bind(null, payoutId)}
        label={t('dash.approvePayout')}
        variant="default"
      />
    )
  }

  if (status === 'processing' && runLabel) {
    return (
      <span className="text-xs text-muted-foreground">
        {t('payoutRun.inRun', { label: '' })}
        <span className="ltr-island">{runLabel}</span>
      </span>
    )
  }

  if (status === 'approved' || status === 'processing') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder={t('dash.payoutRef')}
          aria-label={t('dash.payoutRef')}
          dir="ltr"
          className="h-9 w-44"
        />
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (!reference.trim()) {
              toast.error(t('dash.payoutRef'))
              return
            }
            startTransition(async () => {
              const result = await markPayoutPaid(payoutId, reference.trim())
              if (result.ok) {
                toast.success(result.message ?? t('actions.confirm'))
                router.refresh()
              } else {
                toast.error(result.message ?? t('state.error'))
              }
            })
          }}
        >
          {pending ? t('state.loading') : t('dash.markPaid')}
        </Button>
      </div>
    )
  }

  return null
}
