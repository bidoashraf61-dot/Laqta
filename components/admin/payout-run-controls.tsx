'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { Spinner } from '@/components/ui/state'
import { excludeRunLine, payRun } from '@/app/(admin)/admin/actions'
import { useT } from '@/lib/i18n-client'

/**
 * Take one line out of a draft run.
 *
 * The reason is optional but kept: it is shown on the payout when it lands
 * back in the queue, which is how the operator remembers why it bounced.
 */
export function RunLineExclude({ runId, payoutId }: { runId: string; payoutId: string }) {
  const t = useT()
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder={t('payoutRun.excludeReason')}
        aria-label={t('payoutRun.excludeReason')}
        className="h-9 w-40"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(t('payoutRun.excludeConfirm'))) return
          startTransition(async () => {
            const result = await excludeRunLine(runId, payoutId, reason.trim())
            if (result.ok) {
              toast.success(result.message ?? t('actions.confirm'))
              router.refresh()
            } else {
              toast.error(result.message ?? t('state.error'))
            }
          })
        }}
      >
        {pending ? <Spinner className="size-4 text-current" /> : null}
        {t('payoutRun.exclude')}
      </Button>
    </div>
  )
}

/**
 * Close the run as paid with the rail's own batch reference.
 *
 * The confirm names the count and the total because this is the one action on
 * the page that cannot be undone: it posts a ledger row per line.
 */
export function RunPayForm({
  runId,
  count,
  totalLabel,
}: {
  runId: string
  count: number
  totalLabel: string
}) {
  const t = useT()
  const router = useRouter()
  const [reference, setReference] = useState('')
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (pending) return
        if (!reference.trim()) {
          toast.error(t('payoutRun.referenceRequired'))
          return
        }
        if (!window.confirm(t('payoutRun.payConfirm', { count, total: totalLabel }))) return
        startTransition(async () => {
          const result = await payRun(runId, reference.trim())
          if (result.ok) {
            toast.success(result.message ?? t('actions.confirm'))
            router.refresh()
          } else {
            toast.error(result.message ?? t('state.error'))
          }
        })
      }}
    >
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">{t('payoutRun.runReference')}</span>
        <Input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          dir="ltr"
          className="h-10 w-64"
          autoComplete="off"
        />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? <Spinner className="size-4 text-current" /> : null}
        {t('payoutRun.markRunPaid')}
      </Button>
    </form>
  )
}
