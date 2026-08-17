import { PreviewWatermark } from '@/components/catalogue/watermark'
import { Headline, Prose, Section } from '@/components/ui/typography'
import { t } from '@/lib/i18n'

/**
 * ⚠️ PLACEHOLDER — to be replaced.
 *
 * A still from the hero reel, standing in until the real still for this
 * section is produced. It is a deliberate placeholder rather than an empty
 * box: a grey rectangle labelled "image goes here" reads as an unfinished
 * page in a review, while a real frame reads as the layout it will be.
 *
 * Drop the replacement at `public/landing/problem-solution.jpg` (16:9,
 * ≥1920px wide) and point this constant at it. Nothing else changes.
 */
const STILL_SRC = '/hero/06-alula.jpg'

/**
 * The problem, then the shortcut.
 *
 * Right after the hero: name the pain (producing Saudi content is slow and
 * expensive) and answer it in one breath — ready-made, culturally-accurate
 * cinematic albums. Editorial and centred; it earns the catalogue that follows.
 *
 * The still under the copy is doing work, not filling space. This section makes
 * a claim about the quality of the footage immediately after the hero has
 * stopped moving, and a claim about pictures is better answered with one.
 */
export function ProblemSolution() {
  return (
    <Section tone="offwhite">
      <div className="mx-auto max-w-3xl text-center">
        <Headline lead={t('landing.problemLead')} bold={t('landing.problemBold')} size="lg" />
        <Prose className="mx-auto mt-6">{t('landing.problemBody')}</Prose>
      </div>

      {/*
        16:9, because that is the shape the footage is delivered in — the frame
        is a sample of the product, not a decorative band. Watermarked like
        every other moving or still frame on the site; see watermark.tsx.
      */}
      <figure className="relative mx-auto mt-12 aspect-video max-w-4xl overflow-hidden rounded-lg border bg-ink shadow-soft">
        <img
          src={STILL_SRC}
          alt={t('landing.problemStillAlt')}
          loading="lazy"
          className="size-full object-cover"
        />
        <PreviewWatermark />
      </figure>
    </Section>
  )
}
