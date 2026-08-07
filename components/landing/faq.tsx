import { Headline, Section } from '@/components/ui/typography'
import { t } from '@/lib/i18n'

/**
 * The landing FAQ.
 *
 * The leftover objections a buyer carries to checkout — unit of sale, licence
 * scope, formats, clearance, delivery — answered plainly right before the
 * final calls to action. A definition list, matching the sell page, so the
 * pattern stays one thing across the site.
 */
const FAQS = ['faq1', 'faq2', 'faq3', 'faq4', 'faq5'] as const

export function LandingFaq() {
  return (
    <Section tone="base">
      <div className="mb-10 max-w-2xl">
        <Headline lead={t('landing.faqLead')} bold={t('landing.faqBold')} size="lg" />
      </div>

      <dl className="grid gap-x-12 gap-y-8 md:grid-cols-2">
        {FAQS.map((key) => (
          <div key={key}>
            <dt className="font-bold">{t(`landing.${key}Q`)}</dt>
            <dd className="mt-2 font-serif leading-[1.9] text-muted-foreground">
              {t(`landing.${key}A`)}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
