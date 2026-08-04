import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Banknote, Clock, Receipt, Wallet } from 'lucide-react'
import { requireCreator } from '@/lib/auth'
import { getEarnings } from '@/lib/studio'
import { creatorTrend } from '@/lib/analytics'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DashboardHeader, Panel, StatGrid, StatTile } from '@/components/dashboard/primitives'
import { BarSeries } from '@/components/dashboard/charts'
import { formatDate, formatMoney, t } from '@/lib/i18n'

export const metadata = { title: t('studio.earnings') }

const ENTRY_LABEL: Record<string, string> = {
  sale: 'studio.entrySale',
  payout: 'studio.entryPayout',
  refund: 'studio.entryRefund',
  adjustment: 'studio.entryAdjustment',
  withholding: 'studio.entryWithholding',
}

/**
 * Earnings.
 *
 * Available, held and lifetime are all derived from the ledger rows'
 * `availableAt`, never from a stored counter someone has to remember to
 * update. The release date on each held sale is shown rather than a generic
 * "pending", because "when do I get it" is the only question this table is
 * ever opened to answer.
 */
export default async function EarningsPage() {
  const user = await requireCreator()
  if (!user.creatorId) redirect('/sell')

  const [earnings, revenue] = await Promise.all([
    getEarnings(user.creatorId),
    creatorTrend(user.creatorId, 'revenue', 30),
  ])
  const now = new Date()
  const hasHistory = revenue.some((point) => point.value > 0)

  return (
    <>
      <DashboardHeader
        title={t('studio.earnings')}
        description={t('studio.holdExplain')}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/studio/payouts">
              <Receipt />
              {t('dash.payouts')}
            </Link>
          </Button>
        }
      />

      <div className="space-y-6">
        <StatGrid>
          <StatTile
            label={t('studio.available')}
            value={formatMoney(earnings.available)}
            icon={Wallet}
            accent
          />
          <StatTile label={t('studio.held')} value={formatMoney(earnings.held)} icon={Clock} />
          <StatTile
            label={t('studio.lifetime')}
            value={formatMoney(earnings.lifetime)}
            icon={Banknote}
          />
          <StatTile
            label={t('dash.revenue')}
            value={formatMoney(revenue.reduce((sum, point) => sum + point.value, 0))}
            hint={t('dash.todayIs', { days: 30 })}
          />
        </StatGrid>

        {hasHistory ? (
          <Panel title={t('dash.trendRevenue')}>
            <BarSeries data={revenue} unit="SAR" />
          </Panel>
        ) : null}

        <Panel title={t('studio.ledger')} className="overflow-hidden">
          {earnings.entries.length === 0 ? (
            <EmptyState title={t('state.empty')} description={t('studio.holdExplain')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('library.purchasedOn')}</TableHead>
                  <TableHead>{t('studio.ledger')}</TableHead>
                  <TableHead className="text-end">{t('cart.total')}</TableHead>
                  <TableHead>{t('studio.available')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earnings.entries.map((entry) => {
                  const released = entry.availableAt ? entry.availableAt <= now : true
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-muted-foreground">
                        <span className="numeric">{formatDate(entry.createdAt)}</span>
                      </TableCell>
                      <TableCell>
                        {t(ENTRY_LABEL[entry.entryType] ?? entry.entryType)}
                        {entry.memo ? (
                          <span className="block text-xs text-muted-foreground">{entry.memo}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="numeric text-end">
                        {formatMoney(Number(entry.amount), entry.currency)}
                      </TableCell>
                      <TableCell>
                        {entry.entryType !== 'sale' ? (
                          <span className="text-muted-foreground">—</span>
                        ) : released ? (
                          <Badge variant="success">{t('studio.available')}</Badge>
                        ) : (
                          <Badge variant="warning">
                            <span className="numeric">
                              {entry.availableAt ? formatDate(entry.availableAt) : ''}
                            </span>
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </Panel>
      </div>
    </>
  )
}
