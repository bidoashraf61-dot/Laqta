import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, Eye, Percent, ShoppingBag, TrendingUp, Wallet } from 'lucide-react'
import { requireCreator } from '@/lib/auth'
import { db } from '@/lib/db'
import { getEarnings, getDemandSignals } from '@/lib/studio'
import { creatorTrend, summary, topAlbums } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { Bilingual, UserText } from '@/components/ui/bilingual'
import { EmptyState } from '@/components/ui/state'
import { DashboardHeader, Panel, StatGrid, StatTile } from '@/components/dashboard/primitives'
import { TrendChart } from '@/components/dashboard/charts'
import { StatusBadge } from '@/components/dashboard/status'
import { formatMoney, formatNumber, formatPercent, t } from '@/lib/i18n'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('studio.title'),
  }
}

/**
 * Creator overview.
 *
 * The question this page answers is "is anything wrong, and is the work
 * paying?" — in that order. Attention items come before the numbers, because
 * an album stuck in `changes_requested` costs the creator more than a soft
 * week of views, and a dashboard that buries it behind four KPI tiles has
 * failed at the only job that is genuinely urgent.
 */
export default async function StudioPage() {
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

  const [creator, earnings, stats, trend, top, demand, attention] = await Promise.all([
    db.creator.findUnique({
      where: { id: creatorId },
      select: { displayNameAr: true },
    }),
    getEarnings(creatorId),
    summary({ creatorId }, 30),
    creatorTrend(creatorId, 'views', 30),
    topAlbums({ creatorId }, 'revenue', 30, 5),
    getDemandSignals(5),
    Promise.all([
      db.album.findMany({
        where: { creatorId, status: 'changes_requested' },
        select: { id: true, titleAr: true, titleEn: true },
        take: 5,
      }),
      db.album.count({ where: { creatorId, status: 'in_review' } }),
      db.release.count({ where: { creatorId, verification: 'pending' } }),
    ]),
  ])

  const [changesRequested, inReview, pendingReleases] = attention
  const hasAttention = changesRequested.length > 0 || inReview > 0 || pendingReleases > 0
  const hasHistory = trend.some((point) => point.value > 0)

  return (
    <>
      <DashboardHeader
        title={t('dash.welcome', { name: creator?.displayNameAr ?? '' })}
        description={t('dash.todayIs', { days: 30 })}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/studio/analytics">
              <TrendingUp />
              {t('dash.analytics')}
            </Link>
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Attention first. An empty state here is itself the good news, so it
            is stated rather than silently omitted. */}
        <Panel title={t('dash.needsAttention')} accent={hasAttention ? 'warning' : undefined}>
          {hasAttention ? (
            <ul className="divide-y divide-border/60">
              {changesRequested.map((album) => (
                <li key={album.id}>
                  <Link
                    href={`/studio/albums/${album.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent"
                  >
                    <AlertTriangle className="size-4 shrink-0 text-warning" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <Bilingual ar={album.titleAr} en={album.titleEn} />
                    </span>
                    <StatusBadge domain="album" value="changes_requested" />
                  </Link>
                </li>
              ))}
              {inReview > 0 ? (
                <li className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">{t('studio.inReview')}</span>
                  <span className="numeric text-muted-foreground">{formatNumber(inReview)}</span>
                </li>
              ) : null}
              {pendingReleases > 0 ? (
                <li className="flex items-center gap-3 py-2.5 text-sm">
                  <Link href="/studio/releases" className="min-w-0 flex-1 hover:underline">
                    {t('dash.releasePending')}
                  </Link>
                  <span className="numeric text-muted-foreground">
                    {formatNumber(pendingReleases)}
                  </span>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">{t('dash.allClear')}</p>
          )}
        </Panel>

        <StatGrid>
          <StatTile
            label={t('studio.available')}
            value={formatMoney(earnings.available)}
            icon={Wallet}
            accent
            hint={t('studio.holdExplain')}
          />
          <StatTile
            label={t('dash.revenue')}
            value={formatMoney(stats.revenue)}
            icon={ShoppingBag}
            delta={stats.delta.revenue}
            hint={t('dash.vsPrevious')}
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

        <Panel title={t('dash.trendViews')}>
          {hasHistory ? (
            <TrendChart data={trend} tone="money" />
          ) : (
            <EmptyState title={t('dash.noData')} description={t('dash.noDataHint')} />
          )}
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel
            title={t('dash.topAlbums')}
            action={
              <Link
                href="/studio/albums"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {t('actions.more')}
              </Link>
            }
          >
            {top.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">{t('dash.noData')}</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {top.map((row) =>
                  row.album ? (
                    <li key={row.album.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 truncate">
                        <Bilingual ar={row.album.titleAr} en={row.album.titleEn} />
                      </span>
                      <span className="numeric text-xs text-muted-foreground">
                        {formatNumber(row.views)}
                      </span>
                      <span className="numeric font-medium text-gold">
                        {formatMoney(row.revenue)}
                      </span>
                    </li>
                  ) : null,
                )}
              </ul>
            )}
          </Panel>

          {/* Zero-result searches — the most actionable thing the platform can
              tell a creator, and it costs nothing: search already logs it. */}
          <Panel title={t('studio.demand')}>
            <p className="mb-3 text-xs text-muted-foreground">{t('studio.demandHint')}</p>
            {demand.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">{t('state.empty')}</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {demand.map((signal) => (
                  <li
                    key={signal.query}
                    className="flex items-center justify-between gap-4 py-2.5 text-sm"
                  >
                    <UserText className="min-w-0 truncate">{signal.query}</UserText>
                    <span className="numeric shrink-0 text-xs text-muted-foreground">
                      {formatNumber(signal.searches)} {t('studio.searches')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
