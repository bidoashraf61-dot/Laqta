import { notFound } from 'next/navigation'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { requireCreator } from '@/lib/auth'
import { db } from '@/lib/db'
import { analyseConsistency, canSubmit } from '@/lib/studio'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/state'
import { Bilingual } from '@/components/ui/bilingual'
import { SubmitButton } from '@/components/studio/submit-button'
import { BackLink } from '@/components/dashboard/primitives'
import { formatDate, formatMoney, t } from '@/lib/i18n'
import { formatDuration } from '@/lib/utils'
import { specLabel } from '@/lib/spec-labels'
import { requestLocale } from '@/lib/locale-request'
import { CHECK_KEYS, normaliseChecklist } from '@/lib/review-checklist'

export default async function StudioAlbumPage({ params }: { params: Promise<{ id: string }> }) {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const { id } = await params
  const user = await requireCreator()

  const album = await db.album.findFirst({
    // Admins can open any album; a creator only their own.
    where: { id, ...(user.role === 'admin' ? {} : { creatorId: user.creatorId ?? '' }) },
    include: {
      clips: { orderBy: { orderIndex: 'asc' } },
      // Every round, newest first: the creator sees the whole conversation
      // with the reviewer, not only the last word.
      reviewTasks: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          decision: true,
          decisionNote: true,
          checklist: true,
          submittedAt: true,
          decidedAt: true,
        },
      },
    },
  })
  if (!album) notFound()

  const consistency = analyseConsistency(album.clips)
  const gate = await canSubmit(album.id)
  const latestReview = album.reviewTasks[0]
  // A rejection leaves the album `delisted`; the review task, not the album
  // status, is what says it was a rejection rather than a later takedown.
  const rejected = album.status === 'delisted' && latestReview?.decision === 'reject'
  // Only the check NAMES reach the creator. A check's own note is the
  // reviewer's working text; what the creator is told is the decision note.
  const failedChecks = latestReview?.decision
    ? CHECK_KEYS.filter((key) => normaliseChecklist(latestReview.checklist)[key].state === 'fail')
    : []
  // Earlier decided rounds; the current one is already stated above.
  const pastRounds = album.reviewTasks.slice(1).filter((task) => task.decision)

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <BackLink href="/studio/albums" label={t('studio.albums')} />
        <h1 className="font-display text-2xl font-bold">
          <Bilingual ar={album.titleAr} en={album.titleEn} />
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="numeric">{album.clipCount}</span> {t('commerce.clip')} ·{' '}
          <span className="numeric">
            {formatMoney(Number(album.priceStandard), album.currency)}
          </span>
        </p>
      </div>

      {/* Where the album stands with review, and why. */}
      {album.status === 'in_review' && latestReview ? (
        <Alert variant="info">
          <AlertTitle>{t('studio.inReview')}</AlertTitle>
          <AlertDescription>
            {t('studio.review.inReviewBody', { date: formatDate(latestReview.submittedAt) })}
          </AlertDescription>
        </Alert>
      ) : null}

      {album.status === 'changes_requested' && latestReview ? (
        <Alert variant="warning">
          <AlertTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4" />
            {t('studio.changesRequested')}
          </AlertTitle>
          <AlertDescription>
            <ReviewReason
              note={latestReview.decisionNote}
              failedChecks={failedChecks}
              after={t('studio.review.changesBody')}
            />
          </AlertDescription>
        </Alert>
      ) : null}

      {rejected && latestReview ? (
        <Alert variant="destructive">
          <AlertTitle className="flex items-center gap-2">
            <XCircle className="size-4" />
            {t('studio.review.rejectedTitle')}
          </AlertTitle>
          <AlertDescription>
            <ReviewReason
              note={latestReview.decisionNote}
              failedChecks={failedChecks}
              after={t('studio.review.rejectedBody')}
            />
          </AlertDescription>
        </Alert>
      ) : null}

      {album.status === 'live' && latestReview?.decision === 'approve' && latestReview.decidedAt ? (
        <Alert variant="success">
          <AlertDescription className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success" />
            {t('studio.review.approvedBody', { date: formatDate(latestReview.decidedAt) })}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Spec consistency — shown before submission, not discovered by a
          reviewer three days later. */}
      <section>
        <h2 className="mb-2 text-xl font-bold">{t('studio.consistencyTitle')}</h2>
        {consistency.hasWarning ? (
          <Alert variant="warning">
            <AlertTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4" />
              {t('studio.consistencyWhy')}
            </AlertTitle>
            <AlertDescription>
              <ul className="mt-2 space-y-1">
                {consistency.mixedFrameRate ? (
                  <li>
                    {t('studio.mixedFrameRate')} —{' '}
                    <span className="numeric">{consistency.frameRates.join(' / ')}</span>
                  </li>
                ) : null}
                {consistency.mixedProfile ? (
                  <li>
                    {t('studio.mixedProfile')} —{' '}
                    <span className="ltr-island">{consistency.profiles.join(' / ')}</span>
                  </li>
                ) : null}
                {consistency.mixedResolution ? (
                  <li>
                    {t('studio.mixedResolution')} —{' '}
                    <span className="numeric">{consistency.resolutions.join(' / ')}</span>
                  </li>
                ) : null}
              </ul>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="success">
            <AlertDescription className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" />
              {t('studio.consistencyOk')}
            </AlertDescription>
          </Alert>
        )}
      </section>

      {album.status === 'draft' || album.status === 'changes_requested' ? (
        <SubmitButton albumId={album.id} canSubmit={gate.ok} reasons={gate.reasons} />
      ) : (
        <Badge variant={rejected ? 'destructive' : 'neutral'}>
          {rejected
            ? t('studio.notAccepted')
            : t(`studio.${album.status === 'in_review' ? 'inReview' : album.status}`)}
        </Badge>
      )}

      {/* Earlier rounds only — the current round is stated in the panel above,
          so the log appears once there is a history to read. */}
      {pastRounds.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xl font-bold">{t('studio.review.history')}</h2>
          <ol className="divide-y rounded-lg border">
            {pastRounds.map((task) => (
              <li key={task.id} className="space-y-1 p-3 text-sm">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">
                    {t(`studio.review.decision.${task.decision}`)}
                  </span>
                  <span className="text-muted-foreground">
                    {t('studio.review.submittedOn', { date: formatDate(task.submittedAt) })}
                  </span>
                  {task.decidedAt ? (
                    <span className="text-muted-foreground">
                      {t('studio.review.decidedOn', { date: formatDate(task.decidedAt) })}
                    </span>
                  ) : null}
                </p>
                {task.decisionNote ? (
                  <p className="whitespace-pre-line text-foreground/80">{task.decisionNote}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-xl font-bold">{t('studio.clips')}</h2>
        <ul className="divide-y rounded-lg border">
          {album.clips.map((clip) => (
            <li key={clip.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <Bilingual ar={clip.titleAr} en={clip.titleEn} />
              </span>
              <span className="numeric text-muted-foreground">
                {clip.width}×{clip.height}
              </span>
              <span className="numeric text-muted-foreground">{Number(clip.fps)}</span>
              {clip.colourProfile ? (
                <span className="ltr-island text-muted-foreground">{clip.colourProfile}</span>
              ) : null}
              <span className="text-muted-foreground">
                {specLabel('movement', clip.cameraMovement) ?? '—'}
              </span>
              <span className="numeric text-muted-foreground">
                {formatDuration(Number(clip.durationS))}
              </span>
              {clip.identifiableFaces ? (
                <Badge variant="warning">{t('catalogue.identifiableFaces')}</Badge>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/** The reviewer's note, the checks that failed, and what to do next. */
function ReviewReason({
  note,
  failedChecks,
  after,
}: {
  note: string | null
  failedChecks: readonly string[]
  after: string
}) {
  return (
    <div className="mt-2 space-y-3">
      {note ? (
        <div>
          <p className="text-sm font-medium">{t('studio.review.reviewerNote')}</p>
          <p className="mt-1 whitespace-pre-line">{note}</p>
        </div>
      ) : null}
      {failedChecks.length > 0 ? (
        <div>
          <p className="text-sm font-medium">{t('studio.review.failedChecks')}</p>
          <ul className="mt-1 list-disc space-y-0.5 ps-5">
            {failedChecks.map((key) => (
              <li key={key}>{t(`studio.review.check.${key}`)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-muted-foreground">{after}</p>
    </div>
  )
}
