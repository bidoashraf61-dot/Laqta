import { redirect } from 'next/navigation'
import { requireCreator } from '@/lib/auth'
import { db } from '@/lib/db'
import { Field } from '@/components/ui/label'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Alert, AlertDescription, EmptyState } from '@/components/ui/state'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { SettingsForm } from '@/components/dashboard/form'
import { StatusBadge } from '@/components/dashboard/status'
import { ReleaseLinker, type LinkableClip } from '@/components/studio/release-linker'
import { ReleaseDocument } from '@/components/studio/release-document'
import { hasDocument, maxDocumentBytes } from '@/lib/uploads'
import { createRelease } from '@/app/(studio)/studio/actions'
import { formatDate, t } from '@/lib/i18n'
import { UserText } from '@/components/ui/bilingual'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('studio.releases'),
  }
}

const TYPE_LABEL: Record<string, string> = {
  model: 'dash.releaseModel',
  property: 'dash.releaseProperty',
  permit: 'dash.releasePermit',
}

/**
 * Releases and permits.
 *
 * The legally load-bearing screen in the studio: an album with an identifiable
 * face and no model release cannot be submitted, and a Saudi shoot without the
 * issuing authority's permit is a takedown waiting to happen. So the list
 * leads with what each release covers, not with when it was uploaded.
 */
export default async function StudioReleasesPage() {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const user = await requireCreator()
  if (!user.creatorId) redirect('/sell')

  const creatorId = user.creatorId

  const [releases, clips] = await Promise.all([
    db.release.findMany({
      where: { creatorId },
      orderBy: [{ verification: 'asc' }, { createdAt: 'desc' }],
      include: {
        clipLinks: { select: { clipId: true } },
      },
    }),
    db.clip.findMany({
      // EVERY clip of this creator (DEV-10). A property release or a location
      // permit covers clips with nobody in them, so filtering to people/faces
      // left those releases with nothing to link to — and since no control
      // set the flags, every creator's list was empty. Clips with clear faces
      // sort first: they are the ones the submission gate blocks.
      where: { album: { creatorId } },
      orderBy: [{ identifiableFaces: 'desc' }, { hasPeople: 'desc' }, { album: { createdAt: 'desc' } }, { orderIndex: 'asc' }],
      take: 500,
      select: {
        id: true,
        titleAr: true,
        identifiableFaces: true,
        hasPeople: true,
        album: { select: { titleAr: true } },
      },
    }),
  ])

  const linkable: LinkableClip[] = clips.map((clip) => ({
    id: clip.id,
    titleAr: clip.titleAr,
    albumTitleAr: clip.album.titleAr,
    identifiableFaces: clip.identifiableFaces,
    hasPeople: clip.hasPeople,
  }))

  return (
    <>
      <DashboardHeader title={t('dash.releasesTitle')} description={t('dash.releasesHint')} />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-3">
          {releases.length === 0 ? (
            <EmptyState title={t('dash.noReleases')} description={t('dash.releasesHint')} />
          ) : (
            releases.map((release) => (
              <section key={release.id} className="rounded-lg border bg-card p-5">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-medium">
                      <UserText>{release.subjectName ?? '—'}</UserText>
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t(TYPE_LABEL[release.type] ?? release.type)}
                      {release.authority ? <UserText> · {release.authority}</UserText> : null}
                    </p>
                  </div>
                  <StatusBadge domain="release" value={release.verification} />
                </div>

                <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
                  {release.referenceNumber ? (
                    <div>
                      <dt className="text-muted-foreground">{t('dash.releaseRef')}</dt>
                      <dd className="ltr-island mt-0.5">{release.referenceNumber}</dd>
                    </div>
                  ) : null}
                  {release.validFrom || release.validTo ? (
                    <div>
                      <dt className="text-muted-foreground">{t('dash.releaseValidity')}</dt>
                      <dd className="mt-0.5">
                        <span className="numeric">
                          {release.validFrom ? formatDate(release.validFrom) : '—'}
                        </span>
                        {' — '}
                        <span className="numeric">
                          {release.validTo ? formatDate(release.validTo) : '—'}
                        </span>
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-muted-foreground">{t('dash.releaseClips')}</dt>
                    <dd className="numeric mt-0.5">{release.clipLinks.length}</dd>
                  </div>
                </dl>

                {release.rejectionReason ? (
                  <Alert variant="destructive" className="mb-3">
                    <AlertDescription>
                      <UserText>{release.rejectionReason}</UserText>
                    </AlertDescription>
                  </Alert>
                ) : null}

                <ReleaseDocument
                  releaseId={release.id}
                  document={
                    hasDocument(release)
                      ? { name: release.fileName ?? '—', sizeBytes: release.fileSizeBytes ?? 0 }
                      : null
                  }
                  locked={release.verification === 'verified'}
                  rejected={release.verification === 'rejected'}
                  maxBytes={maxDocumentBytes()}
                />

                <ReleaseLinker
                  releaseId={release.id}
                  clips={linkable}
                  linked={release.clipLinks.map((link) => link.clipId)}
                />
              </section>
            ))
          )}
        </div>

        <Panel title={t('dash.addRelease')} className="lg:sticky lg:top-20">
          <p className="mb-4 text-sm text-muted-foreground">{t('dash.releaseDocAfterCreate')}</p>

          <SettingsForm action={createRelease} submitLabel={t('dash.addRelease')}>
            <Field label={t('dash.releaseType')} htmlFor="type" required>
              <NativeSelect id="type" name="type" required>
                <option value="model">{t('dash.releaseModel')}</option>
                <option value="property">{t('dash.releaseProperty')}</option>
                <option value="permit">{t('dash.releasePermit')}</option>
              </NativeSelect>
            </Field>

            <Field label={t('dash.releaseSubject')} htmlFor="subjectName" required>
              <Input id="subjectName" name="subjectName" required maxLength={120} />
            </Field>

            <Field label={t('dash.releaseAuthority')} htmlFor="authority">
              <Input id="authority" name="authority" maxLength={120} />
            </Field>

            <Field label={t('dash.releaseRef')} htmlFor="referenceNumber">
              <Input id="referenceNumber" name="referenceNumber" maxLength={64} dir="ltr" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('dash.validFrom')} htmlFor="validFrom">
                <Input id="validFrom" name="validFrom" type="date" dir="ltr" />
              </Field>
              <Field label={t('dash.validTo')} htmlFor="validTo">
                <Input id="validTo" name="validTo" type="date" dir="ltr" />
              </Field>
            </div>

            <Field label={t('dash.releaseNotes')} htmlFor="notes">
              <Textarea id="notes" name="notes" rows={2} maxLength={500} />
            </Field>
          </SettingsForm>
        </Panel>
      </div>
    </>
  )
}
