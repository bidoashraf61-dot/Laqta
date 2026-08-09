import { db } from '@/lib/db'

/**
 * Analytics read + write over AlbumStat.
 *
 * The daily rollup is the source for every trend chart. Reads take a day range
 * and bucket by day; the dashboards never compute time series from Order or
 * Download directly. `recordStat` is the write path — checkout, download and
 * the view tracker call it to increment the current day's row.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Midnight UTC of a date — the bucket key. */
function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export type StatField = 'views' | 'boardAdds' | 'cartAdds' | 'purchases'

/**
 * Increment one metric on today's row for an album. Fire-and-forget from the
 * caller's perspective — an analytics write must never break a purchase or a
 * page view, so callers wrap it in a try/catch or `void` it.
 */
export async function recordStat(
  albumId: string,
  creatorId: string,
  field: StatField,
  amount = 1,
  revenue = 0,
) {
  const day = startOfDay(new Date())
  await db.albumStat.upsert({
    where: { albumId_day: { albumId, day } },
    create: {
      albumId,
      creatorId,
      day,
      [field]: amount,
      revenue,
    },
    update: {
      [field]: { increment: amount },
      ...(revenue ? { revenue: { increment: revenue } } : {}),
    },
  })
}

type Trend = { label: string; value: number }

/**
 * Fill a continuous daily series between two dates, so a gap day renders as
 * zero rather than collapsing the axis. Recharts wants one point per day.
 */
function fillDays(rows: Array<{ day: Date; value: number }>, from: Date, to: Date): Trend[] {
  const byDay = new Map(rows.map((row) => [startOfDay(row.day).getTime(), row.value]))
  const out: Trend[] = []
  for (let t = startOfDay(from).getTime(); t <= startOfDay(to).getTime(); t += DAY_MS) {
    const date = new Date(t)
    out.push({
      label: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`,
      value: byDay.get(t) ?? 0,
    })
  }
  return out
}

/** A creator's whole-catalogue trend for a metric over the last N days. */
export async function creatorTrend(
  creatorId: string,
  metric: 'views' | 'purchases' | 'revenue',
  days = 30,
) {
  const to = new Date()
  const from = new Date(to.getTime() - (days - 1) * DAY_MS)

  const rows = await db.albumStat.groupBy({
    by: ['day'],
    where: { creatorId, day: { gte: startOfDay(from) } },
    _sum: { views: true, purchases: true, revenue: true },
    orderBy: { day: 'asc' },
  })

  return fillDays(
    rows.map((row) => ({
      day: row.day,
      value: metric === 'revenue' ? Number(row._sum.revenue ?? 0) : Number(row._sum[metric] ?? 0),
    })),
    from,
    to,
  )
}

/** Platform-wide trend for a metric — the admin overview. */
export async function platformTrend(metric: 'views' | 'purchases' | 'revenue', days = 30) {
  const to = new Date()
  const from = new Date(to.getTime() - (days - 1) * DAY_MS)

  const rows = await db.albumStat.groupBy({
    by: ['day'],
    where: { day: { gte: startOfDay(from) } },
    _sum: { views: true, purchases: true, revenue: true },
    orderBy: { day: 'asc' },
  })

  return fillDays(
    rows.map((row) => ({
      day: row.day,
      value: metric === 'revenue' ? Number(row._sum.revenue ?? 0) : Number(row._sum[metric] ?? 0),
    })),
    from,
    to,
  )
}

/** Totals for a window, with the delta vs the previous window of equal length. */
export async function summary(scope: { creatorId?: string }, days = 30) {
  const now = new Date()
  const from = new Date(now.getTime() - (days - 1) * DAY_MS)
  const prevFrom = new Date(from.getTime() - days * DAY_MS)

  const where = scope.creatorId ? { creatorId: scope.creatorId } : {}

  const [current, previous] = await Promise.all([
    db.albumStat.aggregate({
      where: { ...where, day: { gte: startOfDay(from) } },
      _sum: { views: true, purchases: true, revenue: true, cartAdds: true },
    }),
    db.albumStat.aggregate({
      where: { ...where, day: { gte: startOfDay(prevFrom), lt: startOfDay(from) } },
      _sum: { views: true, purchases: true, revenue: true, cartAdds: true },
    }),
  ])

  const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round(((a - b) / b) * 100))

  const curViews = Number(current._sum.views ?? 0)
  const curPurchases = Number(current._sum.purchases ?? 0)
  const curRevenue = Number(current._sum.revenue ?? 0)
  const curCart = Number(current._sum.cartAdds ?? 0)

  const prevViews = Number(previous._sum.views ?? 0)
  const prevPurchases = Number(previous._sum.purchases ?? 0)
  const prevRevenue = Number(previous._sum.revenue ?? 0)

  return {
    views: curViews,
    purchases: curPurchases,
    revenue: curRevenue,
    // Conversion: purchases per view, the number a creator actually optimises.
    conversion: curViews === 0 ? 0 : (curPurchases / curViews) * 100,
    cartAdds: curCart,
    delta: {
      views: pct(curViews, prevViews),
      purchases: pct(curPurchases, prevPurchases),
      revenue: pct(curRevenue, prevRevenue),
    },
  }
}

/** Top albums by a metric in the window — the "what's working" table. */
export async function topAlbums(
  scope: { creatorId?: string },
  metric: 'views' | 'purchases' | 'revenue',
  days = 30,
  take = 5,
) {
  const from = new Date(Date.now() - (days - 1) * DAY_MS)
  const where = scope.creatorId ? { creatorId: scope.creatorId } : {}

  const grouped = await db.albumStat.groupBy({
    by: ['albumId'],
    where: { ...where, day: { gte: startOfDay(from) } },
    _sum: { views: true, purchases: true, revenue: true },
    orderBy: { _sum: { [metric]: 'desc' } },
    take,
  })

  const albums = await db.album.findMany({
    where: { id: { in: grouped.map((row) => row.albumId) } },
    select: {
      id: true,
      slug: true,
      titleAr: true,
      titleEn: true,
      creator: { select: { handle: true } },
    },
  })
  const byId = new Map(albums.map((album) => [album.id, album]))

  return grouped.map((row) => ({
    album: byId.get(row.albumId),
    views: Number(row._sum.views ?? 0),
    purchases: Number(row._sum.purchases ?? 0),
    revenue: Number(row._sum.revenue ?? 0),
  }))
}
