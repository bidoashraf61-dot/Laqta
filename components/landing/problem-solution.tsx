import { Headline, Prose, Section } from '@/components/ui/typography'
import { t } from '@/lib/i18n'

/**
 * The problem, then the shortcut.
 *
 * Right after the hero: name the pain (producing Saudi content is slow and
 * expensive) and answer it in one breath — ready-made, culturally-accurate
 * cinematic albums. Editorial and centred; it earns the catalogue that follows.
 */
export function ProblemSolution() {
  return (
    <Section tone="offwhite">
      <div className="mx-auto max-w-3xl text-center">
        <Headline lead={t('landing.problemLead')} bold={t('landing.problemBold')} size="lg" />
        <Prose className="mx-auto mt-6">{t('landing.problemBody')}</Prose>
      </div>
    </Section>
  )
}
