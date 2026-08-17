import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/i18n'

/**
 * A rating, as stars and as a number.
 *
 * ── Stars are never the only signal ─────────────────────────────────────────
 * The number is always printed beside them. A row of glyphs is imprecise at a
 * glance (4.2 and 4.4 draw identically), invisible to anyone who cannot see
 * them, and meaningless without its sample size — an average with no count is
 * not a rating, it is a rumour. "5.0" from one buyer and "4.6" from ninety are
 * not comparable, and only the second is worth anything.
 *
 * The whole thing is one labelled group for assistive tech, so it announces as
 * "4.6 out of 5, 90 ratings" rather than as five separate icons.
 */
export function Stars({
  value,
  count,
  label,
  className,
}: {
  value: number
  /** Reviews behind the average. Omit only where it is stated adjacent. */
  count?: number
  /** Accessible sentence, already localised by the caller. */
  label: string
  className?: string
}) {
  return (
    <span role="img" aria-label={label} className={cn('inline-flex items-center gap-1', className)}>
      <span aria-hidden className="inline-flex">
        {[1, 2, 3, 4, 5].map((step) => (
          <Star
            key={step}
            className={cn(
              'size-3.5',
              // Half-steps round UP to a filled star only at .5 or better, so
              // a 4.4 never draws as five.
              step <= Math.round(value) ? 'fill-gold text-gold' : 'text-muted-foreground/35',
            )}
          />
        ))}
      </span>
      <span aria-hidden className="numeric text-xs font-bold">
        {value.toFixed(1)}
      </span>
      {count != null ? (
        <span aria-hidden className="numeric text-xs text-muted-foreground">
          ({formatNumber(count)})
        </span>
      ) : null}
    </span>
  )
}
