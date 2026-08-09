import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Eye, Percent, ShoppingBag, Wallet } from 'lucide-react'
import { requireCreator } from '@/lib/auth'
import { creatorTrend, summary, topAlbums } from '@/lib/analytics'
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
import { BarSeries, TrendChart } from '@/components/dashboard/charts'
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

/** Only these windows are accepted — an arbitrary `?days=9999` is a table scan. */
function resolveDays(value: string | undefined) {
  const allowed = [7, 30, 90]
  const parsed = Number(value)
  return allowed.includes(parsed) ? parsed : 30
}

/**
 * Creator analytics.
 *
 * Everything reads from the AlbumStat daily rollup, so each chart is a real
 * time series rather than a single total dressed up as one. The funnel is the
 * page's argument: views alone say nothing, and a creator who can see where
 * the drop happens — nobody looks, or everybody looks and nobody buys — knows
 * which of the two problems to fix.
 */
export default async function StudioAnalyticsPage({
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

  const user = await requireCreator()
  if (!user.creatorId) redirect('/sell')

  const creatorId = user.creatorId
  const days = resolveDays((await searchParams).days)

  const [stats, views, revenue, purchases, top] = await Promise.all([
    summary({ creatorId }, days),
    creatorTrend(creatorId, 'views', days),
    creatorTrend(creatorId, 'revenue', days),
    creatorTrend(creatorId, 'purchases', days),
    topAlbums({ creatorId }, 'revenue', days, 10),
  ])

  const hasHistory = views.some((point) => point.value > 0)

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
              label={t('dash.views')}
              value={formatNumber(stats.views)}
              icon={Eye}
              delta={stats.delta.views}
              hint={t('dash.vsPrevious')}
            />
            <StatTile
              label={t('dash.purchases')}
              value={formatNumber(stats.purchases)}
              icon={ShoppingBag}
              delta={stats.delta.purchases}
            />
            <StatTile
              label={t('dash.revenue')}
              value={formatMoney(stats.revenue)}
              icon={Wallet}
              accent
              delta={stats.delta.revenue}
            />
            <StatTile
              label={t('dash.conversion')}
              value={formatPercent(stats.conversion / 100, 2)}
              icon={Percent}
            />
          </StatGrid>

          <Panel title={t('dash.trendViews')}>
            <TrendChart data={views} tone="reach" />
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title={t('dash.trendRevenue')}>
              <BarSeries data={revenue} unit="USD" height={220} />
            </Panel>
            <Panel title={t('dash.trendPurchases')}>
              <TrendChart data={purchases} height={220} tone="money" />
            </Panel>
          </div>

          <Panel title={t('dash.funnel')}>
            <Funnel
              steps={[
                { label: t('dash.views'), value: stats.views },
                { label: t('dash.cartAdds'), value: stats.cartAdds },
                { label: t('dash.purchases'), value: stats.purchases },
              ]}
            />
          </Panel>

          <Panel title={t('dash.topAlbums')} className="overflow-hidden">
            {top.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">{t('dash.noData')}</p>
            ) : (
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
                            href={`/studio/albums/${row.album.id}`}
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
            )}
          </Panel>
        </div>
      )}
    </>
  )
}
