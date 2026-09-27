import { isOccasion } from '@/lib/occasions'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/state'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { FilterChips, SearchBox, Toolbar } from '@/components/dashboard/toolbar'
import { ActionButton } from '@/components/dashboard/form'
import { TaxonomyEditor, type ParentOption } from '@/components/admin/taxonomy-editor'
import { toggleTaxonomyActive } from '@/app/(admin)/admin/actions'
import { countOf, t } from '@/lib/i18n'
import { UserText } from '@/components/ui/bilingual'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('admin.taxonomyEditor'),
  }
}

const KINDS = ['category', 'location', 'tag', 'theme'] as const

const KIND_LABEL: Record<string, string> = {
  category: 'dash.kindCategory',
  location: 'dash.kindLocation',
  tag: 'dash.kindTag',
  theme: 'dash.kindTheme',
}

/**
 * Taxonomy editor.
 *
 * One table discriminated by `kind`, so categories, locations, tags and themes
 * are managed in one place and the synonym layer that feeds search has a
 * single surface. Terms are deactivated rather than deleted — a term with
 * albums attached would take the attachments with it, and a location that
 * quietly vanishes breaks every bookmarked URL pointing at it.
 */
export default async function AdminTaxonomyPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>
}) {
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
  const { q, kind } = await searchParams

  const where: Prisma.TaxonomyWhereInput = {
    ...(kind && (KINDS as readonly string[]).includes(kind)
      ? { kind: kind as Prisma.EnumTaxonomyKindFilter['equals'] }
      : {}),
    ...(q
      ? {
          OR: [
            { nameAr: { contains: q, mode: 'insensitive' } },
            { nameEn: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [terms, counts, parentRows] = await Promise.all([
    db.taxonomy.findMany({
      where,
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { nameAr: 'asc' }],
      take: 300,
      include: {
        parent: { select: { nameAr: true } },
        _count: { select: { albums: true, clips: true } },
      },
    }),
    db.taxonomy.groupBy({ by: ['kind'], _count: { kind: true } }),
    db.taxonomy.findMany({
      where: { parentId: null },
      orderBy: [{ kind: 'asc' }, { nameAr: 'asc' }],
      select: { id: true, nameAr: true, kind: true },
    }),
  ])

  const byKind = new Map(counts.map((row) => [row.kind, row._count.kind]))
  const parents: ParentOption[] = parentRows

  return (
    <>
      <DashboardHeader
        title={t('dash.taxonomyTitle')}
        description={t('dash.taxonomyHint')}
        action={<TaxonomyEditor parents={parents} trigger="add" />}
      />

      <Toolbar>
        <SearchBox placeholder={t('actions.search')} />
        <FilterChips
          param="kind"
          options={KINDS.map((value) => ({
            value,
            label: t(KIND_LABEL[value]),
            count: byKind.get(value) ?? 0,
          }))}
        />
      </Toolbar>

      {terms.length === 0 ? (
        <EmptyState title={t('dash.noTerms')} description={t('dash.taxonomyHint')} />
      ) : (
        <div className="space-y-2">
          {terms.map((term) => (
            <Panel key={term.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 font-medium">
                    <UserText>{term.nameAr}</UserText>
                    <span className="ltr-island text-xs font-normal text-muted-foreground">
                      {term.nameEn}
                    </span>
                    <Badge variant="neutral">{t(KIND_LABEL[term.kind] ?? term.kind)}</Badge>
                    {term.isActive ? null : (
                      <Badge variant="warning">{t('dash.slotInactive')}</Badge>
                    )}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="ltr-island">/{term.slug}</span>
                    {term.parent ? ` · ${term.parent.nameAr}` : ''}
                    {' · '}
                    {countOf('album', term._count.albums)}
                  </p>

                  {term.synonymsAr.length > 0 || term.synonymsEn.length > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      <span className="text-foreground/70">{t('dash.termSynonyms')}: </span>
                      <UserText>{term.synonymsAr.join('، ')}</UserText>
                      {term.synonymsAr.length > 0 && term.synonymsEn.length > 0 ? ' · ' : ''}
                      <span className="ltr-island">{term.synonymsEn.join(', ')}</span>
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {/* The page text of a hub (DEV-41). A plain anchor — the
                      client router has swallowed navigations on this page. */}
                  {term.kind === 'location' || term.kind === 'category' || (term.kind === 'theme' && isOccasion(term.slug)) ? (
                    <a
                      href={`/admin/taxonomy/${term.id}`}
                      className="inline-flex h-8 items-center rounded-md px-3 text-sm underline-offset-4 hover:underline"
                    >
                      {t('dash.hubPageLink')}
                    </a>
                  ) : null}
                  <ActionButton
                    action={toggleTaxonomyActive.bind(null, term.id, !term.isActive)}
                    label={term.isActive ? t('dash.slotInactive') : t('dash.slotActive')}
                  />
                </div>
              </div>

              <TaxonomyEditor
                parents={parents}
                term={{
                  id: term.id,
                  kind: term.kind,
                  slug: term.slug,
                  nameAr: term.nameAr,
                  nameEn: term.nameEn,
                  synonymsAr: term.synonymsAr,
                  synonymsEn: term.synonymsEn,
                  parentId: term.parentId,
                  sortOrder: term.sortOrder,
                  isActive: term.isActive,
                }}
              />
            </Panel>
          ))}
        </div>
      )}
    </>
  )
}
