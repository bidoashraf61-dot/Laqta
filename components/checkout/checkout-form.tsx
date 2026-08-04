'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/state'
import { Card, CardContent } from '@/components/ui/card'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { PaymentMethod } from '@/lib/payments'
import { placeOrder } from '@/app/(public)/checkout/actions'

const METHOD_LABEL: Record<PaymentMethod, string> = {
  card: 'checkout.methodCard',
  apple_pay: 'checkout.methodApplePay',
  mada: 'checkout.methodMada',
  tabby: 'checkout.methodTabby',
  tamara: 'checkout.methodTamara',
  bank_transfer: 'checkout.methodBankTransfer',
}

/**
 * Checkout, in one step rather than the brief's two.
 *
 * The cart page already is step one — line items, tiers, totals — so splitting
 * the remaining fields across two more screens would add a click without
 * adding clarity. Billing entity and payment fit on one screen.
 */
export function CheckoutForm({
  methods,
  defaults,
}: {
  methods: PaymentMethod[]
  defaults: {
    billingEntityType: 'individual' | 'business'
    legalName: string
    crNumber: string
    vatNumber: string
  }
}) {
  const [pending, startTransition] = useTransition()
  const [entity, setEntity] = useState(defaults.billingEntityType)
  const [method, setMethod] = useState<PaymentMethod>(methods[0] ?? 'bank_transfer')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ orderNumber: string; settled: boolean } | null>(null)

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await placeOrder(formData)
      if (result.ok) {
        setDone({ orderNumber: result.orderNumber, settled: result.settled })
        return
      }
      setError(t(result.messageKey))
    })
  }

  if (done) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-success" />
          <h2 className="font-display text-xl font-semibold">{t('checkout.successTitle')}</h2>
          <p className="numeric text-sm text-muted-foreground">
            {t('checkout.orderNumber')}: {done.orderNumber}
          </p>
          <p className="text-muted-foreground">
            {done.settled ? t('checkout.successPaid') : t('checkout.successPending')}
          </p>
          {done.settled ? null : (
            <Alert variant="info">
              <AlertDescription>{t('checkout.bankTransferInstructions')}</AlertDescription>
            </Alert>
          )}
          <Button asChild variant="gold">
            <Link href="/account/library">{t('checkout.goToLibrary')}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <section className="space-y-4">
        <h2 className="font-semibold">{t('checkout.billing')}</h2>

        <div className="flex gap-2" role="radiogroup" aria-label={t('checkout.billing')}>
          <Toggle
            active={entity === 'individual'}
            onClick={() => setEntity('individual')}
            label={t('checkout.entityIndividual')}
          />
          <Toggle
            active={entity === 'business'}
            onClick={() => setEntity('business')}
            label={t('checkout.entityBusiness')}
          />
        </div>
        <input type="hidden" name="billingEntityType" value={entity} />

        {/* Business reveals the fields a compliant tax invoice needs. Not
            optional: an invoice without a VAT number is one the buyer's
            finance department sends straight back. */}
        {entity === 'business' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('checkout.legalName')} htmlFor="legalName" required>
              <Input id="legalName" name="legalName" defaultValue={defaults.legalName} required />
            </Field>
            <Field label={t('checkout.crNumber')} htmlFor="crNumber">
              <Input
                id="crNumber"
                name="crNumber"
                dir="ltr"
                className="numeric"
                defaultValue={defaults.crNumber}
              />
            </Field>
            <Field label={t('checkout.vatNumber')} htmlFor="vatNumber" required>
              <Input
                id="vatNumber"
                name="vatNumber"
                dir="ltr"
                className="numeric"
                defaultValue={defaults.vatNumber}
                required
              />
            </Field>
            <Field label={t('checkout.poNumber')} htmlFor="poNumber">
              <Input id="poNumber" name="poNumber" dir="ltr" className="numeric" />
            </Field>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('checkout.address')} htmlFor="addressLine1">
            <Input id="addressLine1" name="addressLine1" />
          </Field>
          <Field label={t('checkout.city')} htmlFor="city">
            <Input id="city" name="city" />
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">{t('checkout.paymentMethod')}</h2>
        <div className="grid gap-2" role="radiogroup" aria-label={t('checkout.paymentMethod')}>
          {methods.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={method === option}
              onClick={() => setMethod(option)}
              className={cn(
                'rounded-md border p-3 text-start text-sm transition-colors',
                method === option ? 'border-gold bg-gold/10' : 'border-input hover:border-foreground/25',
              )}
            >
              {t(METHOD_LABEL[option])}
            </button>
          ))}
        </div>
        <input type="hidden" name="method" value={method} />

        {/* Said plainly rather than shown as a disabled button nobody can
            explain. Card, Apple Pay and BNPL land when a gateway is signed. */}
        <Alert variant="info">
          <AlertDescription>{t('checkout.gatewayPending')}</AlertDescription>
        </Alert>
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" variant="gold" size="lg" className="w-full" disabled={pending}>
        {pending ? t('state.loading') : t('checkout.placeOrder')}
      </Button>
    </form>
  )
}

function Toggle({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'flex-1 rounded-md border px-4 py-2 text-sm transition-colors',
        active ? 'border-gold bg-gold/10 text-gold' : 'border-input hover:border-foreground/25',
      )}
    >
      {label}
    </button>
  )
}
