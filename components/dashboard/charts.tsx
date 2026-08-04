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

const GOLD = 'hsl(43 52% 54%)'
const MUTED = 'hsl(240 8% 22%)'
const AXIS = 'hsl(40 10% 66%)'

const CATEGORICAL = [
  'hsl(43 52% 54%)', // gold
  'hsl(148 50% 42%)', // oasis
  'hsl(21 51% 55%)', // clay
  'hsl(42 47% 74%)', // sand
  'hsl(210 30% 62%)', // sky (window scenes)
  'hsl(240 8% 40%)', // ash
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
    <div dir="ltr" style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="laqta-trend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
              <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={MUTED} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke={AXIS}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={40} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: MUTED }} />
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
    <div dir="ltr" style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={MUTED} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={40} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: MUTED, fillOpacity: 0.3 }} />
          <Bar dataKey="value" fill={GOLD} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** A donut — the default for a categorical split (clips by location). */
export function DonutChart({ data, height = 240 }: { data: Point[]; height?: number }) {
  return (
    <div dir="ltr" style={{ width: '100%', height }}>
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
