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
import { countOf, formatDate, formatMoney, t } from '@/lib/i18n'
import { formatDuration } from '@/lib/utils'
import { specLabel } from '@/lib/spec-labels'
import { requestLocale } from '@/lib/locale-request'
import { CHECK_KEYS, normaliseChecklist } from '@/lib/review-checklist'
import { mediaUrl } from '@/lib/media'
import { storageDriver } from '@/lib/storage'
import { EDITABLE_STATUSES, maxClipBytes } from '@/lib/uploads'
import { loadAlbumDetails } from '@/lib/album-details'
import { AlbumDetailsForm } from '@/components/studio/album-details-form'
import { saveAlbumDetailsAction } from '@/app/(studio)/studio/actions'
import { ingestSoon } from '@/lib/ingest'
import { AlbumClips, type StudioClip } from '@/components/studio/album-clips'

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
          proposedPrice: true,
          checklist: true,
          submittedAt: true,
          decidedAt: true,
        },
      },
    },
  })
  if (!album) notFound()

  // Only ready clips have specs; an upload in flight is 0×0 at 0 fps and
  // would read as a "mixed resolution" warning that is not true.
  const readyClips = album.clips.filter((clip) => clip.ingestStatus === 'ready')
  const consistency = analyseConsistency(readyClips)
  const editable = (EDITABLE_STATUSES as readonly string[]).includes(album.status)
  // A clip left `uploaded` (the server restarted between upload and encode)
  // is picked up again the next time its album is looked at.
  if (album.clips.some((clip) => clip.ingestStatus === 'uploaded')) ingestSoon()

  const studioClips: StudioClip[] = album.clips.map((clip) => ({
    id: clip.id,
    titleAr: clip.titleAr,
    titleEn: clip.titleEn,
    status: clip.ingestStatus,
    error: clip.ingestError,
    width: clip.width,
    height: clip.height,
    fps: Number(clip.fps),
    codec: clip.codec,
    colourProfile: clip.colourProfile,
    duration: formatDuration(Number(clip.durationS)),
    sizeBytes: clip.sizeBytes === null ? null : Number(clip.sizeBytes),
    posterUrl: mediaUrl(clip.thumbnailKeys[0]),
    originalFilename: clip.originalFilename,
    identifiableFaces: clip.identifiableFaces,
    hasPeople: clip.hasPeople,
    movement: specLabel('movement', clip.cameraMovement) ?? null,
  }))
  const gate = await canSubmit(album.id)
  const details = await loadAlbumDetails(album.id)
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
          {countOf('clip', album.clipCount)} ·{' '}
          {/* Unpriced (0) until Laqta approves it — DEV-09. */}
          {Number(album.priceStandard) > 0 ? (
            <span className="numeric">
              {formatMoney(Number(album.priceStandard), album.currency)}
            </span>
          ) : (
            t('dash.priceAtApproval')
          )}
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
            {/* The owner's counter-price travels with the feedback (DEV-09b). */}
            {latestReview.proposedPrice !== null ? (
              <p className="mt-3 text-sm">
                {t('studio.review.proposedPrice')}{' '}
                <span className="numeric font-bold">
                  {formatMoney(Number(latestReview.proposedPrice), 'USD')}
                </span>{' '}
                <a href="#details" className="underline underline-offset-4">
                  {t('studio.review.proposedPriceAction')}
                </a>
              </p>
            ) : null}
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

      {/* Album details (DEV-08) — what the filters, the seasonal shelves and the
          reviewer read. Required before submission; frozen once submitted. */}
      {details ? (
        <section id="details" className="scroll-mt-24">
          <h2 className="mb-3 text-xl font-bold">{t('studio.details.title')}</h2>
          <div className="rounded-lg border p-5">
            <AlbumDetailsForm
              view={details}
              action={saveAlbumDetailsAction.bind(null, album.id)}
              readOnly={!editable}
            />
          </div>
        </section>
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

      <AlbumClips
        albumId={album.id}
        editable={editable}
        devDriver={storageDriver() === 'local'}
        maxBytes={maxClipBytes()}
        coverClipId={album.coverClipId}
        clips={studioClips}
      />
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
