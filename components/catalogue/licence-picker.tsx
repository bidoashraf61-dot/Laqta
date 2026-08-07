'use client'

import { useState } from 'react'
import Link from 'next/link'
import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays'
import { formatMoney, t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Licence tier selector and the buy button.
 *
 * Extended is 3× standard by policy. The "which do I need?" helper is not
 * decoration: buyers who guess wrong either overpay and resent it, or underpay
 * and end up out of licence — both are support tickets, and the second is a
 * legal problem. Editorial-only albums cannot be sold as Extended at all, so
 * the tier is hidden rather than shown-and-rejected at checkout.
 */
export function LicencePicker({
  albumSlug,
  creatorHandle,
  priceStandard,
  priceExtended,
  currency,
  editorialOnly,
}: {
  albumSlug: string
  creatorHandle: string
  priceStandard: number
  priceExtended: number
  currency: string
  editorialOnly: boolean
}) {
  const [tier, setTier] = useState<'standard' | 'extended'>('standard')
  const price = tier === 'extended' ? priceExtended : priceStandard

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="numeric text-3xl font-bold text-gold">
            {formatMoney(price, currency)}
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                <HelpCircle className="size-3.5" />
                {t('catalogue.licenceWhich')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="space-y-3 text-sm">
              <p>
                <strong>{t('commerce.licenceStandard')}</strong> —{' '}
                {t('catalogue.licenceStandardHint')}
              </p>
              <p>
                <strong>{t('commerce.licenceExtended')}</strong> —{' '}
                {t('catalogue.licenceExtendedHint')}
              </p>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-2" role="radiogroup" aria-label={t('commerce.licence')}>
          <TierOption
            selected={tier === 'standard'}
            onSelect={() => setTier('standard')}
            label={t('commerce.licenceStandard')}
            hint={t('catalogue.licenceStandardHint')}
            price={formatMoney(priceStandard, currency)}
          />
          {editorialOnly ? null : (
            <TierOption
              selected={tier === 'extended'}
              onSelect={() => setTier('extended')}
              label={t('commerce.licenceExtended')}
              hint={t('catalogue.licenceExtendedHint')}
              price={formatMoney(priceExtended, currency)}
            />
          )}
        </div>

        <Button asChild variant="gold" size="lg" className="w-full">
          <Link href={`/cart/add?album=${creatorHandle}/${albumSlug}&tier=${tier}`}>
            {t('catalogue.buyAlbum')}
          </Link>
        </Button>

        <p className="text-center text-xs text-muted-foreground">{t('catalogue.reassurance')}</p>
      </CardContent>
    </Card>
  )
}

function TierOption({
  selected,
  onSelect,
  label,
  hint,
  price,
}: {
  selected: boolean
  onSelect: () => void
  label: string
  hint: string
  price: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'rounded-md border p-3 text-start transition-colors',
        selected ? 'border-gold bg-gold/10' : 'border-input hover:border-foreground/25',
      )}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold">{label}</span>
        <span className="numeric text-sm">{price}</span>
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
    </button>
  )
}
