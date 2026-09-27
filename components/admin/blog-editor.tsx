'use client'

import { useActionState, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/label'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Alert, AlertDescription, Spinner } from '@/components/ui/state'
import { useT } from '@/lib/i18n-client'
import { cn } from '@/lib/utils'
import { parseBody, type Block, type Inline } from '@/lib/blog-render'
import type { ActionResult } from '@/components/dashboard/form'

export type EditorPost = {
  slug: string
  status: 'draft' | 'scheduled' | 'published'
  categoryId: string | null
  titleAr: string
  titleEn: string
  excerptAr: string
  excerptEn: string
  bodyAr: string
  bodyEn: string
  coverKey: string
  seoTitleAr: string
  seoTitleEn: string
  seoDescAr: string
  seoDescEn: string
  /** `YYYY-MM-DDTHH:mm` in the operator's local time, for the datetime input. */
  publishAtLocal: string
}

/**
 * The blog editor (DEV-44): both languages, the SEO fields, a category, a
 * cover, and — beside the body — a live preview of exactly what the article
 * page will render (the same parser), in Arabic or English. «أدرج ألبوماً»
 * puts an `[[album:handle/slug]]` line at the cursor. One form, three ways to
 * save: draft, publish now, or schedule for a date.
 */
export function BlogEditor({
  post,
  categories,
  albums,
  action,
}: {
  post: EditorPost
  categories: Array<{ id: string; nameAr: string }>
  albums: Array<{ ref: string; titleAr: string }>
  action: (state: ActionResult | null, form: FormData) => Promise<ActionResult>
}) {
  const t = useT()
  const [state, formAction, pending] = useActionState(action, null)
  const [bodyAr, setBodyAr] = useState(post.bodyAr)
  const [bodyEn, setBodyEn] = useState(post.bodyEn)
  const [titleAr, setTitleAr] = useState(post.titleAr)
  const [titleEn, setTitleEn] = useState(post.titleEn)
  const [previewLang, setPreviewLang] = useState<'ar' | 'en'>('ar')
  const [embed, setEmbed] = useState(albums[0]?.ref ?? '')
  const arBody = useRef<HTMLTextAreaElement>(null)
  const enBody = useRef<HTMLTextAreaElement>(null)

  const blocks = useMemo(() => parseBody(previewLang === 'en' && bodyEn.trim() ? bodyEn : bodyAr), [previewLang, bodyAr, bodyEn])
  const albumTitle = useMemo(() => new Map(albums.map((album) => [album.ref, album.titleAr])), [albums])

  const insertAlbum = (lang: 'ar' | 'en') => {
    if (!embed) return
    const area = (lang === 'ar' ? arBody : enBody).current
    const value = lang === 'ar' ? bodyAr : bodyEn
    const at = area?.selectionStart ?? value.length
    const line = `\n\n[[album:${embed}]]\n\n`
    const next = value.slice(0, at) + line + value.slice(at)
    if (lang === 'ar') setBodyAr(next)
    else setBodyEn(next)
  }

  return (
    <form action={formAction} className="space-y-6">
      {state && !state.ok ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message ?? t('state.error')}</AlertDescription>
        </Alert>
      ) : null}
      {state?.ok ? (
        <Alert variant="success">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('dash.blogTitleAr')} htmlFor="titleAr" required>
          <Input id="titleAr" name="titleAr" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} maxLength={200} required />
        </Field>
        <Field label={t('dash.blogTitleEn')} htmlFor="titleEn">
          <Input id="titleEn" name="titleEn" dir="ltr" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} maxLength={200} />
        </Field>
        <Field label={t('dash.blogSlug')} htmlFor="slug" hint={t('dash.blogSlugHint')} required>
          <Input id="slug" name="slug" dir="ltr" defaultValue={post.slug} maxLength={80} required />
        </Field>
        <Field label={t('dash.blogCategory')} htmlFor="categoryId">
          <NativeSelect id="categoryId" name="categoryId" defaultValue={post.categoryId ?? ''}>
            <option value="">{t('dash.blogNoCategory')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.nameAr}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('dash.blogExcerptAr')} htmlFor="excerptAr" hint={t('dash.blogExcerptHint')}>
          <Textarea id="excerptAr" name="excerptAr" rows={2} defaultValue={post.excerptAr} maxLength={400} />
        </Field>
        <Field label={t('dash.blogExcerptEn')} htmlFor="excerptEn">
          <Textarea id="excerptEn" name="excerptEn" rows={2} dir="ltr" defaultValue={post.excerptEn} maxLength={400} />
        </Field>
        <Field label={t('dash.blogCover')} htmlFor="coverKey" hint={t('dash.blogCoverHint')}>
          <Input id="coverKey" name="coverKey" dir="ltr" defaultValue={post.coverKey} maxLength={300} />
        </Field>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-md border bg-card p-3">
        <Field label={t('dash.blogEmbed')} htmlFor="embed" className="min-w-64 flex-1">
          <NativeSelect id="embed" value={embed} onChange={(e) => setEmbed(e.target.value)}>
            {albums.map((album) => (
              <option key={album.ref} value={album.ref}>
                {album.titleAr}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Button type="button" size="sm" variant="outline" disabled={!embed} onClick={() => insertAlbum('ar')}>
          {t('dash.blogEmbedAr')}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={!embed} onClick={() => insertAlbum('en')}>
          {t('dash.blogEmbedEn')}
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <Field label={t('dash.blogBodyAr')} htmlFor="bodyAr" hint={t('dash.blogBodyHint')}>
            <Textarea ref={arBody} id="bodyAr" name="bodyAr" rows={18} value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} className="text-sm leading-relaxed" />
          </Field>
          <Field label={t('dash.blogBodyEn')} htmlFor="bodyEn">
            <Textarea ref={enBody} id="bodyEn" name="bodyEn" rows={10} dir="ltr" value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} className="text-sm leading-relaxed" />
          </Field>
        </div>

        <section aria-label={t('dash.blogPreview')} className="rounded-md border bg-background">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm font-medium">{t('dash.blogPreview')}</span>
            <div className="flex gap-1" role="group" aria-label={t('dash.blogPreviewLanguage')}>
              {(['ar', 'en'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  aria-pressed={previewLang === lang}
                  onClick={() => setPreviewLang(lang)}
                  className={cn('rounded-full px-3 py-1 text-xs', previewLang === lang ? 'bg-foreground text-background' : 'text-muted-foreground')}
                >
                  {lang === 'ar' ? t('email.languageAr') : t('email.languageEn')}
                </button>
              ))}
            </div>
          </div>
          <div dir={previewLang === 'en' ? 'ltr' : 'rtl'} lang={previewLang} className="max-h-[42rem] overflow-y-auto p-6">
            <h1 className="mb-6 font-display text-3xl font-bold leading-tight">
              {previewLang === 'en' && titleEn ? titleEn : titleAr}
            </h1>
            <PreviewBlocks blocks={blocks} albumTitle={albumTitle} />
          </div>
        </section>
      </div>

      <fieldset className="grid gap-4 rounded-md border p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium">{t('dash.hubPageSeo')}</legend>
        <Field label={t('dash.hubSeoTitleAr')} htmlFor="seoTitleAr" hint={t('dash.blogSeoTitleHint')}>
          <Input id="seoTitleAr" name="seoTitleAr" defaultValue={post.seoTitleAr} maxLength={70} />
        </Field>
        <Field label={t('dash.hubSeoTitleEn')} htmlFor="seoTitleEn">
          <Input id="seoTitleEn" name="seoTitleEn" dir="ltr" defaultValue={post.seoTitleEn} maxLength={70} />
        </Field>
        <Field label={t('dash.hubSeoDescAr')} htmlFor="seoDescAr" hint={t('dash.hubSeoDescHint')}>
          <Textarea id="seoDescAr" name="seoDescAr" rows={2} defaultValue={post.seoDescAr} maxLength={160} />
        </Field>
        <Field label={t('dash.hubSeoDescEn')} htmlFor="seoDescEn">
          <Textarea id="seoDescEn" name="seoDescEn" rows={2} dir="ltr" defaultValue={post.seoDescEn} maxLength={160} />
        </Field>
      </fieldset>

      <div className="flex flex-wrap items-end gap-3 border-t pt-5">
        <Button type="submit" name="intent" value="publish" variant="gold" disabled={pending}>
          {pending ? <Spinner className="size-4 text-current" /> : null}
          {post.status === 'published' ? t('dash.blogUpdate') : t('dash.blogPublishNow')}
        </Button>
        <Button type="submit" name="intent" value="draft" variant="outline" disabled={pending}>
          {post.status === 'draft' ? t('dash.blogSaveDraft') : t('dash.blogUnpublish')}
        </Button>
        <div className="flex items-end gap-2">
          <Field label={t('dash.blogScheduleAt')} htmlFor="publishAt">
            <Input id="publishAt" name="publishAt" type="datetime-local" dir="ltr" defaultValue={post.status === 'scheduled' ? post.publishAtLocal : ''} />
          </Field>
          <Button type="submit" name="intent" value="schedule" variant="ghost" disabled={pending}>
            {t('dash.blogSchedule')}
          </Button>
        </div>
      </div>
    </form>
  )
}

function PreviewBlocks({ blocks, albumTitle }: { blocks: Block[]; albumTitle: Map<string, string> }) {
  const t = useT()
  const inline = (parts: Inline[]) =>
    parts.map((part, i) =>
      part.kind === 'bold' ? (
        <strong key={i}>{part.text}</strong>
      ) : part.kind === 'link' ? (
        <span key={i} className="underline underline-offset-4">
          {part.text}
        </span>
      ) : (
        <span key={i}>{part.text}</span>
      ),
    )
  if (blocks.length === 0) return <p className="text-sm text-muted-foreground">{t('dash.blogPreviewEmpty')}</p>
  return (
    <div className="space-y-4 font-serif leading-[1.9]">
      {blocks.map((block, i) =>
        block.kind === 'h2' ? (
          <h2 key={i} className="pt-4 font-display text-xl font-bold">{block.text}</h2>
        ) : block.kind === 'h3' ? (
          <h3 key={i} className="pt-2 font-sans font-bold">{block.text}</h3>
        ) : block.kind === 'list' ? (
          <ul key={i} className="list-disc space-y-1 ps-6">
            {block.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </ul>
        ) : block.kind === 'quote' ? (
          <blockquote key={i} className="border-s-2 border-foreground/20 ps-4 text-foreground/70">{inline(block.inline)}</blockquote>
        ) : block.kind === 'album' ? (
          <div key={i} className="rounded-md border border-dashed p-4 font-sans text-sm">
            {t('dash.blogEmbedPreview')}{' '}
            <strong>{albumTitle.get(`${block.handle}/${block.slug}`) ?? `${block.handle}/${block.slug}`}</strong>
            {albumTitle.has(`${block.handle}/${block.slug}`) ? null : (
              <span className="ms-2 text-destructive">{t('dash.blogEmbedMissing')}</span>
            )}
          </div>
        ) : (
          <p key={i}>{inline(block.inline)}</p>
        ),
      )}
    </div>
  )
}
