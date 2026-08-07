import Link from 'next/link'
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
    <Section tone="oasis">
      <div className="grid gap-12 md:grid-cols-2 md:items-center">
        <div className="max-w-xl">
          <Headline lead={t('landing.licenseLead')} bold={t('landing.licenseBold')} size="lg" />
          <Prose className="mt-5">{t('landing.licenseBody')}</Prose>
          <Button asChild variant="outline" size="sm" className="mt-6">
            <Link href="/licences">{t('landing.licenseCta')}</Link>
          </Button>
        </div>

        <ul className="space-y-5">
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
      </div>
    </Section>
  )
}
