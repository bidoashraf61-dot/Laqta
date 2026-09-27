'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/state'
import { toast } from '@/components/ui/toast'
import { useT } from '@/lib/i18n-client'
import { cn } from '@/lib/utils'
import { updateClipTitlesBulk } from '@/app/(studio)/studio/actions'
import type { StudioClip } from './album-clips'

type Row = { id: string; titleAr: string; titleEn: string }

/**
 * Every clip title in one form (DEV-12).
 *
 * Each clip starts titled after its file name, and a buyer searches titles.
 * Renaming fifty clips one menu at a time is where creators stopped, so this
 * is a plain grid — one row per clip, Arabic and English side by side, Tab
 * moving through them in order — with one save for the lot. Rows the creator
 * leaves untouched are not written.
 */
export function BulkTitles({
  albumId,
  clips,
  onDone,
}: {
  albumId: string
  clips: StudioClip[]
  onDone: () => void
}) {
  const t = useT()
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>(() =>
    clips.map((clip) => ({ id: clip.id, titleAr: clip.titleAr, titleEn: clip.titleEn })),
  )
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  const edit = (id: string, field: 'titleAr' | 'titleEn', value: string) =>
    setRows((all) => all.map((row) => (row.id === id ? { ...row, [field]: value } : row)))

  const save = () =>
    startTransition(async () => {
      const result = await updateClipTitlesBulk(albumId, rows)
      if (result.ok) {
        toast.success(result.message ?? t('dash.saved'))
        router.refresh()
        onDone()
      } else {
        setInvalid(new Set(result.invalid ?? []))
        toast.error(result.message ?? t('state.error'))
      }
    })

  return (
    <form
      className="rounded-lg border bg-card"
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <div className="border-b p-4">
        <p className="text-sm text-muted-foreground">{t('studio.upload.bulkHint')}</p>
      </div>

      <div className="hidden grid-cols-[1.5rem_1fr_1fr] gap-3 border-b px-4 py-2 text-xs text-muted-foreground sm:grid">
        <span />
        <span>{t('studio.upload.titleAr')}</span>
        <span>{t('studio.upload.titleEn')}</span>
      </div>

      <ol className="divide-y">
        {rows.map((row, index) => {
          const clip = clips[index]
          const bad = invalid.has(row.id)
          return (
            <li key={row.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1.5rem_1fr_1fr] sm:items-center sm:gap-3">
              <span className="numeric text-xs text-muted-foreground" aria-hidden>
                {index + 1}
              </span>
              <label className="grid gap-1">
                <span className="sr-only">
                  {t('studio.upload.titleAr')} — {t('studio.upload.position', { n: index + 1 })}
                </span>
                <span className="text-xs text-muted-foreground sm:hidden">{t('studio.upload.titleAr')}</span>
                <Input
                  value={row.titleAr}
                  onChange={(event) => edit(row.id, 'titleAr', event.target.value)}
                  maxLength={160}
                  required
                  aria-invalid={bad && !row.titleAr.trim() ? true : undefined}
                  className={cn(bad && !row.titleAr.trim() && 'border-destructive')}
                />
              </label>
              <label className="grid gap-1">
                <span className="sr-only">
                  {t('studio.upload.titleEn')} — {t('studio.upload.position', { n: index + 1 })}
                </span>
                <span className="text-xs text-muted-foreground sm:hidden">{t('studio.upload.titleEn')}</span>
                <Input
                  value={row.titleEn}
                  onChange={(event) => edit(row.id, 'titleEn', event.target.value)}
                  maxLength={160}
                  required
                  dir="ltr"
                  aria-invalid={bad && !row.titleEn.trim() ? true : undefined}
                  className={cn(bad && !row.titleEn.trim() && 'border-destructive')}
                />
              </label>
              {clip?.originalFilename ? (
                <span className="text-xs text-muted-foreground sm:col-start-2 sm:col-end-4">
                  {t('studio.upload.bulkFile')} <span className="ltr-island">{clip.originalFilename}</span>
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>

      <div className="flex flex-wrap gap-2 border-t p-4">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Spinner className="size-4 text-current" /> : null}
          {t('studio.upload.bulkSave')}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onDone}>
          {t('studio.upload.cancel')}
        </Button>
      </div>
    </form>
  )
}
