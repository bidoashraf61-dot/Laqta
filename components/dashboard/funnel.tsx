import { formatNumber, formatPercent } from '@/lib/i18n'

/**
 * A conversion funnel as proportional bars.
 *
 * Not a chart library call: the funnel's whole job is to make one comparison
 * legible — how much of the previous step survived — and a bar whose width is
 * literally that ratio says it more directly than a rendered chart with axes.
 * Each step carries its own count and its rate against the step above, so the
 * drop is a number, not an impression.
 *
 * The bars step down the neutral ramp rather than colouring each stage
 * differently; only the last step, the one that is money, takes gold.
 */
export function Funnel({ steps }: { steps: Array<{ label: string; value: number }> }) {
  const top = steps[0]?.value ?? 0

  return (
    <ol className="space-y-4">
      {steps.map((step, index) => {
        const previous = index === 0 ? step.value : steps[index - 1].value
        const share = top === 0 ? 0 : step.value / top
        const rate = previous === 0 ? 0 : step.value / previous
        const isLast = index === steps.length - 1

        return (
          <li key={step.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{step.label}</span>
              <span className="flex items-baseline gap-2">
                <span className="numeric font-bold">{formatNumber(step.value)}</span>
                {index > 0 ? (
                  <span className="numeric text-xs text-muted-foreground">
                    {formatPercent(rate, 1)}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-sm bg-muted">
              <div
                className={
                  isLast ? 'h-full rounded-sm bg-gold' : 'h-full rounded-sm bg-foreground/25'
                }
                style={{ inlineSize: `${Math.max(share * 100, step.value > 0 ? 1.5 : 0)}%` }}
              />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
