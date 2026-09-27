'use client'

import { useState } from 'react'
import { Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays'
import { ActionButton, SettingsForm } from '@/components/dashboard/form'
import { removeAlbumOffer, saveAlbumOffer } from '@/app/(admin)/admin/actions'
import { useT } from '@/lib/i18n-client'

/**
 * An album's offer, set from its catalogue row (DEV-60).
 *
 * A popover for the same reason as the trailer editor: a row that grows a
 * form pushes a hundred-row list down under the operator's cursor.
 *
 * The dates are typed in the owner's own clock (`datetime-local`) and sent as
 * exact instants (hidden ISO fields) — the server runs in UTC, and "starts
 * 1 December 00:00" must mean midnight where the owner is, not in London.
 */
export function OfferEditor({
  albumId,
  regularPrice,
  offer,
}: {
  albumId: string
  regularPrice: number
  offer: {
    price: number | null
    labelAr: string | null
    labelEn: string | null
    startsAt: string | null
    endsAt: string | null
  }
}) {
  const t = useT()
  const [startsAt, setStartsAt] = useState(toLocalInput(offer.startsAt))
  const [endsAt, setEndsAt] = useState(toLocalInput(offer.endsAt))
  const id = (name: string) => `offer-${name}-${albumId}`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Tag className="size-3.5" aria-hidden />
          {offer.price !== null ? t('dash.offer.edit') : t('dash.offer.add')}
        </Button>
      </PopoverTrigger>
      {/* Five fields and two buttons are taller than a laptop screen under a
          row near the bottom: the popover scrolls inside itself so «حفظ» is
          always reachable. */}
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="max-h-[var(--radix-popover-content-available-height)] w-80 space-y-3 overflow-y-auto"
      >
        <SettingsForm action={saveAlbumOffer} submitLabel={t('dash.offer.save')} className="space-y-4">
          <input type="hidden" name="albumId" value={albumId} />
          <input type="hidden" name="startsAt" value={toInstant(startsAt)} />
          <input type="hidden" name="endsAt" value={toInstant(endsAt)} />
          <Field
            label={t('dash.offer.price')}
            htmlFor={id('price')}
            hint={t('dash.offer.priceHint', { price: regularPrice })}
            required
          >
            <Input
              id={id('price')}
              name="offerPrice"
              type="number"
              inputMode="decimal"
              min={1}
              max={regularPrice - 0.01}
              step="0.01"
              required
              dir="ltr"
              className="numeric"
              defaultValue={offer.price ?? ''}
            />
          </Field>
          <Field label={t('dash.offer.labelAr')} htmlFor={id('label-ar')} required>
            <Input
              id={id('label-ar')}
              name="offerLabelAr"
              required
              maxLength={40}
              defaultValue={offer.labelAr ?? ''}
            />
          </Field>
          <Field label={t('dash.offer.labelEn')} htmlFor={id('label-en')} hint={t('dash.offer.labelEnHint')}>
            <Input
              id={id('label-en')}
              name="offerLabelEn"
              dir="ltr"
              maxLength={40}
              defaultValue={offer.labelEn ?? ''}
            />
          </Field>
          <Field label={t('dash.offer.startsAt')} htmlFor={id('starts')} hint={t('dash.offer.startsHint')}>
            <Input
              id={id('starts')}
              type="datetime-local"
              dir="ltr"
              className="numeric"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </Field>
          <Field label={t('dash.offer.endsAt')} htmlFor={id('ends')} hint={t('dash.offer.endsHint')}>
            <Input
              id={id('ends')}
              type="datetime-local"
              dir="ltr"
              className="numeric"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </Field>
        </SettingsForm>
        {offer.price !== null ? (
          <ActionButton
            action={removeAlbumOffer.bind(null, albumId)}
            label={t('dash.offer.remove')}
            confirm={t('dash.offer.removeConfirm')}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

/** ISO instant → the `datetime-local` value in the viewer's own clock. */
function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** `datetime-local` value (viewer's clock) → exact ISO instant, or ''. */
function toInstant(local: string) {
  if (!local) return ''
  const date = new Date(local)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}
