import { notFound } from 'next/navigation'
import { AlertTriangle, FileText } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { findDuplicates } from '@/lib/admin'
import { analyseConsistency } from '@/lib/studio'
import { normaliseChecklist } from '@/lib/review-checklist'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/state'
import { Bilingual, UserText } from '@/components/ui/bilingual'
import { ReviewChecklist } from '@/components/admin/review-checklist'
import { ReleaseDecision } from '@/components/admin/release-decision'
import { StatusBadge } from '@/components/dashboard/status'
import { BackLink } from '@/components/dashboard/primitives'
import { countOf, formatMoney, t } from '@/lib/i18n'
import { formatDuration } from '@/lib/utils'
import { requestLocale } from '@/lib/locale-request'
import { pickLocalised } from '@/lib/locale'
import { mediaUrl } from '@/lib/media'
import { hasDocument } from '@/lib/uploads'
import { bandForCount } from '@/lib/price-bands'
import { loadPricingConfig } from '@/lib/pricing-config'
import { loadAlbumDetails } from '@/lib/album-details'
import { AlbumDetailsForm } from '@/components/studio/album-details-form'
import { adminSaveAlbumDetails } from '@/app/(admin)/admin/actions'

const RELEASE_TYPE: Record<string, string> = {
  model: 'dash.releaseModel',
  property: 'dash.releaseProperty',
  permit: 'dash.releasePermit',
}

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
                      id: true,
                      type: true,
                      subjectName: true,
                      rejectionReason: true,
                      fileKey: true,
                      fileName: true,
                      fileUploadedAt: true,
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

  // The price field's starting value: the album's own price if it has one
  // (a re-review), else the band for its clip count (DEV-09). Only a guide.
  const bands = await db.priceBand.findMany({
    select: { labelAr: true, labelEn: true, minClips: true, maxClips: true, priceStandard: true },
  })
  const band = bandForCount(task.album.clipCount, bands)
  const details = await loadAlbumDetails(task.album.id)
  const pricing = await loadPricingConfig()
  // The creator's recommendation comes first (owner, 2026-09-27); the band is
  // the fallback for albums saved before the calculator existed.
  const recommended = task.album.recommendedPrice === null ? null : Number(task.album.recommendedPrice)
  const suggestedPrice =
    Number(task.album.priceStandard) > 0
      ? Number(task.album.priceStandard)
      : (recommended ?? (band ? Number(band.priceStandard) : null))

  const duplicates = await findDuplicates(task.albumId)
  const consistency = analyseConsistency(task.album.clips)
  const checklist = normaliseChecklist(task.checklist)

  const releases = task.album.clips.flatMap((clip) => clip.releaseLinks.map((link) => link.release))
  // One row per release. Keyed by id: two permits with no reference number
  // are two documents, and keying by type+reference merged them.
  const uniqueReleases = [...new Map(releases.map((r) => [r.id, r])).values()]

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
          {countOf('clip', task.album.clipCount)}
          {Number(task.album.priceStandard) > 0 ? (
            <>
              {' · '}
              <span className="numeric">
                {formatMoney(Number(task.album.priceStandard), task.album.currency)}
              </span>
            </>
          ) : null}
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
              <li key={release.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="flex-1">
                  {t(RELEASE_TYPE[release.type] ?? release.type)}
                  {release.subjectName ? (
                    <span className="text-muted-foreground"> — <UserText>{release.subjectName}</UserText></span>
                  ) : null}
                </span>
                {release.authority ? (
                  <span className="ltr-island text-muted-foreground">{release.authority}</span>
                ) : null}
                {release.referenceNumber ? (
                  <span className="numeric text-muted-foreground">{release.referenceNumber}</span>
                ) : null}
                {/* The scan opens through the authenticated route, which answers
                    with a URL that lives a minute — never a public key. A plain
                    anchor in a new tab: it is a document, not a navigation. */}
                {hasDocument(release) ? (
                  <a
                    href={`/api/studio/releases/${release.id}/document`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
                  >
                    <FileText className="size-4 text-muted-foreground" aria-hidden />
                    {t('admin.releaseDocument')}
                    {release.fileName ? (
                      <span className="ltr-island max-w-40 truncate text-xs text-muted-foreground">
                        {release.fileName}
                      </span>
                    ) : null}
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">{t('admin.releaseNoDocument')}</span>
                )}
                <StatusBadge domain="release" value={release.verification} />
                <ReleaseDecision
                  releaseId={release.id}
                  verification={release.verification}
                  hasScan={hasDocument(release)}
                />
                {release.verification === 'rejected' && release.rejectionReason ? (
                  <p className="w-full text-xs text-destructive">
                    {t('admin.releaseRejectedBecause')} <UserText>{release.rejectionReason}</UserText>
                  </p>
                ) : null}
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

      {/* The creator's details (DEV-08), correctable here — a wrong category is
          fixed by the reviewer, not bounced back as a change request. */}
      {details ? (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">{t('studio.details.title')}</h2>
          <div className="rounded-lg border p-5">
            <AlbumDetailsForm view={details} action={adminSaveAlbumDetails.bind(null, task.album.id)} />
          </div>
        </section>
      ) : null}

      <ReviewChecklist
        taskId={task.id}
        initial={checklist}
        price={{
          suggested: suggestedPrice,
          min: pricing.priceMin,
          max: pricing.priceMax,
          bandLabel: band ? pickLocalised(band.labelAr, band.labelEn) : null,
          recommended,
          recommendedNote: task.album.recommendedNote,
        }}
      />
    </div>
  )
}
