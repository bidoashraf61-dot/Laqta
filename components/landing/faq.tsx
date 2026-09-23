import { Headline, Section } from '@/components/ui/typography'
import { t } from '@/lib/i18n'
import { currentLocale } from '@/lib/locale'
import { FaqSchema } from '@/components/catalogue/faq-schema'

/**
 * The landing FAQ.
 *
 * The leftover objections a buyer carries to checkout — unit of sale, licence
 * scope, formats, clearance, delivery — answered plainly right before the
 * final calls to action. A definition list, matching the sell page, so the
 * pattern stays one thing across the site.
 *
 * ── Numbered ────────────────────────────────────────────────────────────────
 * On two columns the reading order zig-zags — right, then left, then down —
 * and without a number a reader cannot tell which answer they have already
 * read. The numeral makes that order visible. It is set in the reader's own
 * digits (١ ٢ ٣ in Arabic, 1 2 3 in English), and it
 * lives inside the `<dt>` so a screen reader announces it with the question.
 */
const FAQS = ['faq1', 'faq2', 'faq3', 'faq4', 'faq5'] as const

/**
 * The reader's own digits — NOT `formatNumber`, which forces Latin on purpose
 * because prices and data scan faster in them. This is editorial numbering,
 * and editorial Arabic is set in Arabic-Indic digits (١ ٢ ٣) across the site.
 */
const numeral = (n: number) =>
  new Intl.NumberFormat(currentLocale() === 'ar' ? 'ar-SA-u-nu-arab' : 'en').format(n)

export function LandingFaq() {
  return (
    <Section tone="offwhite">
      <FaqSchema
        pairs={FAQS.map((key) => ({ q: t(`landing.${key}Q`), a: t(`landing.${key}A`) }))}
      />
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <Headline lead={t('landing.faqLead')} bold={t('landing.faqBold')} size="lg" />
      </div>

      <dl className="grid gap-x-12 gap-y-9 md:grid-cols-2">
        {FAQS.map((key, index) => (
          <div key={key}>
            {/*
              The numeral lives INSIDE the <dt>: a <dl>'s grouping <div> may
              contain only <dt> and <dd>, so a sibling span there is invalid
              markup. The answer is indented by the numeral's width plus the
              gap (2.25rem + 1rem), a hanging indent the way a printed FAQ
              sets it, so it aligns under the question and not the number.
            */}
            <dt className="flex items-center gap-4 font-bold">
              <span className="numeric grid size-9 shrink-0 place-items-center rounded-full border border-foreground/15 font-display text-base font-normal text-muted-foreground">
                {numeral(index + 1)}
              </span>
              <span>{t(`landing.${key}Q`)}</span>
            </dt>
            <dd className="mt-2 ps-[3.25rem] font-serif leading-[1.9] text-muted-foreground">
              {t(`landing.${key}A`)}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
