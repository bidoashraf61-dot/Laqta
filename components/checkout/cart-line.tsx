'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import type { LicenceTier } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Bilingual } from '@/components/ui/bilingual'
import { formatMoney, t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { removeFromCart, setTier } from '@/app/(public)/cart/actions'

/**
 * A cart line with the licence tier editable in place.
 *
 * Editable here rather than only on the PDP because tier is the one thing
 * buyers change their mind about at the last second — sending them back to the
 * product page to do it loses carts.
 */
export function CartLine({
  albumId,
  titleAr,
  titleEn,
  creatorNameAr,
  clipCount,
  tier,
  unitPrice,
  currency,
  editorialOnly,
}: {
  albumId: string
  titleAr: string
  titleEn: string
  creatorNameAr: string
  clipCount: number
  tier: LicenceTier
  unitPrice: number
  currency: string
  editorialOnly: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const change = (next: LicenceTier) =>
    startTransition(async () => {
      await setTier(albumId, next)
      router.refresh()
    })

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            <Bilingual ar={titleAr} en={titleEn} />
          </p>
          <p className="text-sm text-muted-foreground">
            {t('commerce.byCreator', { creator: creatorNameAr })} ·{' '}
            <span className="numeric">{clipCount}</span> {t('commerce.clip')}
          </p>

          <div className="mt-2 flex gap-2">
            <TierChip
              active={tier === 'standard'}
              onClick={() => change('standard')}
              label={t('commerce.licenceStandard')}
              disabled={pending}
            />
            {/* Editorial-only albums cannot carry an Extended licence at all,
                so the option is absent rather than rejected at checkout. */}
            {editorialOnly ? null : (
              <TierChip
                active={tier === 'extended'}
                onClick={() => change('extended')}
                label={t('commerce.licenceExtended')}
                disabled={pending}
              />
            )}
          </div>
        </div>

        <span className="numeric text-lg font-bold text-gold">
          {formatMoney(unitPrice, currency)}
        </span>

        <Button
          variant="ghost"
          size="icon"
          aria-label={t('cart.remove')}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await removeFromCart(albumId)
              router.refresh()
            })
          }
        >
          <Trash2 />
        </Button>
      </CardContent>
    </Card>
  )
}

function TierChip({
  active,
  onClick,
  label,
  disabled,
}: {
  active: boolean
  onClick: () => void
  label: string
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50',
        active ? 'border-gold bg-gold/15 text-gold' : 'border-input text-muted-foreground',
      )}
    >
      {label}
    </button>
  )
}
