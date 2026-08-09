import Link from 'next/link'
import { Eye, Percent, ShoppingBag, Wallet } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { platformTrend, summary, topAlbums } from '@/lib/analytics'
import { Bilingual } from '@/components/ui/bilingual'
import { EmptyState } from '@/components/ui/state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DashboardHeader, Panel, StatGrid, StatTile } from '@/components/dashboard/primitives'
import { BarSeries, DonutChart, TrendChart } from '@/components/dashboard/charts'
import { RangePicker } from '@/components/dashboard/toolbar'
import { Funnel } from '@/components/dashboard/funnel'
import { formatMoney, formatNumber, formatPercent, t } from '@/lib/i18n'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('dash.analytics'),
  }
}

function resolveDays(value: string | undefined) {
  const allowed = [7, 30, 90]
  const parsed = Number(value)
  return allowed.includes(parsed) ? parsed : 30
}

/**
 * Platform analytics.
 *
 * Same rollup as the creator view, unscoped. The extra panel here is the
 * category split — where demand actually sits across the library — because
 * that is the acquisition question the platform answers and an individual
 * creator cannot see.
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  await requireAdmin()
  const days = resolveDays((await searchParams).days)

  const [stats, views, revenue, purchases, top, byCategory] = await Promise.all([
    summary({}, days),
    platformTrend('views', days),
    platformTrend('revenue', days),
    platformTrend('purchases', days),
    topAlbums({}, 'revenue', days, 10),
    db.taxonomy.findMany({
      where: { kind: 'category', isActive: true },
      select: { nameAr: true, _count: { select: { albums: true } } },
      orderBy: { sortOrder: 'asc' },
      take: 8,
    }),
  ])

  const hasHistory = views.some((point) => point.value > 0)
  const categorySplit = byCategory
    .map((row) => ({ label: row.nameAr, value: row._count.albums }))
    .filter((row) => row.value > 0)

  return (
    <>
      <DashboardHeader
        title={t('dash.analytics')}
        description={t('dash.todayIs', { days })}
        action={<RangePicker />}
      />

      {!hasHistory ? (
        <EmptyState title={t('dash.noData')} description={t('dash.noDataHint')} />
      ) : (
        <div className="space-y-6">
          <StatGrid>
            <StatTile
              label={t('dash.revenue')}
              value={formatMoney(stats.revenue)}
              icon={Wallet}
              accent
              delta={stats.delta.revenue}
              hint={t('dash.vsPrevious')}
            />
            <StatTile
              label={t('dash.purchases')}
              value={formatNumber(stats.purchases)}
              icon={ShoppingBag}
              delta={stats.delta.purchases}
            />
            <StatTile
              label={t('dash.views')}
              value={formatNumber(stats.views)}
              icon={Eye}
              delta={stats.delta.views}
            />
            <StatTile
              label={t('dash.conversion')}
              value={formatPercent(stats.conversion / 100, 2)}
              icon={Percent}
            />
          </StatGrid>

          <Panel title={t('dash.trendRevenue')}>
            <BarSeries data={revenue} unit="USD" />
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title={t('dash.trendViews')}>
              <TrendChart data={views} height={220} tone="reach" />
            </Panel>
            <Panel title={t('dash.trendPurchases')}>
              <TrendChart data={purchases} height={220} tone="money" />
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title={t('dash.funnel')}>
              <Funnel
                steps={[
                  { label: t('dash.views'), value: stats.views },
                  { label: t('dash.cartAdds'), value: stats.cartAdds },
                  { label: t('dash.purchases'), value: stats.purchases },
                ]}
              />
            </Panel>

            <Panel title={t('catalogue.categoriesTitle')}>
              {categorySplit.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">{t('dash.noData')}</p>
              ) : (
                <>
                  <DonutChart data={categorySplit} height={220} />
                  <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {categorySplit.map((row) => (
                      <li key={row.label} className="flex items-center justify-between gap-2">
                        <span className="truncate text-muted-foreground">{row.label}</span>
                        <span className="numeric">{formatNumber(row.value)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          </div>

          <Panel title={t('dash.topAlbums')} className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('dash.colAlbum')}</TableHead>
                  <TableHead className="text-end">{t('dash.colViews')}</TableHead>
                  <TableHead className="text-end">{t('dash.colSales')}</TableHead>
                  <TableHead className="text-end">{t('dash.colRevenue')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top.map((row) =>
                  row.album ? (
                    <TableRow key={row.album.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/albums/${row.album.creator.handle}/${row.album.slug}`}
                          className="transition-colors hover:text-gold"
                        >
                          <Bilingual ar={row.album.titleAr} en={row.album.titleEn} />
                        </Link>
                      </TableCell>
                      <TableCell className="numeric text-end text-muted-foreground">
                        {formatNumber(row.views)}
                      </TableCell>
                      <TableCell className="numeric text-end text-muted-foreground">
                        {formatNumber(row.purchases)}
                      </TableCell>
                      <TableCell className="numeric text-end font-medium text-gold">
                        {formatMoney(row.revenue)}
                      </TableCell>
                    </TableRow>
                  ) : null,
                )}
              </TableBody>
            </Table>
          </Panel>
        </div>
      )}
    </>
  )
}
