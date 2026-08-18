import { Button } from '@/components/ui/button'
import { Link } from '@/components/ui/link'
import { Headline, Section } from '@/components/ui/typography'
import { t } from '@/lib/i18n'

/**
 * The closing call — the last buyer-facing push before the creator invite and
 * the footer. Replaces the launch waiting-list: the catalogue is live, so the
 * page should end by sending the visitor into it, not asking them to wait.
 */
export function FinalCta() {
  /*
   * Sand, not olive.
   *
   * This sat directly beneath the footage-request band, which is also olive, and
   * the two ran together as one undivided block — a reader had no way to see
   * that a new argument had started. It also butts against the olive footer
   * below it, which made three olive bands in a row.
   */
  return (
    <Section tone="raised">
      <div className="mx-auto max-w-2xl text-center">
        <Headline lead={t('landing.finalCtaLead')} bold={t('landing.finalCtaBold')} size="lg" />
        <div className="mt-8 flex justify-center">
          <Button asChild variant="gold" size="lg">
            <Link href="/footage">{t('landing.finalCtaButton')}</Link>
          </Button>
        </div>
      </div>
    </Section>
  )
}
