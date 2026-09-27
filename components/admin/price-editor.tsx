'use client'

import { BadgeDollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/label'
import { Input, Textarea } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays'
import { SettingsForm } from '@/components/dashboard/form'
import { setAlbumPrice } from '@/app/(admin)/admin/actions'
import { useT } from '@/lib/i18n-client'

/**
 * An album's REGULAR price, set by hand from its catalogue row (DEV-61).
 *
 * Any amount — the calculator's range governs approval, not the owner's own
 * special price. A running or scheduled offer must stay below it, so the
 * server refuses a price at or under the offer's. Past orders keep what they
 * paid; the reason is kept in the audit log.
 */
export function PriceEditor({
  albumId,
  price,
  offerPrice,
}: {
  albumId: string
  price: number
  offerPrice: number | null
}) {
  const t = useT()
  const id = (name: string) => `price-${name}-${albumId}`
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <BadgeDollarSign className="size-3.5" aria-hidden />
          {t('dash.price.edit')}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="max-h-[var(--radix-popover-content-available-height)] w-80 overflow-y-auto"
      >
        <SettingsForm action={setAlbumPrice} submitLabel={t('dash.price.save')} className="space-y-4">
          <input type="hidden" name="albumId" value={albumId} />
          <Field
            label={t('dash.price.field')}
            htmlFor={id('value')}
            hint={offerPrice !== null ? t('dash.price.offerHint', { price: offerPrice }) : t('dash.price.hint')}
            required
          >
            <Input
              id={id('value')}
              name="price"
              type="number"
              inputMode="decimal"
              min={offerPrice !== null ? offerPrice + 0.01 : 0.01}
              step="0.01"
              required
              dir="ltr"
              className="numeric"
              defaultValue={price}
            />
          </Field>
          <Field label={t('dash.price.reason')} htmlFor={id('reason')}>
            <Textarea id={id('reason')} name="reason" rows={2} maxLength={300} />
          </Field>
        </SettingsForm>
      </PopoverContent>
    </Popover>
  )
}
