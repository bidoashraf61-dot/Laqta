'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatNumber } from '@/lib/i18n'

/**
 * Charts, themed to the Laqta tokens.
 *
 * Recharts wrapped so no dashboard reaches for raw chart config or off-palette
 * colours. The series colour is gold — this is one of the sanctioned uses,
 * since the chart IS the data, not decoration — with the desert palette for
 * categorical breakdowns. Axes and grid are muted; the tooltip is a card.
 *
 * Charts read left-to-right by convention even in an RTL document, because a
 * time axis running right-to-left misreads as "the future is on the left".
 * The container is forced `dir="ltr"`; Arabic labels inside still render
 * correctly as isolated runs.
 */

/**
 * Two series colours, and which one a chart gets is the One Voice Rule made
 * literal: **gold means money.** A revenue chart is gold; a views or sales-count
 * chart is ink. Painting a views line in money-gold — which the first cut did to
 * every series — teaches the eye that gold is just "a colour the brand likes,"
 * and that is exactly what makes the buy button stop reading as valuable.
 *
 * `MONEY` is a shade richer than the film's #C8A24A because these charts live on
 * paper, where 54% lightness is a pale 2.4:1 against a white card; 44% holds. The
 * grid, axes and tooltip cursor are still token-driven in CSS (`.laqta-chart`),
 * so they re-theme with the document.
 */
const MONEY = 'hsl(43 56% 44%)'
const NEUTRAL = 'hsl(240 10% 38%)'
/*
 * Three more series colours, and every one of them is SEMANTIC.
 *
 * The rule above still holds — a views line must not be gold, or gold stops
 * meaning money — but "everything that is not money is grey" left almost every
 * chart in the portal a single shade of ash. These give the other brand hues a
 * job in the data rather than a decorative slot:
 *
 *   REACH     audience — views, impressions. Dusty olive, which does no work
 *             as a ground (it cannot carry text) but reads well as a line.
 *   POSITIVE  approvals, clearances, completions.
 *   CAUTION   disputes, refunds, overdue.
 *
 * Dusty olive is pitched at 44% rather than its 66% ground value: on a white
 * card the ground value is 2.05:1 and disappears. 44% gives 3.91:1, which sits
 * alongside oasis (4.08) and clay (3.83) so no one series shouts.
 */
const REACH = 'hsl(59 17% 44%)'
const POSITIVE = 'hsl(148 50% 37%)'
const CAUTION = 'hsl(21 51% 50%)'

type Tone = 'money' | 'neutral' | 'reach' | 'positive' | 'caution'
const TONES: Record<Tone, string> = {
  money: MONEY,
  neutral: NEUTRAL,
  reach: REACH,
  positive: POSITIVE,
  caution: CAUTION,
}
const seriesColor = (tone: Tone) => TONES[tone]

const CATEGORICAL = [
  'hsl(43 52% 48%)', // gold, a shade down so it holds on paper
  'hsl(148 50% 37%)', // oasis
  'hsl(21 51% 50%)', // clay
  'hsl(42 40% 58%)', // sand, darkened — the pale value vanished on paper
  'hsl(210 34% 48%)', // sky (window scenes)
  'hsl(240 8% 45%)', // ash
]

type Point = { label: string; value: number }

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
  unit?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lift">
      <p className="mb-0.5 text-muted-foreground">{label}</p>
      <p className="numeric font-bold text-foreground">
        {formatNumber(payload[0].value)}
        {unit ? ` ${unit}` : ''}
      </p>
    </div>
  )
}

/**
 * A filled area trend. `tone` is not decoration — `money` paints it gold, and
 * everything else (views, sales counts) is ink, so gold on a chart still means
 * money. Default is `neutral`: a chart is only gold when a caller says it is
 * revenue.
 */
export function TrendChart({
  data,
  unit,
  tone = 'neutral',
  height = 240,
}: {
  data: Point[]
  unit?: string
  tone?: Tone
  height?: number
}) {
  const color = seriesColor(tone)
  // A gradient id per tone, or two area charts on one page share a fill.
  const gradientId = `laqta-trend-${tone}`
  return (
    <div dir="ltr" className="laqta-chart" style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={tone === 'money' ? 0.35 : 0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          {/* Every Laqta metric is a count or a whole-riyal figure, so the
              axis must not invent fractional ticks — a "1.5 sales" gridline is
              a data-viz lie about a discrete quantity. */}
          <YAxis fontSize={11} tickLine={false} axisLine={false} width={56} allowDecimals={false} />
          <Tooltip content={<ChartTooltip unit={unit} />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Vertical bars — the default for a period comparison (revenue by month). */
export function BarSeries({
  data,
  unit,
  tone = 'money',
  height = 240,
}: {
  data: Point[]
  unit?: string
  tone?: Tone
  height?: number
}) {
  return (
    <div dir="ltr" className="laqta-chart" style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
          {/* Every Laqta metric is a count or a whole-riyal figure, so the
              axis must not invent fractional ticks — a "1.5 sales" gridline is
              a data-viz lie about a discrete quantity. */}
          <YAxis fontSize={11} tickLine={false} axisLine={false} width={56} allowDecimals={false} />
          <Tooltip content={<ChartTooltip unit={unit} />} />
          <Bar dataKey="value" fill={seriesColor(tone)} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** A donut — the default for a categorical split (clips by location). */
export function DonutChart({ data, height = 240 }: { data: Point[]; height?: number }) {
  return (
    <div dir="ltr" className="laqta-chart" style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((_, index) => (
              <Cell key={index} fill={CATEGORICAL[index % CATEGORICAL.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
