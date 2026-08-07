import Link from 'next/link'
import {
  Building2,
  Clapperboard,
  Infinity as InfinityIcon,
  Landmark,
  MapPin,
  Megaphone,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Headline, Prose, Section, SubHeadline } from '@/components/ui/typography'
import { accentChip, cycleAccent, type Accent } from '@/components/ui/accent'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'

/**
 * The story, first.
 *
 * Right after the film, before any catalogue, a plain-language answer to "who
 * are you and why does this exist". A two-sided marketplace has to earn the
 * belief that it was built by people who know the difference between one
 * Riyadh neighbourhood and the next — so the origin is stated, not implied.
 */
export function OurStory() {
  return (
    <Section tone="base">
      <div className="max-w-3xl">
        <Headline lead={t('landing.storyTitle')} bold={t('landing.storyBold')} size="lg" />
        <Prose size="lg" className="mt-6 max-w-2xl">
          {t('landing.storyBody')}
        </Prose>
      </div>
    </Section>
  )
}

const SOLUTIONS = [
  { icon: MapPin, key: 'solution1', accent: 'clay' as Accent }, // real place — earth
  { icon: ShieldCheck, key: 'solution2', accent: 'oasis' as Accent }, // permits — verified/green
  { icon: InfinityIcon, key: 'solution3', accent: 'gold' as Accent }, // own forever — money
] as const

/**
 * The solution, as three concrete promises rather than a slogan — real place,
 * verified permits, permanent ownership. Each is the direct answer to one of
 * the problems the section above names.
 */
export function TheSolution() {
  return (
    <Section tone="raised">
      <div className="mb-10 max-w-2xl">
        <Headline lead={t('landing.solutionTitle')} bold={t('landing.solutionBold')} size="lg" />
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {SOLUTIONS.map(({ icon: Icon, key, accent }) => (
          <div key={key} className="rounded-lg border bg-card p-6">
            <span className={cn('mb-4 grid size-11 place-items-center rounded-md', accentChip[accent])}>
              <Icon className="size-5" />
            </span>
            <SubHeadline as="h3" size="card">
              {t(`landing.${key}Title`)}
            </SubHeadline>
            <p className="mt-2 leading-relaxed text-muted-foreground">{t(`landing.${key}Body`)}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

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
            <p className="font-bold">{t(`landing.${key}Title`)}</p>
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
        {AUDIENCES.map(({ icon: Icon, key }, index) => (
          <div key={key}>
            <span
              className={cn(
                'mb-3 grid size-11 place-items-center rounded-md',
                accentChip[cycleAccent(index)],
              )}
            >
              <Icon className="size-5" />
            </span>
            <p className="font-bold">{t(`landing.${key}Title`)}</p>
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
    <Section tone="oasis">
      <div className="flex flex-col items-start gap-8 md:flex-row md:items-center">
        <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-oasis/12 text-oasis">
          <ShieldCheck className="size-8" />
        </span>
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
