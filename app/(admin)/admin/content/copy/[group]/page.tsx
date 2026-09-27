import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { Anchor } from '@/components/ui/link'
import { buttonVariants } from '@/components/ui/button'
import { DashboardHeader } from '@/components/dashboard/primitives'
import { CopyEditor, type CopyRow, type EditorBatch } from '@/components/admin/copy-editor'
import { COPY_GROUPS, defaultCopy, groupKeys, isCopyGroup, lengthCap, placeholders } from '@/lib/copy-rules'
import { groupOverrides, listCopyBatches } from '@/lib/copy-overrides'
import { TEMPLATES } from '@/emails/registry'
import { formatDateTime, t } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata({ params }: { params: Promise<{ group: string }> }): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  const { group } = await params
  if (!isCopyGroup(group)) return { title: t('dash.docs.title') }
  return { title: t('dash.copy.editTitle', { title: t(COPY_GROUPS[group].titleKey) }) }
}

/**
 * `/admin/content/copy/[group]` — edit the landing, `/sell` or email copy
 * (DEV-64b). Every string of the group with its original, its published edit
 * and the rules it must meet; the editor itself is client-side.
 */
export default async function AdminCopyPage({ params }: { params: Promise<{ group: string }> }) {
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

  const { group } = await params
  if (!isCopyGroup(group)) notFound()
  const definition = COPY_GROUPS[group]

  const [published, batches] = await Promise.all([
    groupOverrides(definition.prefix),
    listCopyBatches(definition.prefix),
  ])

  const rows: CopyRow[] = groupKeys(group).map((key) => ({
    key,
    ar: {
      original: defaultCopy('ar', key),
      published: published[`ar:${key}`] ?? null,
      cap: lengthCap('ar', key),
      placeholders: placeholders(defaultCopy('ar', key)),
    },
    en: {
      original: defaultCopy('en', key),
      published: published[`en:${key}`] ?? null,
      cap: lengthCap('en', key),
      placeholders: placeholders(defaultCopy('en', key)),
    },
  }))

  const dates = new Map(batches.map((b) => [b.batchId, formatDateTime(b.publishedAt)]))
  const history: EditorBatch[] = batches.map((batch) => ({
    batchId: batch.batchId,
    date: dates.get(batch.batchId) ?? '',
    publishedBy: batch.publishedBy,
    note: batch.note,
    undoOf: batch.restoredFromBatchId
      ? t('dash.copy.undoOf', { date: dates.get(batch.restoredFromBatchId) ?? '—' })
      : null,
    changes: batch.changes.filter((c) => c.key.startsWith(definition.prefix)),
  }))

  const title = t(definition.titleKey)

  return (
    <>
      <DashboardHeader
        title={t('dash.copy.editTitle', { title })}
        description={t('dash.copy.editHint')}
        back={{ href: '/admin/content', label: t('dash.docs.title') }}
        action={
          definition.path ? (
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
          ) : undefined
        }
      />

      {/* Keyed by the newest publish so the editor starts clean from what is
          live after a publish or an undo. */}
      <CopyEditor
        key={batches[0]?.batchId ?? 'original'}
        group={group}
        path={definition.path}
        rows={rows}
        history={history}
        templates={group === 'email' ? [...TEMPLATES] : []}
      />
    </>
  )
}
