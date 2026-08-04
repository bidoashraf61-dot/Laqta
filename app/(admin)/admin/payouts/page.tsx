import type { Prisma } from '@prisma/client'
import { Wallet } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { EmptyState } from '@/components/ui/state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DashboardHeader, Panel, StatGrid, StatTile } from '@/components/dashboard/primitives'
import { FilterChips, Toolbar } from '@/components/dashboard/toolbar'
import { StatusBadge, statusLabel, statusValues } from '@/components/dashboard/status'
import { PayoutControls } from '@/components/admin/payout-controls'
import { formatDate, formatMoney, formatNumber, t } from '@/lib/i18n'
import { UserText } from '@/components/ui/bilingual'

export const metadata = { title: t('admin.payoutRuns') }

const METHOD_LABEL: Record<string, string> = {
  iban: 'dash.methodIban',
  payoneer: 'dash.methodPayoneer',
  wise: 'dash.methodWise',
}

/**
 * Payout queue.
 *
 * Grouped by rail in the summary, because the export is per rail: Saudi
 * creators go out as an IBAN batch and foreign ones through Payoneer or Wise,
 * and knowing how much is queued on each is what decides whether a run is
 * worth generating today.
 */
export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireAdmin()
  const { status } = await searchParams

  const where: Prisma.PayoutWhereInput = status
    ? statusValues('payout').includes(status)
      ? { status: status as Prisma.EnumPayoutStatusFilter['equals'] }
      : {}
    : { status: { in: ['requested', 'approved', 'processing'] } }

  const [payouts, counts, pendingByMethod] = await Promise.all([
    db.payout.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      take: 100,
      include: {
        creator: { select: { displayNameAr: true, handle: true, country: true } },
      },
    }),
    db.payout.groupBy({ by: ['status'], _count: { status: true } }),
    db.payout.groupBy({
      by: ['method'],
      where: { status: { in: ['requested', 'approved', 'processing'] } },
      _sum: { netAmount: true },
      _count: { method: true },
    }),
  ])

  const byStatus = new Map(counts.map((row) => [row.status, row._count.status]))
  const queuedTotal = pendingByMethod.reduce((sum, row) => sum + Number(row._sum.netAmount ?? 0), 0)

  return (
    <>
      <DashboardHeader
        title={t('dash.payoutQueueTitle')}
        description={t('dash.payoutQueueHint')}
      />

      <div className="space-y-6">
        <StatGrid>
          <StatTile label={t('cart.total')} value={formatMoney(queuedTotal)} icon={Wallet} accent />
          {(['iban', 'payoneer', 'wise'] as const).map((method) => {
            const row = pendingByMethod.find((entry) => entry.method === method)
            return (
              <StatTile
                key={method}
                label={t(METHOD_LABEL[method])}
                value={formatMoney(Number(row?._sum.netAmount ?? 0))}
                hint={`${formatNumber(row?._count.method ?? 0)}`}
              />
            )
          })}
        </StatGrid>

        <div>
          <Toolbar>
            <FilterChips
              options={statusValues('payout').map((value) => ({
                value,
                label: statusLabel('payout', value),
                count: byStatus.get(value as never) ?? 0,
              }))}
              allLabel={t('dash.statusRequested')}
            />
          </Toolbar>

          {payouts.length === 0 ? (
            <EmptyState
              title={t('dash.noPayoutRequests')}
              description={t('dash.payoutQueueHint')}
            />
          ) : (
            <Panel className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('dash.colCreator')}</TableHead>
                    <TableHead>{t('dash.payoutMethod')}</TableHead>
                    <TableHead className="text-end">{t('dash.payoutAmount')}</TableHead>
                    <TableHead className="text-end">{t('dash.payoutNet')}</TableHead>
                    <TableHead>{t('dash.colDate')}</TableHead>
                    <TableHead>{t('dash.colStatus')}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="font-medium">
                        <UserText>{payout.creator.displayNameAr}</UserText>
                        <span className="ltr-island mt-0.5 block text-2xs text-muted-foreground">
                          @{payout.creator.handle} · {payout.creator.country}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t(METHOD_LABEL[payout.method])}
                      </TableCell>
                      <TableCell className="numeric text-end">
                        {formatMoney(Number(payout.amount), payout.currency)}
                      </TableCell>
                      <TableCell className="numeric text-end text-gold">
                        {formatMoney(Number(payout.netAmount), payout.currency)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <span className="numeric">{formatDate(payout.createdAt)}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge domain="payout" value={payout.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <PayoutControls payoutId={payout.id} status={payout.status} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}
