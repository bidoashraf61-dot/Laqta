'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/label'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/state'
import { toast } from '@/components/ui/toast'
import { refund } from '@/app/(admin)/admin/actions'
import { formatMoney, t } from '@/lib/i18n'

/**
 * Refund one order line.
 *
 * The amount defaults to the full remaining balance and is capped at it, so a
 * partial refund is a deliberate edit rather than the accidental result of a
 * mistyped figure. The panel states the frozen-commission rule out loud
 * because the reversal will not match the creator's current rate and an
 * operator who does not know that will file it as a bug.
 */
export function RefundControl({
  orderItemId,
  remaining,
  currency,
}: {
  orderItemId: string
  remaining: number
  currency: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(String(remaining))
  const [reason, setReason] = useState('')
  const [policyBasis, setPolicyBasis] = useState('technical_fault')
  const [pending, startTransition] = useTransition()

  if (remaining <= 0) return null

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Undo2 className="size-3.5" />
        {t('dash.refund')}
      </Button>

      {open ? (
        <div className="mt-3 space-y-4 rounded-md border border-border/60 bg-background p-4">
          <Alert variant="warning">
            <AlertDescription>{t('dash.refundHint')}</AlertDescription>
          </Alert>

          <Field
            label={t('dash.payoutAmount')}
            htmlFor={`amount-${orderItemId}`}
            hint={formatMoney(remaining, currency)}
          >
            <Input
              id={`amount-${orderItemId}`}
              type="number"
              min={0.01}
              max={remaining}
              step={0.01}
              dir="ltr"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>

          <Field label={t('dash.refundPolicy')} htmlFor={`basis-${orderItemId}`}>
            <NativeSelect
              id={`basis-${orderItemId}`}
              value={policyBasis}
              onChange={(event) => setPolicyBasis(event.target.value)}
            >
              <option value="technical_fault">{t('dash.basisTechnical')}</option>
              <option value="licence_mismatch">{t('dash.basisLicence')}</option>
              <option value="duplicate_purchase">{t('dash.basisDuplicate')}</option>
              <option value="goodwill">{t('dash.basisGoodwill')}</option>
            </NativeSelect>
          </Field>

          <Field label={t('dash.refundReason')} htmlFor={`reason-${orderItemId}`} required>
            <Textarea
              id={`reason-${orderItemId}`}
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => {
              const value = Number(amount)
              if (!Number.isFinite(value) || value <= 0 || value > remaining) {
                toast.error(t('dash.payoutAmount'))
                return
              }
              if (!reason.trim()) {
                toast.error(t('dash.refundReason'))
                return
              }
              if (!window.confirm(t('dash.refund'))) return

              startTransition(async () => {
                const result = await refund({
                  orderItemId,
                  amount: value,
                  reason,
                  policyBasis,
                })
                if (result.ok) {
                  toast.success(t('actions.confirm'))
                  setOpen(false)
                  router.refresh()
                } else {
                  toast.error(t(result.messageKey ?? 'state.error'))
                }
              })
            }}
          >
            {pending ? t('state.loading') : t('dash.refund')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
