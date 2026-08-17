import { Check } from 'lucide-react'
import { Link } from '@/components/ui/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatMoney, t } from '@/lib/i18n'

/**
 * The buy panel — price, what the licence covers, and the button.
 *
 * ── What this used to be ────────────────────────────────────────────────────
 * A tier selector. Standard and Extended, Extended priced at 3×, with a
 * "which do I need?" popover because buyers who guessed wrong either overpaid
 * and resented it or underpaid and ended up out of licence.
 *
 * There is one licence now — full commercial — so the question is gone and so
 * is the apparatus for answering it. That is the better outcome: the surest
 * way to stop people picking the wrong tier is not to explain the tiers
 * better, it is to not have tiers.
 *
 * ── Why it is no longer a client component ──────────────────────────────────
 * The only state it held was which tier was selected. With one price there is
 * nothing to hold, so it renders on the server and ships no JavaScript.
 */
export function LicencePicker({
  albumSlug,
  creatorHandle,
  priceStandard,
  compareAtPrice,
  currency,
  clipCount,
}: {
  albumSlug: string
  creatorHandle: string
  priceStandard: number
  /** The album's normal price, when it is currently on offer. */
  compareAtPrice?: number | null
  currency: string
  /** What the price buys. Stated in the panel, not left to the page. */
  clipCount: number
}) {
  const onOffer = compareAtPrice != null && compareAtPrice > priceStandard

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="numeric text-4xl font-bold text-gold">
            {formatMoney(priceStandard, currency)}
          </span>
          {onOffer ? (
            <s className="numeric text-lg text-muted-foreground decoration-clay">
              {formatMoney(compareAtPrice, currency)}
            </s>
          ) : null}
        </div>

        {/*
          What the number above actually buys.
          
          A price on its own is not comparable — 399 for what? The count was
          elsewhere on the page, so a buyer reading the panel had to go and
          find it and come back. It belongs in the same box as the number it
          qualifies.
        */}
        <p className="flex items-baseline gap-1.5 border-b pb-4 text-sm text-muted-foreground">
          <span className="numeric text-xl font-bold text-foreground">{clipCount}</span>
          {t('catalogue.shotsIncluded')}
        </p>

        {/* What the one licence actually grants. Stated as facts rather than
            offered as a choice — this is the only licence there is. */}
        <ul className="space-y-1.5 text-sm">
          {[
            t('catalogue.licenceGrantCommercial'),
            t('catalogue.licenceGrantForever'),
            t('catalogue.licenceGrantOnce'),
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-oasis" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <Button asChild variant="gold" size="lg" className="w-full">
          <Link href={`/cart/add?album=${creatorHandle}/${albumSlug}`}>
            {t('catalogue.buyAlbum')}
          </Link>
        </Button>

        <p className="text-center text-xs text-muted-foreground">{t('catalogue.reassurance')}</p>

        <p className="text-center text-xs">
          <Link href="/licences" className="text-muted-foreground underline underline-offset-2">
            {t('catalogue.licenceDetails')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
