import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { requireCreator } from '@/lib/auth'
import { db } from '@/lib/db'
import { analyseConsistency, canSubmit } from '@/lib/studio'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/state'
import { Bilingual } from '@/components/ui/bilingual'
import { SubmitButton } from '@/components/studio/submit-button'
import { formatMoney, t } from '@/lib/i18n'
import { formatDuration } from '@/lib/utils'
import { specLabel } from '@/lib/spec-labels'

export default async function StudioAlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireCreator()

  const album = await db.album.findFirst({
    // Admins can open any album; a creator only their own.
    where: { id, ...(user.role === 'admin' ? {} : { creatorId: user.creatorId ?? '' }) },
    include: {
      clips: { orderBy: { orderIndex: 'asc' } },
      reviewTasks: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
  if (!album) notFound()

  const consistency = analyseConsistency(album.clips)
  const gate = await canSubmit(album.id)
  const latestReview = album.reviewTasks[0]

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/studio" className="text-sm text-muted-foreground hover:text-gold">
          ← {t('studio.title')}
        </Link>
        <h1 className="text-headline font-semibold">
          <Bilingual ar={album.titleAr} en={album.titleEn} />
        </h1>
        <p className="text-sm text-muted-foreground">
          <span className="numeric">{album.clipCount}</span> {t('studio.clips')} ·{' '}
          <span className="numeric">
            {formatMoney(Number(album.priceStandard), album.currency)}
          </span>
        </p>
      </header>

      {/* Reviewer feedback, if the album came back. */}
      {album.status === 'changes_requested' && latestReview?.decisionNote ? (
        <Alert variant="warning">
          <AlertTitle>{t('studio.changesRequested')}</AlertTitle>
          <AlertDescription>{latestReview.decisionNote}</AlertDescription>
        </Alert>
      ) : null}

      {/* Spec consistency — shown before submission, not discovered by a
          reviewer three days later. */}
      <section>
        <h2 className="mb-2 text-lg font-semibold">{t('studio.consistencyTitle')}</h2>
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
        <Badge variant="neutral">{t(`studio.${album.status === 'in_review' ? 'inReview' : album.status}`)}</Badge>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('studio.clips')}</h2>
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
