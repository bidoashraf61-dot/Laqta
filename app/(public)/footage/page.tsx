import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { search, logSearch, type ClipFilters } from '@/lib/search'
import { ClipCard } from '@/components/catalogue/clip-card'
import { FilterRail } from '@/components/catalogue/filter-rail'
import { EmptyState } from '@/components/ui/state'
import { Button } from '@/components/ui/button'
import { formatNumber, t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'

export const metadata: Metadata = {
  title: t('catalogue.footageTitle'),
  description: t('catalogue.footageSubtitle'),
}

type SearchParams = Record<string, string | string[] | undefined>

/** URL is the source of truth for the whole result set — see FilterRail. */
function toFilters(params: SearchParams): ClipFilters {
  const one = (key: string) => {
    const value = params[key]
    return Array.isArray(value) ? value[0] : value
  }
  const people = one('people')

  return {
    q: one('q'),
    location: one('location'),
    category: one('category'),
    tags: params.tag ? (Array.isArray(params.tag) ? params.tag : [params.tag]) : undefined,
    minWidth: one('minWidth') ? Number(one('minWidth')) : undefined,
    aspectRatio: one('aspect'),
    colourProfile: one('colour'),
    cameraMovement: one('movement'),
    shotSize: one('shot'),
    timeOfDay: one('time'),
    fps: one('fps') ? Number(one('fps')) : undefined,
    hasPeople: people === '1' ? true : people === '0' ? false : undefined,
    identifiableFaces: one('faces') === '1' ? true : undefined,
    clearedForCommercial: one('cleared') === '1',
    editorialOnly: one('editorial') === '1',
    creator: one('creator'),
    sort: (one('sort') as ClipFilters['sort']) ?? 'relevance',
    page: one('page') ? Number(one('page')) : 1,
  }
}

export default async function FootagePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const filters = toFilters(params)
  const [result, session] = await Promise.all([search(filters), auth()])

  // Logged after the fact, and never awaited into the critical path in a way
  // that could fail the page — the zero-result report this feeds is the
  // content-acquisition roadmap.
  await logSearch(filters, result.total, { userId: session?.user?.id ?? null })

  const totalPages = Math.max(1, Math.ceil(result.total / result.perPage))

  return (
    <div className="container py-10">
      <header className="mb-6 space-y-1">
        <PageTitle>{t('catalogue.footageTitle')}</PageTitle>
        <p className="text-muted-foreground">{t('catalogue.footageSubtitle')}</p>
      </header>

      <div className="flex gap-8">
        <FilterRail />

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {t('catalogue.resultsCount', { count: formatNumber(result.total) })}
            </p>
            <SortLinks params={params} />
          </div>

          {result.hits.length === 0 ? (
            <EmptyState
              title={t('catalogue.noResultsTitle')}
              description={t('catalogue.noResultsBody')}
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {result.hits.map((clip) => (
                  <ClipCard key={clip.id} clip={clip} />
                ))}
              </div>

              {totalPages > 1 ? (
                <Pagination page={result.page} totalPages={totalPages} params={params} />
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function buildHref(params: SearchParams, overrides: Record<string, string | null>) {
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    next.set(key, Array.isArray(value) ? value[0] : value)
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) next.delete(key)
    else next.set(key, value)
  }
  const query = next.toString()
  return `/footage${query ? `?${query}` : ''}`
}

function SortLinks({ params }: { params: SearchParams }) {
  const current = (Array.isArray(params.sort) ? params.sort[0] : params.sort) ?? 'relevance'
  const options = [
    ['relevance', t('catalogue.sortRelevance')],
    ['newest', t('catalogue.sortNewest')],
    ['popular', t('catalogue.sortPopular')],
    ['priceAsc', t('catalogue.sortPriceAsc')],
    ['priceDesc', t('catalogue.sortPriceDesc')],
  ] as const

  return (
    <nav className="flex flex-wrap gap-1" aria-label={t('catalogue.sort')}>
      {options.map(([value, label]) => (
        <Button
          key={value}
          asChild
          variant={current === value ? 'secondary' : 'ghost'}
          size="sm"
        >
          <Link href={buildHref(params, { sort: value, page: null })}>{label}</Link>
        </Button>
      ))}
    </nav>
  )
}

function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number
  totalPages: number
  params: SearchParams
}) {
  return (
    <nav className="mt-8 flex items-center justify-center gap-3" aria-label={t('catalogue.page')}>
      <Button asChild variant="outline" size="sm" disabled={page <= 1}>
        <Link href={buildHref(params, { page: String(Math.max(1, page - 1)) })}>
          {t('catalogue.previous')}
        </Link>
      </Button>
      <span className="numeric text-sm text-muted-foreground">
        {page} / {totalPages}
      </span>
      <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
        <Link href={buildHref(params, { page: String(Math.min(totalPages, page + 1)) })}>
          {t('catalogue.next')}
        </Link>
      </Button>
    </nav>
  )
}
