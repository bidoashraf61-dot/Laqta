import { Clock, Infinity as Forever, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from '@/components/ui/link'
import { Headline, Prose, Section } from '@/components/ui/typography'
import { t } from '@/lib/i18n'

/**
 * Pricing & value.
 *
 * The value case, stated plainly: one payment, full rights, sizes for every
 * budget. It sits on the gold-tint accent ground the system reserves for the
 * money beat, and closes with the primary buy action.
 *
 * The three points are plain centred columns, not another identical-card grid —
 * the design system treats card-of-heading-plus-text as the lazy page scaffold.
 *
 * ── The icons are ink, not gold ─────────────────────────────────────────────
 * Gold is rationed to money, the primary action and the active state (the One
 * Voice Rule in DESIGN.md). This section already spends it on the buy button;
 * three gold icons above it would make four gold things in one band, and the
 * button would stop being the loudest. The icons sit on a paper disc so they
 * read as marks on the gold-tint ground rather than as holes in it.
 */
const POINTS = [
  { key: 'price1', Icon: Forever },
  { key: 'price2', Icon: Clock },
  { key: 'price3', Icon: Palette },
] as const

export function PricingValue() {
  return (
    <Section tone="accent">
      <div className="mx-auto max-w-2xl text-center">
        <Headline lead={t('landing.priceLead')} bold={t('landing.priceBold')} size="lg" />
        <Prose className="mx-auto mt-5">{t('landing.priceSub')}</Prose>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-10 sm:grid-cols-3 sm:gap-8">
        {POINTS.map(({ key, Icon }) => (
          <div key={key} className="flex flex-col items-center text-center">
            {/* Decorative: the title beside it says the same thing in words. */}
            <span
              aria-hidden
              className="mb-4 grid size-14 place-items-center rounded-full border border-foreground/10 bg-background text-foreground shadow-soft"
            >
              <Icon className="size-6" strokeWidth={1.6} />
            </span>
            <p className="font-bold">{t(`landing.${key}Title`)}</p>
            <p className="mt-2 max-w-[28ch] text-sm leading-relaxed text-muted-foreground">
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
