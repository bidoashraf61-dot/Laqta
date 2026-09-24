'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, ImageIcon, MoreHorizontal, Pencil, Trash2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState, Spinner } from '@/components/ui/state'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/toast'
import { useT } from '@/lib/i18n-client'
import { cn } from '@/lib/utils'
import { deleteClip, moveClip, setAlbumCover, updateClipTitles } from '@/app/(studio)/studio/actions'
import { UploadError, cancelUpload, formatBytes, uploadMaster, type UploadProgress } from './upload-engine'

export type StudioClip = {
  id: string
  titleAr: string
  titleEn: string
  status: 'uploading' | 'uploaded' | 'probing' | 'transcoding' | 'ready' | 'failed'
  error: string | null
  width: number
  height: number
  fps: number
  codec: string | null
  colourProfile: string | null
  duration: string
  sizeBytes: number | null
  posterUrl: string | null
  originalFilename: string | null
  identifiableFaces: boolean
  movement: string | null
}

type Local = {
  key: string
  file: File
  clipId: string | null
  progress: UploadProgress
  error: string | null
  controller: AbortController
}

const ACCEPT = '.mov,.mp4,video/quicktime,video/mp4'
const PARALLEL_FILES = 2
const WORKING: StudioClip['status'][] = ['uploaded', 'probing', 'transcoding']

/**
 * An album's clips: the upload zone, and the list with its per-clip state,
 * order, titles, cover and delete.
 *
 * One list, not two. A clip exists as a row from the moment its upload
 * starts, so a reload mid-upload leaves an honest «توقف الرفع» row with a
 * resume control rather than a clip that silently vanished. Live progress for
 * the uploads THIS tab is running is overlaid on those rows by clip id.
 */
export function AlbumClips({
  albumId,
  editable,
  devDriver,
  maxBytes,
  coverClipId,
  clips,
}: {
  albumId: string
  editable: boolean
  devDriver: boolean
  maxBytes: number
  coverClipId: string | null
  clips: StudioClip[]
}) {
  const t = useT()
  const router = useRouter()
  const [locals, setLocals] = useState<Local[]>([])
  const [dragging, setDragging] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const running = useRef(0)
  const queue = useRef<Local[]>([])

  const patch = useCallback((key: string, change: Partial<Local>) => {
    setLocals((all) => all.map((item) => (item.key === key ? { ...item, ...change } : item)))
  }, [])

  const pump = useCallback(() => {
    while (running.current < PARALLEL_FILES && queue.current.length > 0) {
      const item = queue.current.shift()!
      running.current++
      uploadMaster({
        file: item.file,
        albumId,
        resumeClipId: item.clipId ?? undefined,
        signal: item.controller.signal,
        onStarted: (clipId) => {
          patch(item.key, { clipId })
          router.refresh()
        },
        onProgress: (progress) => patch(item.key, { progress }),
      })
        .then(() => {
          setLocals((all) => all.filter((local) => local.key !== item.key))
          router.refresh()
        })
        .catch((error: UploadError) => {
          if (error.code === 'aborted') return
          patch(item.key, { error: error.code })
        })
        .finally(() => {
          running.current--
          pump()
        })
    }
  }, [albumId, patch, router])

  const enqueue = useCallback(
    (files: File[], resumeClipId: string | null = null) => {
      const added = files.map((file) => ({
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
        clipId: resumeClipId,
        progress: { sent: 0, total: file.size },
        error: null,
        controller: new AbortController(),
      }))
      setLocals((all) => [...all, ...added])
      queue.current.push(...added)
      pump()
    },
    [pump],
  )

  // Refresh while the server is still working on something; stop when idle.
  const working = clips.some((clip) => WORKING.includes(clip.status))
  useEffect(() => {
    if (!working) return
    const timer = setInterval(() => router.refresh(), 4000)
    return () => clearInterval(timer)
  }, [working, router])

  // A tab closing mid-upload loses its progress; say so before it happens.
  const busy = locals.some((local) => !local.error)
  useEffect(() => {
    if (!busy) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])

  const byClip = new Map(locals.filter((l) => l.clipId).map((local) => [local.clipId!, local]))
  const unplaced = locals.filter((local) => !local.clipId || !clips.some((c) => c.id === local.clipId))
  const ready = clips.filter((clip) => clip.status === 'ready').length

  const cancel = async (local: Local) => {
    local.controller.abort()
    setLocals((all) => all.filter((item) => item.key !== local.key))
    if (local.clipId) {
      await cancelUpload(local.clipId)
      router.refresh()
    }
  }

  return (
    <section aria-labelledby="clips-heading" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="clips-heading" className="text-xl font-bold">
          {t('studio.clips')}
        </h2>
        {clips.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('studio.upload.readyCount', { ready, total: clips.length })}
          </p>
        ) : null}
      </div>

      {editable ? (
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            enqueue([...event.dataTransfer.files])
          }}
          className={cn(
            'rounded-lg border border-dashed bg-card p-5 transition-colors',
            dragging ? 'border-foreground bg-muted' : 'border-border',
          )}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <Upload className="size-5 text-muted-foreground" aria-hidden />
            <p className="text-sm">{t('studio.upload.drop')}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => picker.current?.click()}>
              {t('studio.upload.choose')}
            </Button>
            <input
              ref={picker}
              type="file"
              multiple
              accept={ACCEPT}
              className="sr-only"
              aria-label={t('studio.upload.choose')}
              tabIndex={-1}
              onChange={(event) => {
                enqueue([...(event.target.files ?? [])])
                event.target.value = ''
              }}
            />
          </div>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <div className="flex gap-1.5">
              <dt>{t('studio.upload.formats')}</dt>
              <dd dir="ltr" className="ltr-island text-foreground">.mov · .mp4 — H.264 · H.265 · ProRes</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>{t('studio.upload.maxSize')}</dt>
              <dd className="numeric text-foreground">{formatBytes(maxBytes)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">{t('studio.upload.specsFromFile')}</p>
          {devDriver ? (
            <p className="mt-2 text-xs text-warning">{t('studio.upload.devDriver')}</p>
          ) : null}

          {unplaced.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {unplaced.map((local) => (
                <li key={local.key} className="rounded-md border bg-background p-3 text-sm">
                  <UploadLine local={local} onCancel={() => cancel(local)} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('studio.upload.frozen')}</p>
      )}

      {clips.length === 0 ? (
        <EmptyState title={t('studio.upload.empty')} description={t('studio.upload.emptyBody')} />
      ) : (
        <ol className="divide-y rounded-lg border bg-card">
          {clips.map((clip, index) => (
            <ClipRow
              key={clip.id}
              clip={clip}
              index={index}
              last={index === clips.length - 1}
              editable={editable}
              isCover={clip.id === coverClipId}
              local={byClip.get(clip.id) ?? null}
              onCancel={(local) => cancel(local)}
              onResume={(file) => enqueue([file], clip.id)}
            />
          ))}
        </ol>
      )}
    </section>
  )
}

function Progress({ progress }: { progress: UploadProgress }) {
  const percent = progress.total ? Math.floor((progress.sent / progress.total) * 100) : 0
  return (
    <div className="space-y-1">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full bg-foreground transition-[width] duration-300 ease-out" style={{ width: `${percent}%` }} />
      </div>
      <p className="numeric text-xs text-muted-foreground">
        {formatBytes(progress.sent)} / {formatBytes(progress.total)} · {percent}%
      </p>
    </div>
  )
}

function UploadLine({ local, onCancel }: { local: Local; onCancel: () => void }) {
  const t = useT()
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="ltr-island min-w-0 flex-1 truncate">{local.file.name}</span>
        <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onCancel} aria-label={t('studio.upload.cancel')}>
          <X />
        </Button>
      </div>
      {local.error ? (
        <p role="alert" className="text-xs text-destructive">
          {t(`studio.upload.refuse.${local.error}`) === `studio.upload.refuse.${local.error}`
            ? t('studio.upload.refuse.generic')
            : t(`studio.upload.refuse.${local.error}`)}
        </p>
      ) : (
        <Progress progress={local.progress} />
      )}
    </div>
  )
}

function statusVariant(status: StudioClip['status']) {
  if (status === 'ready') return 'success' as const
  if (status === 'failed') return 'destructive' as const
  return 'neutral' as const
}

function ClipRow({
  clip,
  index,
  last,
  editable,
  isCover,
  local,
  onCancel,
  onResume,
}: {
  clip: StudioClip
  index: number
  last: boolean
  editable: boolean
  isCover: boolean
  local: Local | null
  onCancel: (local: Local) => void
  onResume: (file: File) => void
}) {
  const t = useT()
  const router = useRouter()
  const [renaming, setRenaming] = useState(false)
  const [pending, startTransition] = useTransition()
  const resumePicker = useRef<HTMLInputElement>(null)

  const run = (action: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) =>
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        if (result.message) toast.success(result.message)
        after?.()
        router.refresh()
      } else {
        toast.error(result.message ?? t('state.error'))
      }
    })

  const interrupted = clip.status === 'uploading' && !local
  const working = WORKING.includes(clip.status) || (clip.status === 'uploading' && local && !local.error)

  return (
    <li className="p-3 sm:p-4" aria-busy={pending || Boolean(working)}>
      <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap sm:gap-4">
        <span className="numeric w-6 shrink-0 pt-1 text-center text-xs text-muted-foreground" aria-label={t('studio.upload.position', { n: index + 1 })}>
          {index + 1}
        </span>

        {/* The poster, in the film's own frame. */}
        <div className="dark relative aspect-video w-24 shrink-0 overflow-hidden rounded-sm bg-ink sm:w-32">
          {clip.posterUrl ? (
            <img src={clip.posterUrl} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center">
              {working ? <Spinner className="size-4 text-off-white/70" /> : <ImageIcon className="size-4 text-off-white/50" aria-hidden />}
            </span>
          )}
          {isCover ? (
            <Badge variant="film" className="absolute bottom-1 start-1 px-1.5 py-0 text-xs">
              {t('studio.upload.cover')}
            </Badge>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="truncate font-medium">{clip.titleAr}</p>
          <p className="truncate text-sm text-muted-foreground">
            <span className="ltr-island">{clip.titleEn}</span>
          </p>

          {clip.status === 'ready' ? (
            <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="numeric">{clip.width}×{clip.height}</span>
              <span className="numeric">{clip.fps} fps</span>
              {clip.codec ? <span className="ltr-island">{clip.codec}</span> : null}
              {clip.colourProfile ? <span className="ltr-island">{clip.colourProfile}</span> : null}
              <span className="numeric">{clip.duration}</span>
              {clip.sizeBytes ? <span className="numeric">{formatBytes(clip.sizeBytes)}</span> : null}
              {clip.movement ? <span>{clip.movement}</span> : null}
            </p>
          ) : clip.status === 'failed' ? (
            <p role="alert" className="text-xs text-destructive">
              {t(`studio.upload.error.${clip.error ?? 'preview'}`)}
              {clip.error === 'codec' ? <span className="ltr-island ms-1">H.264 · H.265 · ProRes</span> : null}
            </p>
          ) : local && !local.error ? (
            <Progress progress={local.progress} />
          ) : local?.error ? (
            <p role="alert" className="text-xs text-destructive">{t('studio.upload.refuse.generic')}</p>
          ) : interrupted ? (
            <p className="text-xs text-muted-foreground">
              {t('studio.upload.interrupted')} {editable ? t('studio.upload.resumeHint') : null}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('studio.upload.specsPending')}</p>
          )}

          {renaming ? (
            <form
              className="mt-2 grid gap-2 sm:grid-cols-2"
              action={(formData) => run(() => updateClipTitles(clip.id, formData), () => setRenaming(false))}
            >
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">{t('studio.upload.titleAr')}</span>
                <Input name="titleAr" defaultValue={clip.titleAr} required maxLength={160} />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">{t('studio.upload.titleEn')}</span>
                <Input name="titleEn" defaultValue={clip.titleEn} required maxLength={160} dir="ltr" />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? <Spinner className="size-4 text-current" /> : null}
                  {t('studio.upload.save')}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(false)}>
                  {t('studio.upload.cancel')}
                </Button>
              </div>
            </form>
          ) : null}
        </div>

        {/* Below the clip on a phone, beside it from `sm` up. */}
        <div className="flex w-full items-center justify-between gap-2 ps-9 sm:w-auto sm:shrink-0 sm:flex-col sm:items-end sm:ps-0">
          <Badge variant={statusVariant(clip.status)} className="whitespace-nowrap">
            {interrupted ? t('studio.upload.interrupted').replace(/\.$/, '') : t(`studio.upload.status.${clip.status}`)}
          </Badge>

          {editable ? (
            <div className="flex items-center gap-1">
              {interrupted ? (
                <>
                  <Button type="button" size="sm" variant="outline" onClick={() => resumePicker.current?.click()}>
                    {t('studio.upload.resume')}
                  </Button>
                  <input
                    ref={resumePicker}
                    type="file"
                    accept={ACCEPT}
                    className="sr-only"
                    tabIndex={-1}
                    aria-label={t('studio.upload.resume')}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (!file) return
                      // Resuming someone else's bytes into this master would
                      // corrupt it: same name and size as the one started.
                      if (file.name !== clip.originalFilename || (clip.sizeBytes && file.size !== clip.sizeBytes)) {
                        toast.error(t('studio.upload.resumeMismatch'))
                        return
                      }
                      onResume(file)
                    }}
                  />
                </>
              ) : null}
              {local && !local.error ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => onCancel(local)}>
                  {t('studio.upload.cancel')}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={pending || index === 0}
                    aria-label={t('studio.upload.moveUp')}
                    onClick={() => run(() => moveClip(clip.id, 'up'))}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={pending || last}
                    aria-label={t('studio.upload.moveDown')}
                    onClick={() => run(() => moveClip(clip.id, 'down'))}
                  >
                    <ArrowDown />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={t('actions.more')}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setRenaming(true)}>
                        <Pencil className="size-4" />
                        {t('studio.upload.rename')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={clip.status !== 'ready' || isCover}
                        onSelect={() => run(() => setAlbumCover(clip.id))}
                      >
                        <ImageIcon className="size-4" />
                        {t('studio.upload.makeCover')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => {
                          if (!window.confirm(t('studio.upload.deleteConfirm', { title: clip.titleAr }))) return
                          run(() => deleteClip(clip.id))
                        }}
                      >
                        <Trash2 className="size-4" />
                        {t('studio.upload.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
      {clip.identifiableFaces ? (
        <p className="mt-2 ps-9">
          <Badge variant="warning">{t('catalogue.identifiableFaces')}</Badge>
        </p>
      ) : null}
    </li>
  )
}
