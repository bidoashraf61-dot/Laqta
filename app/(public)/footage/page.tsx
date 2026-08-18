import type { Metadata } from 'next'
import { Link } from '@/components/ui/link'
import { auth } from '@/lib/auth'
import { search, logSearch, type ClipFilters } from '@/lib/search'
import { InfiniteClips } from '@/components/catalogue/infinite-clips'
import { FilterRail } from '@/components/catalogue/filter-rail'
import { EmptyState } from '@/components/ui/state'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'
import { requestLocale } from '@/lib/locale-request'
import { localeAlternates } from '@/lib/locale'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    alternates: localeAlternates('/footage'),
    title: t('catalogue.footageTitle'),
    description: t('catalogue.footageSubtitle'),
  }
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

    minDurationS: one('dmin') ? Number(one('dmin')) : undefined,
    maxDurationS: one('dmax') ? Number(one('dmax')) : undefined,
    hasPeople: people === '1' ? true : people === '0' ? false : undefined,
    origin:
      one('origin') === 'generated'
        ? 'generated'
        : one('origin') === 'captured'
          ? 'captured'
          : undefined,
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
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const params = await searchParams
  const filters = toFilters(params)

  // Exactly what the reader is looking at, minus the page cursor, so the
  // client can ask for page 2 of the same query without rebuilding it.
  const queryString = (() => {
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value == null || key === 'page') continue
      next.set(key, Array.isArray(value) ? value[0] : value)
    }
    return next.toString()
  })()
  const [result, session] = await Promise.all([search(filters), auth()])

  // Logged after the fact, and never awaited into the critical path in a way
  // that could fail the page — the zero-result report this feeds is the
  // content-acquisition roadmap.
  await logSearch(filters, result.total, { userId: session?.user?.id ?? null })

  return (
    <div className="container py-10">
      <header className="mb-6 space-y-1">
        <PageTitle>{t('catalogue.footageTitle')}</PageTitle>
        <p className="text-muted-foreground">{t('catalogue.footageSubtitle')}</p>
      </header>

      <div className="flex gap-8">
        <FilterRail />

        <div className="min-w-0 flex-1">
          {/*
            No result count.

            «١٬٤٠٤ لقطة» answered a question nobody browsing a stock library
            asks, and answered it badly: the number changes with every filter,
            so it read as a score for the search rather than as a fact about the
            catalogue — and a small number after a narrow filter reads as a thin
            library rather than as a precise result.
          */}
          <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
            <SortLinks params={params} />
          </div>

          {result.hits.length === 0 ? (
            <EmptyState
              title={t('catalogue.noResultsTitle')}
              description={t('catalogue.noResultsBody')}
            />
          ) : (
            /*
              Server-rendered first page, appended to by scrolling.

              The grid is complete in the HTML for a crawler and for anyone
              without JavaScript; InfiniteClips only ever adds to it. Paging
              made browsing a click every twenty-four shots, and each click
              threw away scroll position and re-rendered the whole rail.
            */
            <InfiniteClips
              initial={result.hits}
              total={result.total}
              perPage={result.perPage}
              query={queryString}
            />
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
        <Button key={value} asChild variant={current === value ? 'secondary' : 'ghost'} size="sm">
          <Link href={buildHref(params, { sort: value, page: null })}>{label}</Link>
        </Button>
      ))}
    </nav>
  )
}
