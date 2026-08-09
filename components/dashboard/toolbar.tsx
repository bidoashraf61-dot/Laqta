'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n-client'

/**
 * List controls — search and filters, driven through the URL.
 *
 * Filtering writes to the query string rather than to component state, so a
 * filtered view is a link an operator can bookmark or paste to a colleague,
 * the back button works, and the list itself stays a server component.
 *
 * The chips and the range picker are plain anchors, and deliberately so.
 *
 * A control that changes the URL should be a link — middle-clickable,
 * bookmarkable, announced correctly. But these are NOT `next/link`: on some
 * routes (admin/catalogue, admin/taxonomy) a same-pathname client navigation
 * that only changes search params fetched its RSC payload and then silently
 * declined to commit — no error, no history entry, the URL untouched and the
 * filter simply dead. It reproduced through `router.replace`, `router.push`
 * AND `<Link>`, with and without prefetch, so it is below our layer.
 *
 * A plain anchor does a real navigation and is correct on every route. The
 * cost is one server round trip on a control that re-queries the database
 * anyway, which is not a trade worth a filter that works on five pages out of
 * seven. `verify:flows` exercises every filtered route so this cannot rot.
 */

/** Build the URL a control should point at, preserving the other params. */
function useParamHref() {
  const pathname = usePathname()
  const params = useSearchParams()

  return (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    // Any filter change invalidates the page cursor.
    next.delete('page')
    const query = next.toString()
    return query ? `${pathname}?${query}` : pathname
  }
}

/**
 * Debounced search box. 300ms is long enough that a typist doesn't fire a
 * request per character and short enough that the list feels immediate.
 */
export function SearchBox({ placeholder, param = 'q' }: { placeholder: string; param?: string }) {
  const t = useT()

  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const href = useParamHref()
  const [value, setValue] = useState(params.get(param) ?? '')
  const [, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const current = params.get(param) ?? ''
    if (value === current) return
    const timer = setTimeout(() => {
      startTransition(() => router.replace(href({ [param]: value }), { scroll: false }))
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // A real GET form, not just an input with a handler. Enter always navigates
  // even where the client router declines to commit, it works with JavaScript
  // off, and the other active filters ride along as hidden fields so searching
  // never silently drops the status you had selected.
  return (
    <form
      ref={formRef}
      action={pathname}
      method="get"
      role="search"
      className="relative w-full sm:max-w-xs"
    >
      {[...params.entries()]
        .filter(([key]) => key !== param && key !== 'page')
        .map(([key, entry]) => (
          <input key={`${key}-${entry}`} type="hidden" name={key} value={entry} />
        ))}
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        name={param}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 ps-9"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            setValue('')
            startTransition(() => router.replace(href({ [param]: null }), { scroll: false }))
          }}
          aria-label={t('actions.clear')}
          className="absolute end-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </form>
  )
}

export type FilterOption = { value: string; label: string; count?: number }

/**
 * A row of filter chips. Selected takes the gold border + faint fill the
 * design system reserves for the active state; everything else is a hairline.
 */
export function FilterChips({
  options,
  param = 'status',
  allLabel,
}: {
  options: FilterOption[]
  param?: string
  allLabel?: string
}) {
  const t = useT()

  const params = useSearchParams()
  const href = useParamHref()
  const active = params.get(param)

  const chips: FilterOption[] = [{ value: '', label: allLabel ?? t('dash.filterAll') }, ...options]

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group">
      {chips.map((chip) => {
        const selected = (active ?? '') === chip.value
        return (
          <a
            key={chip.value || 'all'}
            href={href({ [param]: chip.value || null })}
            aria-current={selected ? 'true' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
              selected
                ? 'border-gold/40 bg-gold/12 text-gold'
                : 'border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground',
            )}
          >
            {chip.label}
            {chip.count != null ? <span className="numeric opacity-60">{chip.count}</span> : null}
          </a>
        )
      })}
    </div>
  )
}

/** 7 / 30 / 90-day window for the analytics surfaces. */
export function RangePicker({ param = 'days' }: { param?: string }) {
  const t = useT()

  const params = useSearchParams()
  const href = useParamHref()
  const active = params.get(param) ?? '30'

  const ranges = [
    { value: '7', label: t('dash.range7') },
    { value: '30', label: t('dash.range30') },
    { value: '90', label: t('dash.range90') },
  ]

  return (
    <div
      className="inline-flex rounded-md border border-border p-0.5"
      role="group"
      aria-label={t('dash.rangeLabel')}
    >
      {ranges.map((range) => {
        const selected = active === range.value
        return (
          <a
            key={range.value}
            href={href({ [param]: range.value })}
            aria-current={selected ? 'true' : undefined}
            className={cn(
              'rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors',
              selected ? 'bg-gold/12 text-gold' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {range.label}
          </a>
        )
      })}
    </div>
  )
}

/** The strip above a table: search on one edge, filters on the other. */
export function Toolbar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center justify-between gap-3', className)}>
      {children}
    </div>
  )
}
