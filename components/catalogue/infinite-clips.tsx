'use client'

import * as React from 'react'
import { ClipCard } from '@/components/catalogue/clip-card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/state'
import type { ClipHit } from '@/lib/search'
import { useT } from '@/lib/i18n-client'

/**
 * The results grid, extended by scrolling rather than by paging.
 *
 * ── Why infinite scroll here and not everywhere ─────────────────────────────
 * Browsing footage is a scanning task, not a lookup: nobody wants "page 4 of
 * 12" of a stock library, they want to keep going until something catches
 * their eye. Paging made that a click every twenty-four shots, and each click
 * threw away scroll position and re-rendered the rail.
 *
 * It is the wrong pattern for anything a person needs to return to a specific
 * position in — an order history, a review queue — which is why it lives here
 * and not in the dashboards.
 *
 * ── The two things infinite scroll usually breaks, and how they are handled ─
 * **The footer becomes unreachable.** Loading is triggered by a sentinel a
 * screen ABOVE the end rather than at it, and there is a real button as well,
 * so a reader who wants the footer can stop feeding the list and walk past it.
 *
 * **Keyboard and screen-reader users get stranded**, because scrolling is not
 * how they move. The button is not a fallback for them, it is the primary
 * control — the observer just presses it early for people who are scrolling.
 *
 * The first page is server-rendered and passed in, so the grid is complete for
 * a crawler and for anyone without JavaScript; this only ever appends.
 */
export function InfiniteClips({
  initial,
  total,
  perPage,
  query,
}: {
  initial: ClipHit[]
  total: number
  perPage: number
  /** The current filter state, forwarded verbatim to the load endpoint. */
  query: string
}) {
  const t = useT()

  const [hits, setHits] = React.useState(initial)
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  const sentinel = React.useRef<HTMLDivElement>(null)
  const done = hits.length >= total

  // A filter change re-renders this component with new `initial` data; without
  // this the old results would stay on screen under the new query.
  React.useEffect(() => {
    setHits(initial)
    setPage(1)
    setFailed(false)
  }, [initial, query])

  const loadMore = React.useCallback(async () => {
    if (loading || done) return
    setLoading(true)
    setFailed(false)
    try {
      const next = page + 1
      const params = new URLSearchParams(query)
      params.set('page', String(next))
      const response = await fetch(`/api/footage?${params.toString()}`)
      if (!response.ok) throw new Error(String(response.status))
      const data = (await response.json()) as { hits: ClipHit[] }
      // Append rather than replace, and de-duplicate: a row inserted between
      // two requests shifts the offset and can repeat a clip across pages,
      // which React then flags as a duplicate key.
      setHits((current) => {
        const seen = new Set(current.map((hit) => hit.id))
        return [...current, ...data.hits.filter((hit) => !seen.has(hit.id))]
      })
      setPage(next)
    } catch {
      // Say so and offer the button again. A silent failure at the bottom of
      // an infinite list is indistinguishable from having reached the end.
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [done, loading, page, query])

  React.useEffect(() => {
    const node = sentinel.current
    if (!node || done || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore()
      },
      // A screen early, so the next page is usually already there by the time
      // the reader arrives at the bottom.
      { rootMargin: '0px 0px 100% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [done, loadMore])

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {hits.map((clip, index) => (
          <ClipCard key={clip.id} clip={clip} index={index % perPage} />
        ))}
      </div>

      <div ref={sentinel} className="mt-8 flex flex-col items-center gap-3">
        {loading ? <Spinner /> : null}

        {failed ? <p className="text-sm text-destructive">{t('state.error')}</p> : null}

        {done ? (
          <p className="text-sm text-muted-foreground">{t('catalogue.endOfResults')}</p>
        ) : (
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {t('catalogue.loadMore')}
          </Button>
        )}
      </div>
    </>
  )
}
