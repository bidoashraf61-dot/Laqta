import Link from 'next/link'
import { AlertTriangle, BadgeCheck, Clock, Eye, ShoppingBag, Users, Wallet } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { platformTrend, summary } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { Bilingual, UserText } from '@/components/ui/bilingual'
import { EmptyState } from '@/components/ui/state'
import { DashboardHeader, Panel, StatGrid, StatTile } from '@/components/dashboard/primitives'
import { TrendChart } from '@/components/dashboard/charts'
import { formatDate, formatMoney, formatNumber, t } from '@/lib/i18n'

export const metadata = { title: t('admin.title') }

/**
 * Admin overview.
 *
 * An operations screen, not a report: the top half is the work queue —
 * reviews against their SLA, creators waiting, disputes open — and the numbers
 * come after. What is overdue has to be visible before anything else, because
 * a missed review SLA is the only thing here with a promise attached to it.
 */
export default async function AdminPage() {
  await requireAdmin()

  const now = new Date()

  const [queue, counts, stats, trend] = await Promise.all([
    db.reviewTask.findMany({
      where: { status: { in: ['unassigned', 'assigned', 'in_progress'] } },
      orderBy: [{ slaDueAt: 'asc' }, { submittedAt: 'asc' }],
      take: 6,
      include: {
        album: {
          select: {
            id: true,
            titleAr: true,
            titleEn: true,
            clipCount: true,
            creator: { select: { displayNameAr: true } },
          },
        },
      },
    }),
    Promise.all([
      db.album.count({ where: { status: 'live' } }),
      db.creator.count({ where: { status: 'pending' } }),
      db.dispute.count({ where: { status: { in: ['open', 'investigating'] } } }),
      db.payout.count({ where: { status: 'requested' } }),
      db.reviewTask.count({
        where: {
          status: { in: ['unassigned', 'assigned', 'in_progress'] },
          slaDueAt: { lt: now },
        },
      }),
    ]),
    summary({}, 30),
    platformTrend('revenue', 30),
  ])

  const [liveAlbums, pendingCreators, openDisputes, payoutRequests, overdueReviews] = counts
  const hasHistory = trend.some((point) => point.value > 0)

  const workload = [
    {
      href: '/admin/review',
      label: t('admin.reviewQueue'),
      value: queue.length,
      urgent: overdueReviews,
      icon: BadgeCheck,
    },
    {
      href: '/admin/creators',
      label: t('dash.creatorPending'),
      value: pendingCreators,
      icon: Users,
    },
    {
      href: '/admin/disputes',
      label: t('dash.disputesTitle'),
      value: openDisputes,
      icon: AlertTriangle,
    },
    {
      href: '/admin/payouts',
      label: t('dash.payoutQueueTitle'),
      value: payoutRequests,
      icon: Wallet,
    },
  ]

  return (
    <>
      <DashboardHeader
        title={t('admin.title')}
        description={t('dash.todayIs', { days: 30 })}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/analytics">{t('dash.analytics')}</Link>
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Queue depths, each a link straight into the work. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {workload.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border bg-card p-5 transition-colors hover:border-foreground/25"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <item.icon className="size-4 text-muted-foreground/60" />
              </div>
              <p className="numeric mt-2 text-2xl font-bold">{formatNumber(item.value)}</p>
              {item.urgent ? (
                <p className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive">
                  <Clock className="size-3" />
                  <span className="numeric">{formatNumber(item.urgent)}</span>
                  <span>{t('dash.overdue')}</span>
                </p>
              ) : null}
            </Link>
          ))}
        </div>

        <Panel
          title={t('dash.queueTitle')}
          action={
            <Link
              href="/admin/review"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('actions.more')}
            </Link>
          }
        >
          {queue.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">{t('dash.queueEmpty')}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {queue.map((task) => {
                const overdue = task.slaDueAt ? task.slaDueAt < now : false
                return (
                  <li key={task.id}>
                    <Link
                      href={`/admin/review/${task.id}`}
                      className="-mx-2 flex flex-wrap items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        <Bilingual ar={task.album.titleAr} en={task.album.titleEn} />
                      </span>
                      <UserText className="truncate text-xs text-muted-foreground">
                        {task.album.creator.displayNameAr}
                      </UserText>
                      <span className="numeric text-xs text-muted-foreground">
                        {formatNumber(task.album.clipCount)}
                      </span>
                      {task.slaDueAt ? (
                        <span
                          className={
                            overdue
                              ? 'numeric text-xs font-medium text-destructive'
                              : 'numeric text-xs text-muted-foreground'
                          }
                        >
                          {formatDate(task.slaDueAt)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

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
            label={t('admin.catalogue')}
            value={formatNumber(liveAlbums)}
            icon={BadgeCheck}
          />
        </StatGrid>

        <Panel title={t('dash.trendRevenue')}>
          {hasHistory ? (
            <TrendChart data={trend} unit="USD" tone="money" />
          ) : (
            <EmptyState title={t('dash.noData')} description={t('dash.noDataHint')} />
          )}
        </Panel>
      </div>
    </>
  )
}
