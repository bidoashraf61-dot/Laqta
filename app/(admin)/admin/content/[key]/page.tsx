import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { Anchor } from '@/components/ui/link'
import { buttonVariants } from '@/components/ui/button'
import { DashboardHeader } from '@/components/dashboard/primitives'
import { DocumentEditor, type EditorVersion } from '@/components/admin/document-editor'
import {
  CODE_DEFAULT,
  DOCUMENTS,
  isDocumentKey,
  listVersions,
  loadDocument,
} from '@/lib/editable-documents'
import { formatDateTime, t, translate } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  const { key } = await params
  if (!isDocumentKey(key)) return { title: t('dash.docs.title') }
  return { title: t('dash.docs.editTitle', { title: t(DOCUMENTS[key].titleKey) }) }
}

/**
 * `/admin/content/[key]` — edit, preview and publish one long-form page, and
 * restore any earlier version (DEV-64a). The editor is client-side; this page
 * hands it what the site shows now, the original text and the full history,
 * with dates already formatted in the reader's language.
 */
export default async function AdminDocumentPage({ params }: { params: Promise<{ key: string }> }) {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  await requireAdmin()

  const { key } = await params
  if (!isDocumentKey(key)) notFound()
  const definition = DOCUMENTS[key]

  const [live, history] = await Promise.all([loadDocument(key), listVersions(key)])
  const dates = new Map(history.map((row) => [row.id, formatDateTime(row.publishedAt)]))

  const versions: EditorVersion[] = history.map((row) => ({
    id: row.id,
    sections: row.sections,
    date: dates.get(row.id) ?? '',
    publishedBy: row.publishedBy,
    note: row.note,
    restored:
      row.restoredFromId === CODE_DEFAULT
        ? t('dash.docs.restoredOriginal')
        : row.restoredFromId
          ? t('dash.docs.restoredFrom', { date: dates.get(row.restoredFromId) ?? '—' })
          : null,
  }))
  const title = t(definition.titleKey)

  return (
    <>
      <DashboardHeader
        title={t('dash.docs.editTitle', { title })}
        description={
          live.versionId
            ? t('dash.docs.onSiteVersion', { date: dates.get(live.versionId) ?? '' })
            : t('dash.docs.onSiteOriginal')
        }
        back={{ href: '/admin/content', label: t('dash.docs.title') }}
        action={
          <Anchor
            href={definition.path}
            target="_blank"
            rel="noopener"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ExternalLink className="size-3.5" aria-hidden />
            {t('dash.docs.view')}
            <span className="sr-only">{t('dash.docs.viewNewTab')}</span>
          </Anchor>
        }
      />

      {/* Keyed by the live version: after a publish or a restore the page
          re-renders with a new live version and the editor starts clean from
          it, instead of holding the draft that was just published. */}
      <DocumentEditor
        key={live.versionId ?? CODE_DEFAULT}
        docKey={key}
        titles={{ ar: translate('ar', definition.titleKey), en: translate('en', definition.titleKey) }}
        dated={definition.dated}
        lists={definition.lists}
        live={{ versionId: live.versionId, sections: live.sections }}
        original={definition.defaults}
        versions={versions}
      />
    </>
  )
}
