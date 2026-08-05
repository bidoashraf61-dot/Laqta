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
 * Gold is a literal because `--gold` is the same value in both themes — only
 * the semantic tokens around it flip. The grid, axes and tooltip cursor are
 * NOT literals: they were tuned for an ink ground and became invisible the
 * moment the page went to paper, so they are painted from tokens in CSS
 * (`.laqta-chart` in globals.css) and re-theme with the document.
 */
const GOLD = 'hsl(43 52% 54%)'

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
      <p className="numeric font-semibold text-foreground">
        {formatNumber(payload[0].value)}
        {unit ? ` ${unit}` : ''}
      </p>
    </div>
  )
}

/** A filled area trend — the default for a time series (views, sales). */
export function TrendChart({
  data,
  unit,
  height = 240,
}: {
  data: Point[]
  unit?: string
  height?: number
}) {
  return (
    <div dir="ltr" className="laqta-chart" style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="laqta-trend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
              <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
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
            stroke={GOLD}
            strokeWidth={2}
            fill="url(#laqta-trend)"
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
  height = 240,
}: {
  data: Point[]
  unit?: string
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
          <Bar dataKey="value" fill={GOLD} radius={[4, 4, 0, 0]} />
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
