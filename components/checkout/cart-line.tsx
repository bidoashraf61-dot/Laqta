'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Bilingual } from '@/components/ui/bilingual'
import { formatMoney } from '@/lib/i18n'
import { removeFromCart } from '@/app/(public)/cart/actions'
import { useCount, useT } from '@/lib/i18n-client'

/**
 * A cart line.
 *
 * It used to carry a tier switcher, because the licence was the one thing
 * buyers changed their mind about at the last second. There is one licence
 * now — full commercial — so the line states what it costs and offers the only
 * decision left, which is whether to keep it.
 */
export function CartLine({
  albumId,
  titleAr,
  titleEn,
  creatorNameAr,
  clipCount,
  unitPrice,
  currency,
}: {
  albumId: string
  titleAr: string
  titleEn: string
  creatorNameAr: string
  clipCount: number
  unitPrice: number
  currency: string
}) {
  const t = useT()
  const count = useCount()

  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            <Bilingual ar={titleAr} en={titleEn} />
          </p>
          <p className="text-sm text-muted-foreground">
            {t('commerce.byCreator', { creator: creatorNameAr })} ·{' '}
            {count('clip', clipCount)}
          </p>
          {/* Stated, not chosen. The licence is the same on every line, and a
              buyer should not have to infer that from its absence. */}
          <p className="mt-1 text-xs text-muted-foreground">{t('commerce.licenceCommercial')}</p>
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
