import Link from 'next/link'
import { Building2, Clapperboard, Landmark, Megaphone, ShieldCheck, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Headline, Prose, Section } from '@/components/ui/typography'
import { t } from '@/lib/i18n'

/**
 * The two sections that carry the positioning.
 *
 * Laqta is not a studio showing its own reel — it is *the* Saudi library, for
 * anyone whose work touches the Kingdom. Two things have to land before a
 * visitor cares about the catalogue:
 *
 *   1. Why the library they already pay for is not good enough. This is the
 *      only genuinely defensible claim the business has, and it is concrete:
 *      the global libraries really do sell Dubai as Riyadh and a skyline five
 *      years out of date.
 *   2. That this is for them specifically — an agency, a government comms
 *      team, an in-house marketer, a production company.
 *
 * Both are stated plainly rather than implied through imagery. A visitor who
 * has to infer the pitch usually leaves before finishing.
 */

const PROBLEMS = [
  { icon: XCircle, key: 'problemPoint1' },
  { icon: XCircle, key: 'problemPoint2' },
  { icon: XCircle, key: 'problemPoint3' },
  { icon: XCircle, key: 'problemPoint4' },
] as const

export function TheProblem() {
  return (
    <Section tone="base">
      <div className="mb-10 max-w-2xl">
        <Headline lead={t('landing.problemLead')} bold={t('landing.problemTitle')} size="lg" />
        <Prose className="mt-4">{t('landing.problemBody')}</Prose>
      </div>

      <div className="grid gap-px overflow-hidden rounded-lg border bg-border/60 sm:grid-cols-2">
        {PROBLEMS.map(({ icon: Icon, key }) => (
          <div key={key} className="bg-background p-6">
            <Icon className="mb-3 size-5 text-destructive/70" />
            <p className="font-semibold">{t(`landing.${key}Title`)}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {t(`landing.${key}Body`)}
            </p>
          </div>
        ))}
      </div>
    </Section>
  )
}

const AUDIENCES = [
  { icon: Megaphone, key: 'audience1' },
  { icon: Landmark, key: 'audience2' },
  { icon: Building2, key: 'audience3' },
  { icon: Clapperboard, key: 'audience4' },
] as const

export function WhoItsFor() {
  return (
    <Section tone="raised">
      <div className="mb-10 max-w-2xl">
        <Headline lead={t('landing.audienceLead')} bold={t('landing.audienceBold')} size="lg" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {AUDIENCES.map(({ icon: Icon, key }) => (
          <div key={key}>
            <span className="mb-3 grid size-11 place-items-center rounded-md bg-secondary text-foreground">
              <Icon className="size-5" />
            </span>
            <p className="font-semibold">{t(`landing.${key}Title`)}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {t(`landing.${key}Body`)}
            </p>
          </div>
        ))}
      </div>
    </Section>
  )
}

/**
 * Clearance, stated as a selling point rather than as fine print.
 *
 * For a Saudi agency this is the single most expensive thing to get wrong: a
 * campaign shot at AlUla or Diriyah without the site authority's permit is not
 * a licensing quibble, it is a takedown. Saying "we check this" out loud is
 * worth more than any amount of footage volume.
 */
export function Clearance() {
  return (
    <Section tone="accent">
      <div className="flex flex-col items-start gap-8 md:flex-row md:items-center">
        <ShieldCheck className="size-12 shrink-0 text-gold" />
        <div className="max-w-2xl space-y-3">
          <Headline bold={t('landing.clearanceTitle')} size="lg" />
          <Prose>{t('landing.clearanceBody')}</Prose>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/content-policy">{t('landing.clearanceCta')}</Link>
          </Button>
        </div>
      </div>
    </Section>
  )
}
