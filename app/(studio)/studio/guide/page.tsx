import { Fragment, type ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { Check, Download } from 'lucide-react'
import type { Metadata } from 'next'
import { requireCreator } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'
import { DashboardHeader } from '@/components/dashboard/primitives'
import { buttonVariants } from '@/components/ui/button'
import { creatorGuide, type GuideSection } from '@/content/creator-guide'
import { MAX_ALBUM_CLIPS, MIN_ALBUM_CLIPS, MIN_PAYOUT_USD, REVIEW_SLA_BUSINESS_DAYS } from '@/lib/studio'
import { maxClipBytes } from '@/lib/uploads'

export async function generateMetadata(): Promise<Metadata> {
  await requestLocale()
  return { title: t('studio.guide') }
}

/** Text between backticks is a Latin run: isolate it inside Arabic. */
function Inline({ text }: { text: string }) {
  const parts = text.split('`')
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="ltr-island rounded bg-muted px-1 font-mono text-[0.85em]">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}

/**
 * The creator guide (DEV-13): the delivery brief, inside the studio.
 *
 * A reading surface, not a dashboard: one column at a readable measure, a
 * contents rail on wide screens, and nothing to operate except the quality-log
 * download. Linked from the sidebar and from the upload area of every album,
 * because that is where the question "what do you need from me?" is asked.
 *
 * Every limit it quotes is read from the code that enforces it.
 */
export default async function StudioGuidePage() {
  const locale = await requestLocale()
  const user = await requireCreator()
  if (!user.creatorId) redirect('/sell')

  const sections = creatorGuide(locale, {
    minClips: MIN_ALBUM_CLIPS,
    maxClips: MAX_ALBUM_CLIPS,
    maxGb: Math.floor(maxClipBytes() / 1024 ** 3),
    minPayout: MIN_PAYOUT_USD,
    holdDays: Number(process.env.PAYOUT_HOLD_DAYS ?? 30),
    reviewDays: REVIEW_SLA_BUSINESS_DAYS,
  })

  return (
    <div>
      <DashboardHeader
        title={t('studio.guide')}
        description={t('studio.guideDescription')}
        action={
          <a href="/creators/qa-log-template.csv" download className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Download aria-hidden className="size-4" />
            {t('studio.guideQaTemplate')}
          </a>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label={t('studio.guideContents')} className="hidden lg:block">
          <ol className="sticky top-6 space-y-1 border-s ps-4 text-sm">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="-my-0.5 block py-1 text-muted-foreground transition-colors duration-hover ease-lens hover:text-foreground"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="min-w-0 max-w-[68ch] space-y-12" data-page="studio-guide">
          {sections.map((section) => (
            <GuideBlock key={section.id} section={section} />
          ))}
        </article>
      </div>
    </div>
  )
}

function GuideBlock({ section }: { section: GuideSection }) {
  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24 space-y-4">
      <h2 id={`${section.id}-title`} className="font-display text-xl font-medium">
        {section.title}
      </h2>
      {section.intro ? (
        <p className="leading-relaxed text-muted-foreground">
          <Inline text={section.intro} />
        </p>
      ) : null}

      {section.checklist ? (
        <ul className="space-y-3">
          {section.checklist.map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden className="mt-1 grid size-5 shrink-0 place-items-center rounded-full border border-border">
                <Check className="size-3 text-muted-foreground" />
              </span>
              <span className="leading-relaxed">
                <Inline text={item} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {section.rows ? (
        <dl className="divide-y rounded-lg border">
          {section.rows.map(([label, value]) => (
            <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm font-medium">
                <Inline text={label} />
              </dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">
                <Inline text={value} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {section.list ? (
        <ul className="list-disc space-y-2 ps-5 marker:text-muted-foreground">
          {section.list.map((item) => (
            <li key={item} className="leading-relaxed">
              <Inline text={item} />
            </li>
          ))}
        </ul>
      ) : null}

      {section.steps ? (
        <ol className="space-y-3">
          {section.steps.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span aria-hidden className="numeric mt-0.5 w-5 shrink-0 text-sm font-medium text-muted-foreground">
                {i + 1}
              </span>
              <span className="leading-relaxed">
                <Inline text={step} />
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {section.code ? (
        <pre dir="ltr" className="overflow-x-auto rounded-lg border bg-muted/50 p-4 text-start text-sm">
          <code>{section.code}</code>
        </pre>
      ) : null}
      {section.note ? <Note>{section.note}</Note> : null}
    </section>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}
