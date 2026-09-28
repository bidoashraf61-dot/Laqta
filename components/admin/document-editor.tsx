'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Field } from '@/components/ui/label'
import { Input, Textarea } from '@/components/ui/input'
import { Alert, AlertDescription, Spinner } from '@/components/ui/state'
import { toast } from '@/components/ui/toast'
import { Panel } from '@/components/dashboard/primitives'
import { DocumentBody } from '@/components/layout/document-body'
import type { DocumentSection } from '@/components/layout/document-page'
import { publishDocumentAction, restoreDocumentAction } from '@/app/(admin)/admin/content/actions'
import { useLocale, useT } from '@/lib/i18n-client'
import type { Locale } from '@/lib/locale'
import { cn } from '@/lib/utils'

/**
 * The long-form page editor (DEV-64a).
 *
 * ── Built for a lawyer's text, typed by a non-developer ─────────────────────
 * Paragraphs are one textarea with a blank line between them, and a list is
 * one item per line — the way the text arrives in an email or a Word file, so
 * a whole section pastes in one go instead of box by box. The English side of
 * each section is folded away until wanted: the Arabic is the operative text
 * and the English a convenience translation.
 *
 * ── The preview is the page ─────────────────────────────────────────────────
 * It renders the same `DocumentBody` the public route renders, in either
 * language, so what is checked here is what goes live.
 *
 * ── Nothing is lost by accident ─────────────────────────────────────────────
 * A draft is kept in this browser until it is published or discarded (and
 * offered back on the next visit), and leaving the tab with unpublished
 * changes asks first. Browser storage is a convenience only: the site is
 * changed by the publish action, and a failed storage read changes nothing.
 */

export type EditorVersion = {
  id: string
  sections: DocumentSection[]
  /** Already formatted in the reader's language. */
  date: string
  publishedBy: string | null
  note: string | null
  /** "Restored from …", already formatted, or null for an ordinary publish. */
  restored: string | null
}

type FormSection = {
  id: number
  /** The section's page anchor (e.g. "cookies"), carried through untouched. */
  anchor?: string
  heading: string
  headingEn: string
  body: string
  bodyEn: string
  list: string
  listEn: string
}

let nextId = 1
const PARAGRAPH_BREAK = /\n\s*\n/

function toForm(sections: DocumentSection[]): FormSection[] {
  return sections.map((s) => ({
    id: nextId++,
    anchor: s.id,
    heading: s.heading,
    headingEn: s.headingEn ?? '',
    body: s.body.join('\n\n'),
    bodyEn: (s.bodyEn ?? []).join('\n\n'),
    list: (s.list ?? []).join('\n'),
    listEn: (s.listEn ?? []).join('\n'),
  }))
}

const split = (value: string, by: RegExp | string) =>
  value
    .split(by)
    .map((part) => part.trim())
    .filter(Boolean)

/** The same shape the server normalises to — so preview, dirty-check and publish agree. */
function fromForm(form: FormSection[]): DocumentSection[] {
  return form.map((f) => {
    const section: DocumentSection = { heading: f.heading.trim(), body: split(f.body, PARAGRAPH_BREAK) }
    const list = split(f.list, '\n')
    const headingEn = f.headingEn.trim()
    const bodyEn = split(f.bodyEn, PARAGRAPH_BREAK)
    const listEn = split(f.listEn, '\n')
    if (list.length) section.list = list
    if (headingEn) section.headingEn = headingEn
    if (bodyEn.length) section.bodyEn = bodyEn
    if (listEn.length) section.listEn = listEn
    if (f.anchor) section.id = f.anchor
    return section
  })
}

/** Field order differs between the code text and the editor's output; compare by content. */
const canonical = (sections: DocumentSection[]) => JSON.stringify(fromForm(toForm(sections)))

const untranslated = (s: DocumentSection) =>
  !s.headingEn || (s.body.length > 0 && !s.bodyEn?.length) || Boolean(s.list?.length && !s.listEn?.length)

/** Rows for a textarea that grows with its text where `field-sizing` is not supported. */
const rowsFor = (value: string, min: number) => Math.min(24, Math.max(min, Math.ceil(value.length / 70) + value.split('\n').length))

const storageKey = (docKey: string) => `laqta:document-draft:${docKey}`

function readDraft(docKey: string): DocumentSection[] | null {
  try {
    const raw = window.localStorage.getItem(storageKey(docKey))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as DocumentSection[]) : null
  } catch {
    return null
  }
}

function writeDraft(docKey: string, sections: DocumentSection[] | null) {
  try {
    if (sections) window.localStorage.setItem(storageKey(docKey), JSON.stringify(sections))
    else window.localStorage.removeItem(storageKey(docKey))
  } catch {
    // Storage blocked or full: the draft just is not remembered.
  }
}

export function DocumentEditor({
  docKey,
  titles,
  dated,
  lists,
  live,
  original,
  versions,
}: {
  docKey: string
  titles: Record<Locale, string>
  dated: boolean
  lists: boolean
  live: { versionId: string | null; sections: DocumentSection[] }
  original: DocumentSection[]
  versions: EditorVersion[]
}) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()

  const [form, setForm] = useState<FormSection[]>(() => toForm(live.sections))
  const [note, setNote] = useState('')
  const [previewLocale, setPreviewLocale] = useState<Locale>(locale)
  const [pane, setPane] = useState<'edit' | 'preview'>('edit')
  const [englishOpen, setEnglishOpen] = useState<Set<number>>(new Set())
  const [error, setError] = useState<{ message: string; section?: number } | null>(null)
  const [storedDraft, setStoredDraft] = useState<DocumentSection[] | null>(null)
  const [pending, startTransition] = useTransition()
  const editorTop = useRef<HTMLDivElement>(null)
  // Storage is written only once any stored draft has been offered and
  // decided on — otherwise the first render would overwrite it unseen.
  const draftChecked = useRef(false)

  const sections = useMemo(() => fromForm(form), [form])
  const baseline = useMemo(() => canonical(live.sections), [live.sections])
  const dirty = JSON.stringify(sections) !== baseline

  // Offer back a draft left from an earlier visit — once, on mount.
  useEffect(() => {
    const draft = readDraft(docKey)
    if (draft && canonical(draft) !== baseline) {
      setStoredDraft(draft)
    } else {
      writeDraft(docKey, null)
      draftChecked.current = true
    }
  }, [docKey, baseline])

  // Remember the draft while there is one; forget it when it matches the site.
  useEffect(() => {
    if (!draftChecked.current) return
    writeDraft(docKey, dirty ? sections : null)
  }, [docKey, dirty, sections])

  // Leaving with unpublished changes asks first.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const update = (id: number, patch: Partial<FormSection>) => {
    setForm((current) => current.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    if (error) setError(null)
  }
  const move = (index: number, by: -1 | 1) =>
    setForm((current) => {
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(index + by, 0, item)
      return next
    })
  const remove = (id: number) => {
    if (!window.confirm(t('dash.docs.removeConfirm'))) return
    setForm((current) => current.filter((s) => s.id !== id))
  }
  const add = () => {
    const section: FormSection = { id: nextId++, heading: '', headingEn: '', body: '', bodyEn: '', list: '', listEn: '' }
    setForm((current) => [...current, section])
    requestAnimationFrame(() => document.getElementById(`doc-heading-${section.id}`)?.focus())
  }
  const load = (next: DocumentSection[], message?: string) => {
    setForm(toForm(next))
    setError(null)
    setPane('edit')
    editorTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (message) toast.success(message)
  }
  const toggleEnglish = (id: number, open: boolean) =>
    setEnglishOpen((current) => {
      const next = new Set(current)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })

  const publish = () => {
    if (!window.confirm(t('dash.docs.publishConfirm'))) return
    startTransition(async () => {
      const result = await publishDocumentAction(docKey, sections, note)
      if (result.ok) {
        writeDraft(docKey, null)
        toast.success(result.message ?? t('dash.docs.published'))
        router.refresh()
        return
      }
      setError({ message: result.message ?? t('state.error'), section: result.section })
      if (result.section) {
        const target = form[result.section - 1]
        if (target) toggleEnglish(target.id, true)
        setPane('edit')
        requestAnimationFrame(() =>
          document.getElementById(`doc-section-${result.section}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        )
      }
    })
  }

  const restore = (from: string) => {
    if (!window.confirm(t('dash.docs.restoreConfirm'))) return
    startTransition(async () => {
      const result = await restoreDocumentAction(docKey, from)
      if (result.ok) {
        writeDraft(docKey, null)
        toast.success(result.message ?? t('dash.docs.restored'))
        router.refresh()
      } else {
        toast.error(result.message ?? t('state.error'))
      }
    })
  }

  const liveId = live.versionId
  const previewDir = previewLocale === 'en' ? 'ltr' : 'rtl'

  return (
    <div className="space-y-8">
      {storedDraft ? (
        <Alert variant="warning">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{t('dash.docs.draftFound')}</span>
            <span className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const draft = storedDraft
                  draftChecked.current = true
                  setStoredDraft(null)
                  load(draft)
                }}
              >
                {t('dash.docs.draftRestore')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  writeDraft(docKey, null)
                  draftChecked.current = true
                  setStoredDraft(null)
                }}
              >
                {t('dash.docs.draftDismiss')}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Below lg the two panes share the screen by a switch rather than
          stacking — a 20-screen editor above its preview is a preview no one
          scrolls to. */}
      <div role="group" aria-label={t('dash.docs.panes')} className="flex gap-1 rounded-md border bg-card p-1 lg:hidden">
        {(['edit', 'preview'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={pane === value}
            onClick={() => setPane(value)}
            className={cn(
              'h-9 flex-1 rounded-sm text-sm font-medium transition-colors duration-hover ease-lens',
              pane === value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {value === 'edit' ? t('dash.docs.editorTab') : t('dash.docs.preview')}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        {/* ── Editor ─────────────────────────────────────────────────────── */}
        <div ref={editorTop} className={cn('min-w-0 scroll-mt-24 space-y-4', pane === 'preview' && 'hidden lg:block')}>
          {form.map((section, index) => {
            const n = index + 1
            const shaped = sections[index]
            const missingEnglish = shaped ? untranslated(shaped) : false
            const failed = error?.section === n
            const englishShown = englishOpen.has(section.id)
            const id = (name: string) => `doc-${name}-${section.id}`

            return (
              <section
                key={section.id}
                id={`doc-section-${n}`}
                aria-labelledby={id('title')}
                className={cn(
                  'scroll-mt-24 rounded-lg border bg-card',
                  failed && 'border-destructive ring-1 ring-destructive/40',
                )}
              >
                <header className="flex items-center justify-between gap-3 border-b border-border/60 py-2 pe-2 ps-4">
                  <h2 id={id('title')} className="min-w-0 truncate text-sm">
                    <span className="font-medium">{t('dash.docs.section', { n })}</span>
                    {section.heading.trim() ? (
                      <span className="text-muted-foreground"> · {section.heading.trim()}</span>
                    ) : null}
                  </h2>
                  <div className="flex shrink-0 items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      disabled={index === 0}
                      aria-label={t('dash.docs.moveUp', { n })}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      disabled={index === form.length - 1}
                      aria-label={t('dash.docs.moveDown', { n })}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 text-muted-foreground hover:text-destructive"
                      aria-label={t('dash.docs.remove', { n })}
                      onClick={() => remove(section.id)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </header>

                <div className="space-y-4 p-4">
                  <Field label={t('dash.docs.heading')} htmlFor={id('heading')} required>
                    <Input
                      id={id('heading')}
                      dir="rtl"
                      lang="ar"
                      value={section.heading}
                      onChange={(event) => update(section.id, { heading: event.target.value })}
                    />
                  </Field>
                  <Field label={t('dash.docs.paragraphs')} htmlFor={id('body')} hint={t('dash.docs.paragraphsHint')}>
                    <Textarea
                      id={id('body')}
                      dir="rtl"
                      lang="ar"
                      rows={rowsFor(section.body, 4)}
                      className="font-serif text-base leading-[1.85] [field-sizing:content]"
                      value={section.body}
                      onChange={(event) => update(section.id, { body: event.target.value })}
                    />
                  </Field>
                  {lists ? (
                    <Field label={t('dash.docs.list')} htmlFor={id('list')} hint={t('dash.docs.listHint')}>
                      <Textarea
                        id={id('list')}
                        dir="rtl"
                        lang="ar"
                        rows={rowsFor(section.list, 2)}
                        className="font-serif text-base leading-[1.85] [field-sizing:content]"
                        value={section.list}
                        onChange={(event) => update(section.id, { list: event.target.value })}
                      />
                    </Field>
                  ) : null}

                  <details
                    open={englishShown}
                    onToggle={(event) => toggleEnglish(section.id, event.currentTarget.open)}
                    className="group rounded-md border border-border/60"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-hover ease-lens hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
                      <span>{t('dash.docs.english')}</span>
                      {missingEnglish ? (
                        <Badge variant="warning">{t('dash.docs.untranslated')}</Badge>
                      ) : null}
                    </summary>
                    <div className="space-y-4 border-t border-border/60 p-3">
                      <p className="text-xs text-muted-foreground">{t('dash.docs.englishHint')}</p>
                      <Field label={t('dash.docs.headingEn')} htmlFor={id('heading-en')}>
                        <Input
                          id={id('heading-en')}
                          dir="ltr"
                          lang="en"
                          value={section.headingEn}
                          onChange={(event) => update(section.id, { headingEn: event.target.value })}
                        />
                      </Field>
                      <Field label={t('dash.docs.paragraphsEn')} htmlFor={id('body-en')} hint={t('dash.docs.paragraphsHint')}>
                        <Textarea
                          id={id('body-en')}
                          dir="ltr"
                          lang="en"
                          rows={rowsFor(section.bodyEn, 4)}
                          className="font-serif text-base leading-[1.75] [field-sizing:content]"
                          value={section.bodyEn}
                          onChange={(event) => update(section.id, { bodyEn: event.target.value })}
                        />
                      </Field>
                      {lists ? (
                        <Field label={t('dash.docs.listEn')} htmlFor={id('list-en')} hint={t('dash.docs.listHint')}>
                          <Textarea
                            id={id('list-en')}
                            dir="ltr"
                            lang="en"
                            rows={rowsFor(section.listEn, 2)}
                            className="font-serif text-base leading-[1.75] [field-sizing:content]"
                            value={section.listEn}
                            onChange={(event) => update(section.id, { listEn: event.target.value })}
                          />
                        </Field>
                      ) : null}
                    </div>
                  </details>
                </div>
              </section>
            )
          })}

          <Button type="button" variant="outline" onClick={add} className="w-full border-dashed">
            <Plus className="size-4" aria-hidden />
            {t('dash.docs.addSection')}
          </Button>

          {/* Once there is something to publish, the bar rides the bottom of
              the editor while it scrolls, so the one action on this screen is
              never twenty sections away. With nothing to publish it stays put
              at the end — on a phone it would otherwise hold a quarter of the
              screen to show a disabled button. */}
          <div
            className={cn(
              'z-10 space-y-2.5 rounded-lg border bg-background/95 p-3 shadow-soft backdrop-blur supports-[backdrop-filter]:bg-background/85',
              (dirty || error) && 'sticky bottom-0',
            )}
          >
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t('dash.docs.note')} htmlFor={`doc-note-${docKey}`} className="min-w-48 flex-1 space-y-1.5">
                <Input
                  id={`doc-note-${docKey}`}
                  maxLength={200}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                disabled={!dirty || pending}
                onClick={() => {
                  if (!window.confirm(t('dash.docs.discardConfirm'))) return
                  writeDraft(docKey, null)
                  load(live.sections)
                }}
              >
                {t('dash.docs.discard')}
              </Button>
              <Button type="button" disabled={!dirty || pending} onClick={publish}>
                {pending ? <Spinner className="size-4 text-current" /> : null}
                {t('dash.docs.publish')}
              </Button>
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground" aria-live="polite">
              <span aria-hidden className={cn('size-2 rounded-full', dirty ? 'bg-warning' : 'bg-border')} />
              <span className={cn(dirty && 'text-foreground')}>
                {dirty ? t('dash.docs.unsaved') : t('dash.docs.noChanges')}
              </span>
              {dated ? <span>· {t('dash.docs.effectiveNote')}</span> : null}
            </p>
          </div>
        </div>

        {/* ── Preview ────────────────────────────────────────────────────── */}
        <aside
          aria-labelledby={`doc-preview-${docKey}`}
          className={cn(
            'min-w-0 rounded-lg border bg-background lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto',
            pane === 'edit' && 'hidden lg:block',
          )}
        >
          <div className="z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-2.5 lg:sticky lg:top-0">
            <div>
              <h2 id={`doc-preview-${docKey}`} className="text-sm font-medium">
                {t('dash.docs.preview')}
              </h2>
              <p className="text-xs text-muted-foreground">{t('dash.docs.previewHint')}</p>
            </div>
            <div role="group" aria-label={t('dash.docs.previewLanguage')} className="flex gap-1 rounded-md border p-0.5">
              {(['ar', 'en'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={previewLocale === value}
                  onClick={() => setPreviewLocale(value)}
                  className={cn(
                    'h-8 rounded-sm px-3 text-xs font-medium transition-colors duration-hover ease-lens',
                    previewLocale === value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {value === 'ar' ? t('dash.docs.arabic') : t('dash.docs.english')}
                </button>
              ))}
            </div>
          </div>
          <div dir={previewDir} lang={previewLocale} className="px-5 py-8 sm:px-8">
            <p className="font-display text-3xl font-bold">{titles[previewLocale]}</p>
            <DocumentBody
              sections={sections}
              locale={previewLocale}
              variant={lists ? 'page' : 'guide'}
              className="mt-8 max-w-[62ch]"
            />
          </div>
        </aside>
      </div>

      {/* ── History ──────────────────────────────────────────────────────── */}
      <Panel title={t('dash.docs.history')}>
        <p className="mb-4 text-sm text-muted-foreground">
          {versions.length ? t('dash.docs.historyHint') : t('dash.docs.noHistory')}
        </p>
        <ul className="-mb-2 divide-y divide-border/60">
          {versions.map((version) => (
            <HistoryRow
              key={version.id}
              title={version.date}
              numeric
              detail={[version.publishedBy ? t('dash.docs.by', { name: version.publishedBy }) : null, version.restored, version.note]
                .filter(Boolean)
                .join(' · ')}
              live={version.id === liveId}
              disabled={pending}
              onOpen={() => load(version.sections, t('dash.docs.opened'))}
              onRestore={() => restore(version.id)}
            />
          ))}
          <HistoryRow
            title={t('dash.docs.original')}
            detail={t('dash.docs.originalRowHint')}
            live={liveId === null}
            disabled={pending}
            onOpen={() => load(original, t('dash.docs.opened'))}
            onRestore={() => restore('code-default')}
          />
        </ul>
      </Panel>
    </div>
  )
}

function HistoryRow({
  title,
  numeric = false,
  detail,
  live,
  disabled,
  onOpen,
  onRestore,
}: {
  title: string
  numeric?: boolean
  detail: string
  live: boolean
  disabled: boolean
  onOpen: () => void
  onRestore: () => void
}) {
  const t = useT()
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <span className={cn(numeric && 'numeric')}>{title}</span>
          {live ? <Badge variant="success">{t('dash.docs.live')}</Badge> : null}
        </p>
        {detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onOpen} disabled={disabled}>
          {t('dash.docs.openInEditor')}
        </Button>
        {live ? null : (
          <Button type="button" variant="outline" size="sm" onClick={onRestore} disabled={disabled}>
            <RotateCcw className="size-3.5" aria-hidden />
            {t('dash.docs.restore')}
          </Button>
        )}
      </div>
    </li>
  )
}
