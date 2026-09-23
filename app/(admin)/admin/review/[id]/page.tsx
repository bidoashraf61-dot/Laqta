import { notFound } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { findDuplicates } from '@/lib/admin'
import { analyseConsistency } from '@/lib/studio'
import { normaliseChecklist } from '@/lib/review-checklist'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/state'
import { Bilingual, UserText } from '@/components/ui/bilingual'
import { ReviewChecklist } from '@/components/admin/review-checklist'
import { BackLink } from '@/components/dashboard/primitives'
import { formatMoney, t } from '@/lib/i18n'
import { formatDuration } from '@/lib/utils'
import { requestLocale } from '@/lib/locale-request'
import { mediaUrl } from '@/lib/media'

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
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
  await requireAdmin()

  const task = await db.reviewTask.findUnique({
    where: { id },
    include: {
      album: {
        include: {
          creator: { select: { handle: true, displayNameAr: true, country: true, status: true } },
          clips: {
            orderBy: { orderIndex: 'asc' },
            include: {
              releaseLinks: {
                include: {
                  release: {
                    select: {
                      type: true,
                      authority: true,
                      referenceNumber: true,
                      verification: true,
                      validTo: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!task) notFound()

  const duplicates = await findDuplicates(task.albumId)
  const consistency = analyseConsistency(task.album.clips)
  const checklist = normaliseChecklist(task.checklist)

  const releases = task.album.clips.flatMap((clip) => clip.releaseLinks.map((link) => link.release))
  const uniqueReleases = [
    ...new Map(releases.map((r) => [`${r.type}-${r.referenceNumber}`, r])).values(),
  ]

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <BackLink href="/admin/review" label={t('admin.reviewQueue')} />
        <h1 className="font-display text-2xl font-bold">
          <Bilingual ar={task.album.titleAr} en={task.album.titleEn} />
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <UserText>
            {t('commerce.byCreator', { creator: task.album.creator.displayNameAr })}
          </UserText>{' '}
          · <span className="ltr-island">{task.album.creator.country}</span> ·{' '}
          <span className="numeric">{task.album.clipCount}</span> {t('commerce.clip')} ·{' '}
          <span className="numeric">
            {formatMoney(Number(task.album.priceStandard), task.album.currency)}
          </span>
        </p>
      </div>

      {/* Automated reports the reviewer should see before deciding anything. */}
      {duplicates.length > 0 ? (
        <Alert variant="warning">
          <AlertTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4" />
            {t('admin.duplicates')}
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 text-sm">
              {duplicates.map((row) => (
                <li key={row.clip.id}>
                  {row.clip.titleAr} →{' '}
                  {row.matches
                    .map((match) => `${match.album.titleAr} (@${match.album.creator.handle})`)
                    .join('، ')}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {consistency.hasWarning ? (
        <Alert variant="warning">
          <AlertTitle>{t('studio.consistencyTitle')}</AlertTitle>
          <AlertDescription>
            {consistency.mixedFrameRate ? <p>{t('studio.mixedFrameRate')}</p> : null}
            {consistency.mixedProfile ? <p>{t('studio.mixedProfile')}</p> : null}
            {consistency.mixedResolution ? <p>{t('studio.mixedResolution')}</p> : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <section>
        <h2 className="mb-3 text-xl font-bold">{t('catalogue.clearance')}</h2>
        {uniqueReleases.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('state.empty')}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {uniqueReleases.map((release) => (
              <li
                key={`${release.type}-${release.referenceNumber}`}
                className="flex flex-wrap items-center gap-3 p-3 text-sm"
              >
                <span className="flex-1">{release.type}</span>
                {release.authority ? (
                  <span className="ltr-island text-muted-foreground">{release.authority}</span>
                ) : null}
                {release.referenceNumber ? (
                  <span className="numeric text-muted-foreground">{release.referenceNumber}</span>
                ) : null}
                <Badge variant={release.verification === 'verified' ? 'success' : 'warning'}>
                  {release.verification}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">{t('studio.clips')}</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {task.album.clips.map((clip) => (
            <div key={clip.id} className="overflow-hidden rounded-md border bg-card">
              <div className="relative aspect-video bg-muted">
                {mediaUrl(clip.thumbnailKeys[0]) ? (
                  <img
                    src={mediaUrl(clip.thumbnailKeys[0]) ?? undefined}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : null}
                <Badge
                  variant="neutral"
                  className="numeric absolute bottom-1.5 end-1.5 bg-ink/80 backdrop-blur"
                >
                  {formatDuration(Number(clip.durationS))}
                </Badge>
              </div>
              <p className="line-clamp-1 p-2 text-xs">{clip.titleAr}</p>
              {clip.identifiableFaces ? (
                <p className="px-2 pb-2">
                  <Badge variant="warning">{t('catalogue.identifiableFaces')}</Badge>
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <ReviewChecklist taskId={task.id} initial={checklist} />
    </div>
  )
}
