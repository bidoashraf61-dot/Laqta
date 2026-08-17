import { Link } from '@/components/ui/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Headline, Prose, Section } from '@/components/ui/typography'
import { t } from '@/lib/i18n'

/**
 * Licensing & rights — the trust band.
 *
 * Licensing is the footage buyer's single biggest anxiety, and most stock
 * libraries push that risk onto the buyer. Saying out loud that the licence is
 * full and permanent and that permits are reviewed is both the reassurance
 * that unblocks the purchase and a rare differentiator.
 *
 * It sits on the oasis (green) ground the system reserves for "cleared /
 * verified", and states the rights as a plain checklist — not another grid of
 * identical icon cards.
 */
const RIGHTS = ['lic1', 'lic2', 'lic3', 'lic4'] as const

export function LicensingRights() {
  return (
    <Section tone="raised">
      <div className="mx-auto max-w-2xl text-center">
        <Headline lead={t('landing.licenseLead')} bold={t('landing.licenseBold')} size="lg" />
        <Prose className="mx-auto mt-5">{t('landing.licenseBody')}</Prose>
        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline" size="sm">
            <Link href="/licences">{t('landing.licenseCta')}</Link>
          </Button>
        </div>
      </div>

      <ul className="mx-auto mt-12 grid max-w-4xl gap-x-10 gap-y-6 sm:grid-cols-2">
        {RIGHTS.map((key) => (
          <li key={key} className="flex items-start gap-3">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-oasis/15 text-oasis">
              <Check className="size-3.5" />
            </span>
            <div>
              <p className="font-bold">{t(`landing.${key}Title`)}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t(`landing.${key}Body`)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}
