'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, RotateCcw, Search, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Field } from '@/components/ui/label'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Alert, AlertDescription, Spinner } from '@/components/ui/state'
import { toast } from '@/components/ui/toast'
import { Panel } from '@/components/dashboard/primitives'
import { previewCopyAction, publishCopyAction, undoCopyBatchAction } from '@/app/(admin)/admin/content/actions'
import { COPY_GROUPS, sectionOf, validateCopy, type CopyGroup } from '@/lib/copy-rules'
import { useLocale, useT } from '@/lib/i18n-client'
import type { Locale } from '@/lib/locale'
import { cn } from '@/lib/utils'

/**
 * The site-copy editor — landing, `/sell`, emails (DEV-64b).
 *
 * ── One row per string, both languages side by side ────────────────────────
 * Each box starts at what the site shows now (the published edit, else the
 * original). Emptying a box means "back to the original" — the row says so
 * and shows the original under it, so deleting text is never a way to blank a
 * headline.
 *
 * ── The rules run as you type ───────────────────────────────────────────────
 * The same `validateCopy` the server runs at publish: `{placeholders}` kept,
 * length within the string's cap, no HTML, the right language in the right
 * box, no banned claim. A row that breaks one is marked in place and publish
 * waits until it is fixed.
 *
 * ── Preview is the real page ────────────────────────────────────────────────
 * «معاينة على الصفحة» stores the drafts and opens the live page with
 * `?copyPreview=<id>`, which the middleware honours for admins only. Emails
 * open in the admin email preview with the same drafts.
 */

export type CopySide = {
  original: string
  published: string | null
  cap: number
  placeholders: string[]
}

export type CopyRow = { key: string; ar: CopySide; en: CopySide }

export type EditorBatch = {
  batchId: string
  date: string
  publishedBy: string | null
  note: string | null
  undoOf: string | null
  changes: Array<{ key: string; locale: Locale; before: string | null; after: string | null }>
}

const LOCALES: Locale[] = ['ar', 'en']
const id = (locale: Locale, key: string) => `${locale}:${key}`
const storageKey = (group: string) => `laqta:copy-draft:${group}`

function readDraft(group: string): Record<string, string> | null {
  try {
    const raw = window.localStorage.getItem(storageKey(group))
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : null
  } catch {
    return null
  }
}

function writeDraft(group: string, draft: Record<string, string> | null) {
  try {
    if (draft && Object.keys(draft).length) window.localStorage.setItem(storageKey(group), JSON.stringify(draft))
    else window.localStorage.removeItem(storageKey(group))
  } catch {
    // Storage blocked: the draft is just not remembered.
  }
}

export function CopyEditor({
  group,
  path,
  rows,
  history,
  templates,
}: {
  group: CopyGroup
  path: string | null
  rows: CopyRow[]
  history: EditorBatch[]
  templates: string[]
}) {
  const t = useT()
  const uiLocale = useLocale()
  const router = useRouter()
  // One-section groups show keys without the section; mixed groups show it.
  const single = COPY_GROUPS[group].sections.length === 1
  const shortKey = (key: string) => (single ? key.slice(key.indexOf('.') + 1) : key)

  const baseline = useMemo(() => {
    const map: Record<string, string> = {}
    for (const row of rows) for (const l of LOCALES) map[id(l, row.key)] = row[l].published ?? row[l].original
    return map
  }, [rows])
  const sides = useMemo(() => {
    const map: Record<string, CopySide & { key: string; locale: Locale }> = {}
    for (const row of rows) for (const l of LOCALES) map[id(l, row.key)] = { ...row[l], key: row.key, locale: l }
    return map
  }, [rows])

  const [values, setValues] = useState<Record<string, string>>(baseline)
  const [query, setQuery] = useState('')
  const [onlyEdited, setOnlyEdited] = useState(false)
  const [note, setNote] = useState('')
  const [previewLocale, setPreviewLocale] = useState<Locale>(uiLocale)
  const [template, setTemplate] = useState(templates[0] ?? '')
  const [serverError, setServerError] = useState<{ message: string; at?: string } | null>(null)
  const [storedDraft, setStoredDraft] = useState<Record<string, string> | null>(null)
  const [pending, startTransition] = useTransition()
  const draftChecked = useRef(false)

  /** What a box resolves to: its text, or the original when emptied. */
  const effective = (cell: string) => values[cell].trim() || sides[cell].original
  const changed = useMemo(
    () => Object.keys(values).filter((cell) => (values[cell].trim() || sides[cell].original) !== baseline[cell]),
    [values, baseline, sides],
  )
  const errors = useMemo(() => {
    const map: Record<string, string> = {}
    for (const cell of changed) {
      const side = sides[cell]
      const text = values[cell].trim() || side.original
      if (text === side.original) continue
      const error = validateCopy(side.locale, side.key, text)
      if (error) map[cell] = t(error.key, error.vars)
    }
    return map
  }, [changed, values, sides, t])
  const dirty = changed.length > 0
  const blocked = Object.keys(errors).length > 0
  const draft = useMemo(() => Object.fromEntries(changed.map((cell) => [cell, values[cell]])), [changed, values])

  // Offer back a draft left from an earlier visit.
  useEffect(() => {
    const stored = readDraft(group)
    const relevant = stored && Object.keys(stored).some((cell) => cell in baseline && stored[cell] !== baseline[cell])
    if (relevant) setStoredDraft(stored)
    else {
      writeDraft(group, null)
      draftChecked.current = true
    }
  }, [group, baseline])

  useEffect(() => {
    if (draftChecked.current) writeDraft(group, draft)
  }, [group, draft])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = (cell: string, value: string) => {
    setValues((current) => ({ ...current, [cell]: value }))
    if (serverError) setServerError(null)
  }

  const payload = () => changed.map((cell) => ({ key: sides[cell].key, locale: sides[cell].locale, value: values[cell].trim() }))

  const pointAt = (at?: { key: string; locale: Locale }) => {
    if (!at) return
    setQuery('')
    setOnlyEdited(false)
    requestAnimationFrame(() => {
      const field = document.getElementById(`copy-${at.locale}-${at.key}`)
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      field?.focus({ preventScroll: true })
    })
  }

  const publish = () => {
    if (blocked) {
      toast.error(t('dash.copy.fixErrors'))
      return
    }
    if (!window.confirm(t('dash.copy.publishConfirm'))) return
    startTransition(async () => {
      const result = await publishCopyAction(payload(), note)
      if (result.ok) {
        writeDraft(group, null)
        toast.success(result.message ?? t('dash.copy.publishedToast'))
        router.refresh()
      } else {
        setServerError({ message: result.message ?? t('state.error'), at: result.at ? id(result.at.locale, result.at.key) : undefined })
        pointAt(result.at)
      }
    })
  }

  const preview = () => {
    // Opened before the await, so the browser treats it as the click's own
    // window rather than a pop-up; pointed at the page once the id is back.
    const tab = window.open('', '_blank')
    startTransition(async () => {
      const result = await previewCopyAction(payload())
      if (!result.ok || !result.previewId) {
        tab?.close()
        toast.error(result.message ?? t('state.error'))
        pointAt(result.at)
        return
      }
      const lang = previewLocale === 'en' ? '/en' : ''
      const target =
        group === 'email'
          ? `${lang}/admin/content/copy/email/preview?template=${encodeURIComponent(template)}&lang=${previewLocale}&copyPreview=${result.previewId}`
          : `${lang}${path === '/' && lang ? '' : path}?copyPreview=${result.previewId}`
      if (tab) tab.location.href = target
      else window.open(target, '_blank')
      toast.success(t('dash.copy.previewOpened'))
    })
  }

  const undo = (batchId: string) => {
    if (!window.confirm(t('dash.copy.undoConfirm'))) return
    startTransition(async () => {
      const result = await undoCopyBatchAction(batchId)
      if (result.ok) {
        writeDraft(group, null)
        toast.success(result.message ?? t('dash.copy.undone'))
        router.refresh()
      } else {
        toast.error(result.message ?? t('state.error'))
      }
    })
  }

  const needle = query.trim().toLowerCase()
  const visible = rows.filter((row) => {
    const cells = LOCALES.map((l) => id(l, row.key))
    if (onlyEdited && !cells.some((cell) => sides[cell].published !== null || changed.includes(cell))) return false
    if (!needle) return true
    return (
      row.key.toLowerCase().includes(needle) ||
      cells.some((cell) => values[cell].toLowerCase().includes(needle) || sides[cell].original.toLowerCase().includes(needle))
    )
  })

  return (
    <div className="space-y-6">
      {storedDraft ? (
        <Alert variant="warning">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{t('dash.copy.draftFound')}</span>
            <span className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const stored = storedDraft
                  draftChecked.current = true
                  setStoredDraft(null)
                  setValues((current) => {
                    const next = { ...current }
                    for (const [cell, value] of Object.entries(stored)) if (cell in next) next[cell] = value
                    return next
                  })
                }}
              >
                {t('dash.copy.draftRestore')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  writeDraft(group, null)
                  draftChecked.current = true
                  setStoredDraft(null)
                }}
              >
                {t('dash.copy.draftDismiss')}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      <Panel>
        {/* ── Find ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-3 border-b border-border/60 pb-4">
          <Field label={t('dash.copy.search')} htmlFor={`copy-search-${group}`} className="min-w-56 flex-1 space-y-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id={`copy-search-${group}`}
                type="search"
                placeholder={t('dash.copy.searchHint')}
                className="ps-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </Field>
          <button
            type="button"
            aria-pressed={onlyEdited}
            onClick={() => setOnlyEdited((v) => !v)}
            className={cn(
              'h-10 rounded-md border px-3 text-sm transition-colors duration-hover ease-lens',
              onlyEdited ? 'border-foreground/30 bg-muted font-medium' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t('dash.copy.onlyModified')}
          </button>
          <p className="pb-2.5 text-sm text-muted-foreground" aria-live="polite">
            {t('dash.copy.shown', { shown: visible.length, total: rows.length })}
          </p>
        </div>

        {/* ── Strings ──────────────────────────────────────────────────── */}
        {visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('dash.copy.noMatch')}</p>
        ) : (
          <ul className="-mb-2 divide-y divide-border/60">
            {visible.map((row, index) => {
              const cells = LOCALES.map((l) => id(l, row.key))
              // Mixed groups get a heading where a new part of the site begins.
              const section = sectionOf(row.key)
              const opensSection = !single && (index === 0 || sectionOf(visible[index - 1].key) !== section)
              const isPublished = cells.some((cell) => sides[cell].published !== null)
              const isDraft = cells.some((cell) => changed.includes(cell))
              return (
                <li key={row.key} className="space-y-3 py-5">
                  {opensSection ? (
                    <h2 className="-mt-1 pb-2 font-medium">{t(`dash.copy.section.${section}`)}</h2>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      <span className="ltr-island" dir="ltr">
                        {shortKey(row.key)}
                      </span>
                    </p>
                    <span className="flex gap-1.5">
                      {isDraft ? <Badge variant="warning">{t('dash.copy.draft')}</Badge> : null}
                      {isPublished ? <Badge variant="success">{t('dash.copy.published')}</Badge> : null}
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {LOCALES.map((l) => {
                      const cell = id(l, row.key)
                      return (
                        <CopyField
                          key={cell}
                          fieldId={`copy-${l}-${row.key}`}
                          locale={l}
                          rowKey={row.key}
                          side={sides[cell]}
                          value={values[cell]}
                          resolved={effective(cell)}
                          error={errors[cell] ?? (serverError?.at === cell ? serverError.message : null)}
                          onChange={(value) => set(cell, value)}
                        />
                      )
                    })}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {/* ── Publish ────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'z-10 space-y-2.5 rounded-lg border bg-background/95 p-3 shadow-soft backdrop-blur supports-[backdrop-filter]:bg-background/85',
          (dirty || serverError) && 'sticky bottom-0',
        )}
      >
        {serverError && !serverError.at ? (
          <Alert variant="destructive">
            <AlertDescription>{serverError.message}</AlertDescription>
          </Alert>
        ) : null}
        {blocked ? (
          <p className="text-sm text-destructive" role="alert">
            {t('dash.copy.fixErrors')}
          </p>
        ) : null}
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t('dash.copy.note')} htmlFor={`copy-note-${group}`} className="min-w-48 flex-1 space-y-1.5">
            <Input id={`copy-note-${group}`} maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>

          {/* Preview: language (and, for email, which message) then the button. */}
          <div className="flex flex-wrap items-end gap-2">
            {templates.length ? (
              <Field label={t('dash.copy.previewTemplate')} htmlFor={`copy-template-${group}`} className="space-y-1.5">
                <NativeSelect
                  id={`copy-template-${group}`}
                  className="w-56"
                  value={template}
                  onChange={(event) => setTemplate(event.target.value)}
                >
                  {templates.map((name) => (
                    <option key={name} value={name}>
                      {t(`dash.copy.template.${name.replace('.', '_')}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
            <div role="group" aria-label={t('dash.copy.previewLanguage')} className="flex h-10 gap-0.5 rounded-md border p-0.5">
              {LOCALES.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={previewLocale === l}
                  onClick={() => setPreviewLocale(l)}
                  className={cn(
                    'rounded-sm px-2.5 text-xs font-medium transition-colors duration-hover ease-lens',
                    previewLocale === l ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {l === 'ar' ? t('dash.copy.arabic') : t('dash.copy.english')}
                </button>
              ))}
            </div>
            <Button type="button" variant="outline" disabled={pending || blocked} onClick={preview}>
              <Eye className="size-4" aria-hidden />
              {group === 'email' ? t('dash.copy.previewEmail') : t('dash.copy.preview')}
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            disabled={!dirty || pending}
            onClick={() => {
              if (!window.confirm(t('dash.copy.discardConfirm'))) return
              writeDraft(group, null)
              setValues(baseline)
              setServerError(null)
            }}
          >
            {t('dash.copy.discard')}
          </Button>
          <Button type="button" disabled={!dirty || pending || blocked} onClick={publish}>
            {pending ? <Spinner className="size-4 text-current" /> : null}
            {t('dash.copy.publish')}
          </Button>
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          <span aria-hidden className={cn('size-2 rounded-full', dirty ? 'bg-warning' : 'bg-border')} />
          <span className={cn(dirty && 'text-foreground')}>
            {dirty ? t('dash.copy.unsaved', { count: changed.length }) : t('dash.copy.noChanges')}
          </span>
        </p>
      </div>

      {/* ── History ────────────────────────────────────────────────────── */}
      <Panel title={t('dash.copy.history')}>
        <p className="mb-4 text-sm text-muted-foreground">
          {history.length ? t('dash.copy.historyHint') : t('dash.copy.noHistory')}
        </p>
        {history.length ? (
          <ul className="-mb-2 divide-y divide-border/60">
            {history.map((batch) => (
              <li key={batch.batchId} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      <span className="numeric">{batch.date}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[
                        batch.publishedBy ? t('dash.docs.by', { name: batch.publishedBy }) : null,
                        batch.undoOf,
                        batch.note,
                        t('dash.copy.batchCount', { count: batch.changes.length }),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => undo(batch.batchId)}>
                    <Undo2 className="size-3.5" aria-hidden />
                    {t('dash.copy.undo')}
                  </Button>
                </div>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    {t('dash.copy.showChanges')}
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {batch.changes.map((change) => (
                      <li key={`${change.locale}:${change.key}`} className="rounded-md bg-muted/50 px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          <span className="ltr-island" dir="ltr">
                            {shortKey(change.key)} · {change.locale}
                          </span>
                        </p>
                        <p dir={change.locale === 'en' ? 'ltr' : 'rtl'} className="mt-1 text-muted-foreground line-through">
                          {change.before ?? `${sides[id(change.locale, change.key)]?.original ?? ''} ${t('dash.copy.toOriginal')}`}
                        </p>
                        <p dir={change.locale === 'en' ? 'ltr' : 'rtl'} className="mt-0.5">
                          {change.after ?? `${sides[id(change.locale, change.key)]?.original ?? ''} ${t('dash.copy.toOriginal')}`}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </div>
  )
}

function CopyField({
  fieldId,
  locale,
  rowKey,
  side,
  value,
  resolved,
  error,
  onChange,
}: {
  fieldId: string
  locale: Locale
  rowKey: string
  side: CopySide
  value: string
  resolved: string
  error: string | null
  onChange: (value: string) => void
}) {
  const t = useT()
  const length = value.trim().length
  const near = length > side.cap * 0.9
  const differs = resolved !== side.original
  // Shown when the box differs, and when it is empty — empty publishes as the
  // original, so the owner sees what will show.
  const showOriginal = differs || value.trim() === ''
  const label = locale === 'ar' ? t('dash.copy.arabic') : t('dash.copy.english')

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Textarea
        id={fieldId}
        dir={locale === 'en' ? 'ltr' : 'rtl'}
        lang={locale}
        rows={side.original.length > 90 ? 3 : 1}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${fieldId}-meta`}
        className={cn(
          'min-h-10 resize-y leading-relaxed [field-sizing:content]',
          error && 'border-destructive focus-visible:ring-destructive',
        )}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <div id={`${fieldId}-meta`} className="space-y-1 text-xs">
        {error ? (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          <span className={cn('numeric', near && 'text-warning')}>
            {t('dash.copy.counter', { n: length, max: side.cap })}
          </span>
          {side.placeholders.length ? (
            <span>
              {t('dash.copy.mustKeep')}{' '}
              {side.placeholders.map((name) => (
                <code key={name} dir="ltr" className="ltr-island me-1 rounded bg-muted px-1">{`{${name}}`}</code>
              ))}
            </span>
          ) : null}
          {differs ? (
            <button
              type="button"
              onClick={() => onChange(side.original)}
              aria-label={t('dash.copy.resetLabel', { key: rowKey, lang: label })}
              className="inline-flex items-center gap-1 text-foreground/80 underline-offset-4 hover:text-foreground hover:underline"
            >
              <RotateCcw className="size-3" aria-hidden />
              {t('dash.copy.reset')}
            </button>
          ) : null}
        </div>
        {showOriginal ? (
          <p className="line-clamp-2 text-muted-foreground" dir={locale === 'en' ? 'ltr' : 'rtl'}>
            <span className="font-medium">{t('dash.copy.original')}</span> {side.original}
          </p>
        ) : null}
      </div>
    </div>
  )
}
