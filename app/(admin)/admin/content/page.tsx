import type { Metadata } from 'next'
import { ExternalLink, PencilLine } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { Anchor } from '@/components/ui/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { DOCUMENT_KEYS, DOCUMENTS } from '@/lib/editable-documents'
import { COPY_GROUP_KEYS, COPY_GROUPS, groupKeys, groupPrefixes } from '@/lib/copy-rules'
import { copyGroupStats } from '@/lib/copy-overrides'
import { formatDate, formatNumber, t } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'
import { cn } from '@/lib/utils'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return { title: t('dash.docs.title') }
}

/**
 * `/admin/content` — the words the owner edits: site copy (landing, `/sell`,
 * emails — DEV-64b) and the long-form pages (DEV-64a).
 *
 * Six fixed rows, one per page, each saying what the site shows right now:
 * the original text from the code, or the newest published version with its
 * date and publisher. The row opens the editor with a plain anchor — a row
 * that opens the thing to work on is the navigation CLAUDE.md says must not
 * be a soft client push.
 */
export default async function AdminContentPage() {
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

  const [latest, counts] = await Promise.all([
    db.documentVersion.findMany({
      distinct: ['docKey'],
      orderBy: [{ docKey: 'asc' }, { publishedAt: 'desc' }],
      select: { docKey: true, publishedAt: true, publishedById: true, note: true },
    }),
    db.documentVersion.groupBy({ by: ['docKey'], _count: { _all: true } }),
  ])
  const publisherIds = [
    ...new Set(latest.map((row) => row.publishedById).filter(Boolean)),
  ] as string[]
  const publishers = publisherIds.length
    ? await db.user.findMany({
        where: { id: { in: publisherIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const who = new Map(publishers.map((u) => [u.id, u.name || u.email]))
  const copyStats = await Promise.all(
    COPY_GROUP_KEYS.map(async (group) => ({
      group,
      total: groupKeys(group).length,
      ...(await copyGroupStats(groupPrefixes(group))),
    })),
  )
  const byKey = new Map(latest.map((row) => [row.docKey, row]))
  const countByKey = new Map(counts.map((row) => [row.docKey, row._count._all]))

  return (
    <>
      <DashboardHeader title={t('dash.docs.title')} description={t('dash.docs.hint')} />

      <div className="space-y-6">
        <Panel title={t('dash.copy.sectionCopy')}>
          <p className="-mt-1 mb-2 text-sm text-muted-foreground">
            {t('dash.copy.sectionCopyHint')}
          </p>
          <ul className="-mb-2 divide-y divide-border/60">
            {copyStats.map(({ group, total, edited, last }) => (
              <li
                key={group}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4"
              >
                <div className="min-w-0 space-y-1">
                  <h3 className="flex flex-wrap items-center gap-2 font-medium">
                    <Anchor
                      href={`/admin/content/copy/${group}`}
                      className="transition-colors duration-hover ease-lens hover:text-gold"
                    >
                      {t(COPY_GROUPS[group].titleKey)}
                    </Anchor>
                    {edited ? (
                      <Badge variant="success">
                        {t('dash.copy.modified', { count: formatNumber(edited) })}
                      </Badge>
                    ) : null}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {[
                      t('dash.copy.strings', { count: formatNumber(total) }),
                      last
                        ? t('dash.copy.lastPublished', { date: formatDate(last) })
                        : t('dash.copy.neverEdited'),
                    ].join(' · ')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {COPY_GROUPS[group].path ? (
                    <Anchor
                      href={COPY_GROUPS[group].path}
                      target="_blank"
                      rel="noopener"
                      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                    >
                      <ExternalLink className="size-3.5" aria-hidden />
                      {t('dash.docs.view')}
                      <span className="sr-only">
                        {t(COPY_GROUPS[group].titleKey)} {t('dash.docs.viewNewTab')}
                      </span>
                    </Anchor>
                  ) : null}
                  <Anchor
                    href={`/admin/content/copy/${group}`}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    <PencilLine className="size-3.5" aria-hidden />
                    {t('dash.docs.edit')}
                    <span className="sr-only">{t(COPY_GROUPS[group].titleKey)}</span>
                  </Anchor>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={t('dash.copy.sectionPages')}>
          <ul className="-my-2 divide-y divide-border/60">
            {DOCUMENT_KEYS.map((key) => {
              const definition = DOCUMENTS[key]
              const version = byKey.get(key)
              const count = countByKey.get(key) ?? 0
              const publisher = version?.publishedById ? who.get(version.publishedById) : null

              return (
                <li
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4"
                >
                  <div className="min-w-0 space-y-1">
                    <h3 className="flex flex-wrap items-center gap-2 font-medium">
                      <Anchor
                        href={`/admin/content/${key}`}
                        className="transition-colors duration-hover ease-lens hover:text-gold"
                      >
                        {t(definition.titleKey)}
                      </Anchor>
                      {version ? (
                        <Badge variant="success">
                          {t('dash.docs.publishedOn', { date: formatDate(version.publishedAt) })}
                        </Badge>
                      ) : (
                        <Badge variant="neutral">{t('dash.docs.original')}</Badge>
                      )}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      <span className="ltr-island" dir="ltr">
                        {definition.path}
                      </span>
                      {' · '}
                      {version
                        ? [
                            publisher ? t('dash.docs.by', { name: publisher }) : null,
                            version.note,
                            t('dash.docs.versions', { count: formatNumber(count) }),
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        : t('dash.docs.originalHint')}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Anchor
                      href={definition.path}
                      target="_blank"
                      rel="noopener"
                      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                    >
                      <ExternalLink className="size-3.5" aria-hidden />
                      {t('dash.docs.view')}
                      <span className="sr-only">
                        {t(definition.titleKey)} {t('dash.docs.viewNewTab')}
                      </span>
                    </Anchor>
                    <Anchor
                      href={`/admin/content/${key}`}
                      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                    >
                      <PencilLine className="size-3.5" aria-hidden />
                      {t('dash.docs.edit')}
                      <span className="sr-only">{t(definition.titleKey)}</span>
                    </Anchor>
                  </div>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>
    </>
  )
}
