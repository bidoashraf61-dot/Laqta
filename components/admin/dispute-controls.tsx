'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { EyeOff, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { ActionButton } from '@/components/dashboard/form'
import { setDisputeStatus } from '@/app/(admin)/admin/actions'
import { useT } from '@/lib/i18n-client'

/**
 * Dispute verbs.
 *
 * Disabling content is one click because a credible takedown notice is time
 * sensitive; closing the dispute takes a written resolution because the
 * decision has to be defensible months later. The asymmetry is deliberate —
 * the reversible act is cheap, the final one costs a sentence.
 */
export function DisputeControls({ disputeId, status }: { disputeId: string; status: string }) {
  const t = useT()

  const router = useRouter()
  const [resolving, setResolving] = useState(false)
  const [resolution, setResolution] = useState('')
  const [pending, startTransition] = useTransition()

  const closed = status === 'resolved' || status === 'rejected'

  const close = (next: 'resolved' | 'rejected') =>
    startTransition(async () => {
      if (!resolution.trim()) {
        toast.error(t('dash.resolution'))
        return
      }
      const result = await setDisputeStatus(disputeId, next, resolution)
      if (result.ok) {
        toast.success(result.message ?? t('actions.confirm'))
        setResolving(false)
        setResolution('')
        router.refresh()
      } else {
        toast.error(result.message ?? t('state.error'))
      }
    })

  if (closed) return null

  return (
    <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
      <div className="flex flex-wrap gap-2">
        {status === 'open' ? (
          <ActionButton
            action={setDisputeStatus.bind(null, disputeId, 'investigating', undefined)}
            label={t('dash.disputeInvestigating')}
          />
        ) : null}

        {status === 'content_disabled' ? (
          <ActionButton
            action={setDisputeStatus.bind(null, disputeId, 'investigating', undefined)}
            label={t('dash.restoreContent')}
            icon={<RotateCcw className="size-3.5" />}
          />
        ) : (
          <ActionButton
            action={setDisputeStatus.bind(null, disputeId, 'content_disabled', undefined)}
            label={t('dash.disableContent')}
            variant="destructive"
            confirm={t('dash.disableContent')}
            icon={<EyeOff className="size-3.5" />}
          />
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={resolving}
          onClick={() => setResolving((value) => !value)}
        >
          {t('dash.resolveDispute')}
        </Button>
      </div>

      {resolving ? (
        <div className="space-y-2">
          <Textarea
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={t('dash.resolution')}
            aria-label={t('dash.resolution')}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={() => close('resolved')}>
              {t('dash.disputeResolved')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => close('rejected')}
            >
              {t('dash.disputeRejected')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
