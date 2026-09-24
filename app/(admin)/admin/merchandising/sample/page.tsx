import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { Bilingual } from '@/components/ui/bilingual'
import { Field } from '@/components/ui/label'
import { Input, Textarea } from '@/components/ui/input'
import { BackLink, DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { ActionButton, SettingsForm } from '@/components/dashboard/form'
import { formatNumber, t } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'
import { getSampleForAdmin } from '@/lib/sample'
import { cn } from '@/lib/utils'
import {
  addSampleClip,
  moveSampleClip,
  removeSampleClip,
  saveSampleDetails,
  setSampleCover,
  setSamplePublished,
} from './actions'

export async function generateMetadata(): Promise<Metadata> {
  await requestLocale()
  return { title: t('dash.sampleTitle') }
}

/**
 * Curation of the free sample album.
 *
 * The owner decides later which clips go in, so every state here — no sample
 * row yet, no clips, unpublished — is ordinary. Album choice is a plain <a>
 * (search params only; CLAUDE.md: load-bearing same-pathname navigation).
 */
export default async function AdminSamplePage({
  searchParams,
}: {
  searchParams: Promise<{ album?: string }>
}) {
  await requestLocale()
  await requireAdmin()
  const { album: pickedAlbumId } = await searchParams

  const [sample, albums] = await Promise.all([
    getSampleForAdmin(),
    db.album.findMany({
      where: { status: 'live' },
      orderBy: { titleAr: 'asc' },
      select: { id: true, titleAr: true, titleEn: true, clipCount: true },
    }),
  ])

  const chosenIds = new Set(sample?.clips.map((row) => row.clip.id) ?? [])
  const claims = sample
    ? await db.entitlement.count({ where: { albumId: sample.album.id } })
    : 0

  const picked = pickedAlbumId ? albums.find((album) => album.id === pickedAlbumId) : undefined
  const pickedClips = picked
    ? await db.clip.findMany({
        where: { albumId: picked.id },
        orderBy: { orderIndex: 'asc' },
        select: { id: true, titleAr: true, titleEn: true, width: true, height: true },
      })
    : []

  const published = sample?.isPublished ?? false
  const offered = sample?.clips.filter((row) => row.clip.album.status === 'live').length ?? 0

  return (
    <>
      <BackLink href="/admin/merchandising" label={t('dash.merchandising')} />
      <DashboardHeader title={t('dash.sampleTitle')} description={t('dash.sampleHint')} />

      <div className="space-y-6">
        <Panel
          title={t('dash.sampleStatus')}
          action={
            <ActionButton
              action={setSamplePublished.bind(null, !published)}
              label={published ? t('dash.sampleUnpublish') : t('dash.samplePublish')}
              variant={published ? 'outline' : 'default'}
            />
          }
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Badge variant={published ? 'success' : 'neutral'}>
              {published ? t('dash.samplePublished') : t('dash.sampleDraft')}
            </Badge>
            <span>
              {t('dash.sampleChosen')}: <span className="numeric">{formatNumber(offered)}</span>
            </span>
            <span>
              {t('dash.sampleClaims')}: <span className="numeric">{formatNumber(claims)}</span>
            </span>
            {offered > 0 ? (
              <a href="/sample" className="underline underline-offset-4 hover:text-gold">
                {t('dash.sampleOpenPublic')}
              </a>
            ) : null}
          </div>
        </Panel>

        <Panel title={t('dash.sampleDetails')}>
          <SettingsForm action={saveSampleDetails}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`${t('dash.sampleTitleField')} — ${t('dash.termAr')}`} htmlFor="s-titleAr">
                <Input id="s-titleAr" name="titleAr" defaultValue={sample?.album.titleAr ?? ''} />
              </Field>
              <Field label={`${t('dash.sampleTitleField')} — ${t('dash.termEn')}`} htmlFor="s-titleEn">
                <Input id="s-titleEn" name="titleEn" dir="ltr" defaultValue={sample?.album.titleEn ?? ''} />
              </Field>
              <Field label={t('dash.albumDescAr')} htmlFor="s-descAr">
                <Textarea id="s-descAr" name="descriptionAr" defaultValue={sample?.album.descriptionAr ?? ''} />
              </Field>
              <Field label={t('dash.albumDescEn')} htmlFor="s-descEn">
                <Textarea
                  id="s-descEn"
                  name="descriptionEn"
                  dir="ltr"
                  defaultValue={sample?.album.descriptionEn ?? ''}
                />
              </Field>
            </div>
          </SettingsForm>
        </Panel>

        <Panel title={`${t('dash.sampleChosen')} (${formatNumber(sample?.clips.length ?? 0)})`}>
          {!sample || sample.clips.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dash.sampleEmpty')}</p>
          ) : (
            <ol className="divide-y">
              {sample.clips.map((row, index) => {
                const live = row.clip.album.status === 'live'
                const isCover = sample.album.coverClipId === row.clip.id
                return (
                  <li key={row.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                    <span className="numeric w-6 text-muted-foreground">{formatNumber(index + 1)}</span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('font-medium', !live && 'text-muted-foreground line-through')}>
                        <Bilingual ar={row.clip.titleAr} en={row.clip.titleEn} />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <Bilingual ar={row.clip.album.titleAr} en={row.clip.album.titleEn} />
                      </p>
                    </div>
                    {!live ? <Badge variant="warning">{t('dash.sampleNotLive')}</Badge> : null}
                    {isCover ? <Badge variant="neutral">{t('dash.sampleIsCover')}</Badge> : null}
                    <div className="flex flex-wrap gap-2">
                      <ActionButton
                        action={moveSampleClip.bind(null, row.clip.id, 'up')}
                        label={t('dash.sampleUp')}
                        variant="ghost"
                      />
                      <ActionButton
                        action={moveSampleClip.bind(null, row.clip.id, 'down')}
                        label={t('dash.sampleDown')}
                        variant="ghost"
                      />
                      {!isCover && live ? (
                        <ActionButton
                          action={setSampleCover.bind(null, row.clip.id)}
                          label={t('dash.sampleMakeCover')}
                          variant="ghost"
                        />
                      ) : null}
                      <ActionButton
                        action={removeSampleClip.bind(null, row.clip.id)}
                        label={t('dash.sampleRemove')}
                      />
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </Panel>

        <Panel title={t('dash.sampleAdd')}>
          <p className="mb-3 text-sm text-muted-foreground">{t('dash.samplePickAlbum')}</p>
          <div className="flex flex-wrap gap-2">
            {albums.map((album) => {
              const current = album.id === picked?.id
              return (
                <a
                  key={album.id}
                  href={`/admin/merchandising/sample?album=${album.id}`}
                  aria-current={current ? 'true' : undefined}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm transition-colors',
                    current ? 'border-foreground bg-foreground text-background' : 'hover:border-foreground/40',
                  )}
                >
                  <Bilingual ar={album.titleAr} en={album.titleEn} />{' '}
                  <span className="numeric text-xs opacity-70">{formatNumber(album.clipCount)}</span>
                </a>
              )
            })}
          </div>

          {picked ? (
            <ul className="mt-5 divide-y rounded-lg border">
              {pickedClips.map((clip) => {
                const added = chosenIds.has(clip.id)
                return (
                  <li key={clip.id} className="flex items-center gap-3 p-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      <Bilingual ar={clip.titleAr} en={clip.titleEn} />
                    </span>
                    <span className="numeric text-muted-foreground">
                      {clip.width}×{clip.height}
                    </span>
                    {added ? (
                      <Badge variant="success">{t('dash.sampleAdded')}</Badge>
                    ) : (
                      <ActionButton action={addSampleClip.bind(null, clip.id)} label={t('dash.sampleAddClip')} />
                    )}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </Panel>
      </div>
    </>
  )
}
