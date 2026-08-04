import type { ReactNode } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Dashboard vocabulary.
 *
 * The handful of building blocks every dashboard page reuses, so the studio
 * and the admin read as one system — one KPI tile, one page header, one panel.
 * Operate mode: fixed scale, restrained colour, consistent affordances. Gold
 * appears only on an explicitly-accented tile (a money figure) and on the one
 * primary action a header may carry.
 */

/**
 * Return to the section a detail page belongs to.
 *
 * The arrow is `ArrowRight` with `data-flip-rtl`, not a literal "←": on an RTL
 * page "back" points right, and a hard-coded glyph would send the eye the
 * wrong way. The stylesheet mirrors it; the component never guesses.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowRight className="size-3.5" data-flip-rtl />
      {label}
    </Link>
  )
}

/** Page header: title, optional description, optional action on the far edge. */
export function DashboardHeader({
  title,
  description,
  action,
  back,
}: {
  title: string
  description?: string
  action?: ReactNode
  back?: { href: string; label: string }
}) {
  return (
    <div className="mb-6">
      {back ? <BackLink href={back.href} label={back.label} /> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
    </div>
  )
}

/**
 * A KPI tile.
 *
 * `delta` is an optional period-over-period change; positive is up (oasis),
 * negative down (clay), and it is never gold — gold is reserved for the value
 * itself when `accent` marks it as money.
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  accent,
  delta,
  hint,
}: {
  label: string
  value: string
  icon?: LucideIcon
  accent?: boolean
  delta?: number
  hint?: string
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon ? <Icon className="size-4 text-muted-foreground/60" /> : null}
      </div>
      <p className={cn('numeric mt-2 text-2xl font-bold', accent && 'text-gold')}>{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {delta != null && delta !== 0 ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              delta > 0 ? 'text-success' : 'text-clay',
            )}
          >
            {delta > 0 ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            <span className="numeric">{Math.abs(delta)}%</span>
          </span>
        ) : null}
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  )
}

/** A titled content panel — the standard container for a table, list or chart. */
export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-lg border bg-card', className)}>
      {title || action ? (
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
          {title ? <h2 className="font-medium">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  )
}

/** A row of stat tiles with a responsive grid. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
}
