import { NextResponse, type NextRequest } from 'next/server'
import { search, type ClipFilters } from '@/lib/search'

/**
 * One page of search results, for the infinite grid.
 *
 * ── Why a route handler and not a server action ─────────────────────────────
 * A server action is a POST that returns an RSC payload; this needs to be a
 * plain cacheable GET whose URL carries the whole query, because the filter
 * state already lives in the URL and the browser can then reuse a page it has
 * already fetched when someone scrolls back up.
 *
 * The filter parsing deliberately mirrors the page's own `toFilters`. It is
 * duplicated rather than shared because the two read from different shapes —
 * `URLSearchParams` here, Next's resolved `searchParams` there — and a shared
 * helper would have to accept both and be worse at each.
 *
 * Nothing here can widen what a visitor may see: `search()` restricts to live
 * albums and never selects a master key, and this passes no privileged flag.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const one = (key: string) => params.get(key) ?? undefined

  const people = one('people')
  const origin = one('origin')

  const filters: ClipFilters = {
    q: one('q'),
    minWidth: one('minWidth') ? Number(one('minWidth')) : undefined,
    aspectRatio: one('aspect'),
    cameraMovement: one('movement'),
    shotSize: one('shot'),
    timeOfDay: one('time'),
    minDurationS: one('dmin') ? Number(one('dmin')) : undefined,
    maxDurationS: one('dmax') ? Number(one('dmax')) : undefined,
    hasPeople: people === '1' ? true : people === '0' ? false : undefined,
    origin: origin === 'generated' ? 'generated' : origin === 'captured' ? 'captured' : undefined,
    creator: one('creator'),
    sort: (one('sort') as ClipFilters['sort']) ?? 'relevance',
    page: one('page') ? Number(one('page')) : 1,
  }

  const result = await search(filters)

  return NextResponse.json(
    { hits: result.hits, total: result.total, page: result.page },
    // Private: results depend on nothing user-specific today, but this is a
    // search endpoint and a shared cache in front of it would be the wrong
    // default to inherit if that ever changes.
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  )
}
