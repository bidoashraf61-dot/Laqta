'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/state'
import { toast } from '@/components/ui/toast'
import { useT } from '@/lib/i18n-client'
import { decideRelease } from '@/app/(admin)/admin/actions'

/**
 * «اعتماد» / «رفض» for one release on the review page (DEV-19).
 *
 * Verify is disabled without a scan — the server refuses it too. Reject opens
 * an inline reason field rather than a prompt(): the reason is what the
 * creator reads, so it deserves a real input, and it stays on the row it
 * belongs to.
 */
export function ReleaseDecision({
  releaseId,
  verification,
  hasScan,
}: {
  releaseId: string
  verification: 'pending' | 'verified' | 'rejected'
  hasScan: boolean
}) {
  const t = useT()
  const router = useRouter()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  const decide = (decision: 'verified' | 'rejected') =>
    startTransition(async () => {
      const result = await decideRelease(releaseId, decision, reason)
      if (result.ok) {
        toast.success(result.message ?? t('dash.saved'))
        setRejecting(false)
        setReason('')
        router.refresh()
      } else {
        toast.error(result.message ?? t('state.error'))
      }
    })

  if (rejecting) {
    return (
      <form
        className="flex w-full flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          decide('rejected')
        }}
      >
        <label className="grid min-w-56 flex-1 gap-1 text-xs">
          <span className="text-muted-foreground">{t('admin.releaseRejectReason')}</span>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required autoFocus />
        </label>
        <Button type="submit" size="sm" variant="destructive" disabled={pending || !reason.trim()}>
          {pending ? <Spinner className="size-4 text-current" /> : null}
          {t('admin.releaseRejectConfirm')}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setRejecting(false)}>
          {t('actions.cancel')}
        </Button>
      </form>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || verification === 'verified' || !hasScan}
        title={!hasScan ? t('admin.releaseNeedsDocument') : undefined}
        onClick={() => decide('verified')}
      >
        {pending ? <Spinner className="size-4 text-current" /> : null}
        {t('admin.releaseVerify')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending || verification === 'rejected'}
        onClick={() => setRejecting(true)}
      >
        {t('admin.releaseReject')}
      </Button>
    </div>
  )
}
