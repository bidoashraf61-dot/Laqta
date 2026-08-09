import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { Bilingual, UserText } from '@/components/ui/bilingual'
import { EmptyState } from '@/components/ui/state'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { FilterChips, SearchBox, Toolbar } from '@/components/dashboard/toolbar'
import { StatusBadge, statusLabel, statusValues } from '@/components/dashboard/status'
import { ActionButton } from '@/components/dashboard/form'
import { RefundControl } from '@/components/admin/refund-control'
import { markOrderPaid } from '@/app/(admin)/admin/actions'
import { formatDate, formatMoney, formatPercent, t } from '@/lib/i18n'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('admin.orders'),
  }
}

/**
 * Orders.
 *
 * Expanded to line level, because a refund happens to a line and not to an
 * order: each line carries its own frozen commission rate, and that rate — not
 * the creator's current one — is what a reversal is computed against. Showing
 * it on the row is the cheapest way to keep that visible to whoever is about
 * to press refund.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
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
  const { q, status } = await searchParams

  const where: Prisma.OrderWhereInput = {
    ...(status && statusValues('order').includes(status)
      ? { status: status as Prisma.EnumOrderStatusFilter['equals'] }
      : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: 'insensitive' } },
            { user: { email: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const [orders, counts] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { email: true, name: true } },
        items: {
          include: {
            album: { select: { titleAr: true, titleEn: true } },
            creator: { select: { displayNameAr: true } },
          },
        },
      },
    }),
    db.order.groupBy({ by: ['status'], _count: { status: true } }),
  ])

  const byStatus = new Map(counts.map((row) => [row.status, row._count.status]))

  return (
    <>
      <DashboardHeader title={t('dash.ordersTitle')} description={t('dash.ordersHint')} />

      <Toolbar>
        <SearchBox placeholder={t('dash.searchOrders')} />
        <FilterChips
          options={statusValues('order').map((value) => ({
            value,
            label: statusLabel('order', value),
            count: byStatus.get(value as never) ?? 0,
          }))}
        />
      </Toolbar>

      {orders.length === 0 ? (
        <EmptyState title={t('dash.noOrders')} description={t('dash.ordersHint')} />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Panel key={order.id}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="ltr-island">{order.orderNumber}</span>
                    <StatusBadge domain="order" value={order.status} />
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="ltr-island">{order.user.email}</span>
                    {' · '}
                    <span className="numeric">{formatDate(order.createdAt)}</span>
                    {order.paymentMethod ? (
                      <>
                        {' · '}
                        <span className="ltr-island">{order.paymentMethod}</span>
                      </>
                    ) : null}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <p className="numeric text-lg font-bold text-gold">
                    {formatMoney(Number(order.total), order.currency)}
                  </p>
                  {order.status === 'pending' ? (
                    <ActionButton
                      action={markOrderPaid.bind(null, order.id)}
                      label={t('dash.confirmPaid')}
                      confirm={t('dash.confirmPaid')}
                    />
                  ) : null}
                </div>
              </div>

              <ul className="divide-y divide-border/60">
                {order.items.map((item) => {
                  const remaining = Number(item.grossAmount) - Number(item.refundedAmount)
                  return (
                    <li key={item.id} className="py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          <Bilingual ar={item.album.titleAr} en={item.album.titleEn} />
                        </span>
                        <UserText className="truncate text-xs text-muted-foreground">
                          {item.creator.displayNameAr}
                        </UserText>
                        <span className="numeric text-sm">
                          {formatMoney(Number(item.grossAmount), order.currency)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('commerce.licence')}:{' '}
                        {item.licenceTier === 'extended'
                          ? t('commerce.licenceExtended')
                          : t('commerce.licenceStandard')}
                        {' · '}
                        {t('dash.commissionShare')}{' '}
                        <span className="numeric">
                          {formatPercent(Number(item.commissionRate), 0)}
                        </span>
                        {Number(item.refundedAmount) > 0 ? (
                          <>
                            {' · '}
                            {t('dash.refundedAmount')}{' '}
                            <span className="numeric text-clay">
                              {formatMoney(Number(item.refundedAmount), order.currency)}
                            </span>
                          </>
                        ) : null}
                      </p>

                      {order.status === 'paid' || order.status === 'partially_refunded' ? (
                        <RefundControl
                          orderItemId={item.id}
                          remaining={remaining}
                          currency={order.currency}
                        />
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </Panel>
          ))}

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/admin/reports" className="hover:text-foreground">
              {t('admin.reports')}
            </Link>
          </p>
        </div>
      )}
    </>
  )
}
