import { Button } from '@/components/ui/button'
import { Link } from '@/components/ui/link'
import { Headline, Prose, Section } from '@/components/ui/typography'
import { t } from '@/lib/i18n'

/**
 * Pricing & value.
 *
 * The value case, stated plainly: best price in the market, one payment, full
 * rights, sizes for every budget. It sits on the gold-tint accent ground the
 * system reserves for the money beat, and closes with the primary buy action.
 *
 * The three points are plain centred columns, not another identical-card grid —
 * the design system treats card-of-heading-plus-text as the lazy page scaffold.
 */
const POINTS = ['price1', 'price2', 'price3'] as const

export function PricingValue() {
  return (
    <Section tone="accent">
      <div className="mx-auto max-w-2xl text-center">
        <Headline lead={t('landing.priceLead')} bold={t('landing.priceBold')} size="lg" />
        <Prose className="mx-auto mt-5">{t('landing.priceSub')}</Prose>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-8 sm:grid-cols-3">
        {POINTS.map((key) => (
          <div key={key} className="text-center">
            <p className="font-bold">{t(`landing.${key}Title`)}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t(`landing.${key}Body`)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-12 flex justify-center">
        <Button asChild variant="gold" size="lg">
          <Link href="/albums">{t('landing.priceCta')}</Link>
        </Button>
      </div>
    </Section>
  )
}
