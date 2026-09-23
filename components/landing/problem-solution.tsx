import { PreviewWatermark } from '@/components/catalogue/watermark'
import { Headline, Prose, Section } from '@/components/ui/typography'
import { t } from '@/lib/i18n'

/**
 * ⚠️ PLACEHOLDER MEDIA — to be replaced.
 *
 * A still from the hero reel, standing in for the real asset: a screen capture
 * of an album's cuts being laid onto a Premiere Pro timeline. The section's
 * argument is "these clips cut together", and that is a claim best answered by
 * watching them do it.
 *
 * To replace it, drop the file in `public/landing/` and change `MEDIA.src`.
 * The slot renders a video for `.mp4` / `.webm` and an image for anything else,
 * so a `.gif` works too — but prefer a short muted MP4 loop: a timeline capture
 * as a GIF runs to tens of megabytes and loses the colour a grade depends on,
 * where the same loop as H.264 is typically a tenth of the size and sharper.
 */
const MEDIA = { src: '/hero/06-alula.jpg' }

const isVideo = (src: string) => /\.(mp4|webm)$/i.test(src)

/**
 * The problem, then the shortcut — as a split.
 *
 * Media on the inline-START side, copy on the inline-END side: in Arabic that
 * puts the picture on the right, where the eye enters the row, and the argument
 * on the left. In English the same logical layout mirrors to picture-left,
 * copy-right, as it should.
 *
 * On a phone the two stack with the COPY first. Reading a headline before an
 * illustration of it is the right order at a glance, and a timeline capture is
 * the illustration, not the claim.
 */
export function ProblemSolution() {
  return (
    <Section tone="base">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14 lg:gap-20">
        <div className="text-start">
          <Headline lead={t('landing.problemLead')} bold={t('landing.problemBold')} size="lg" />
          <Prose className="mt-6">{t('landing.problemBody')}</Prose>
        </div>

        {/*
          16:9, because that is the shape both the footage and a timeline
          capture arrive in — the frame is a sample of the product, not a
          decorative band. Watermarked like every other frame on the site.
          `md:order-first` moves it to the start column on wider screens while
          the DOM keeps the copy first for the stacked phone layout.
        */}
        <figure className="relative aspect-video overflow-hidden rounded-lg border bg-ink shadow-soft md:order-first">
          {isVideo(MEDIA.src) ? (
            <video
              src={MEDIA.src}
              className="size-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label={t('landing.problemStillAlt')}
            />
          ) : (
            <img
              src={MEDIA.src}
              alt={t('landing.problemStillAlt')}
              loading="lazy"
              className="size-full object-cover"
            />
          )}
          <PreviewWatermark />
        </figure>
      </div>
    </Section>
  )
}
