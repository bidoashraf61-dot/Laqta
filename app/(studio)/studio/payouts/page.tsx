import { Link } from '@/components/ui/link'
import { redirect } from 'next/navigation'
import { Banknote, Clock, Wallet } from 'lucide-react'
import { requireCreator } from '@/lib/auth'
import { db } from '@/lib/db'
import { getEarnings, MIN_PAYOUT_USD } from '@/lib/studio'
import { Alert, AlertDescription, EmptyState } from '@/components/ui/state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DashboardHeader, Panel, StatGrid, StatTile } from '@/components/dashboard/primitives'
import { StatusBadge } from '@/components/dashboard/status'
import { ActionButton } from '@/components/dashboard/form'
import { requestPayout } from '@/app/(studio)/studio/actions'
import { formatDate, formatMoney, t } from '@/lib/i18n'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('dash.payouts'),
  }
}

const METHOD_LABEL: Record<string, string> = {
  iban: 'dash.methodIban',
  payoneer: 'dash.methodPayoneer',
  wise: 'dash.methodWise',
}

/**
 * Payouts.
 *
 * The rule the page has to make obvious is the 30-day hold: a creator who
 * cannot see why their balance is smaller than their sales assumes the
 * platform is keeping it. So held sits next to available, with the reason
 * stated, and the request button explains its own disabled state rather than
 * greying out silently.
 */
export default async function StudioPayoutsPage() {
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

  const [earnings, creator, payouts] = await Promise.all([
    getEarnings(creatorId),
    db.creator.findUnique({
      where: { id: creatorId },
      select: { payoutMethod: true, iban: true, payoneerEmail: true, wiseEmail: true },
    }),
    db.payout.findMany({ where: { creatorId }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ])

  const openRequest = payouts.find((payout) =>
    ['requested', 'approved', 'processing'].includes(payout.status),
  )
  const railReady =
    creator?.payoutMethod === 'iban'
      ? Boolean(creator.iban)
      : creator?.payoutMethod === 'payoneer'
        ? Boolean(creator.payoneerEmail)
        : Boolean(creator?.wiseEmail)

  const eligible = earnings.available >= MIN_PAYOUT_USD && !openRequest && railReady

  return (
    <>
      <DashboardHeader title={t('dash.payouts')} description={t('dash.payoutsHint')} />

      <div className="space-y-6">
        <StatGrid>
          <StatTile
            label={t('studio.available')}
            value={formatMoney(earnings.available)}
            icon={Wallet}
            accent
          />
          <StatTile
            label={t('studio.held')}
            value={formatMoney(earnings.held)}
            icon={Clock}
            hint={t('studio.holdExplain')}
          />
          <StatTile
            label={t('studio.lifetime')}
            value={formatMoney(earnings.lifetime)}
            icon={Banknote}
          />
          <StatTile
            label={t('dash.payoutMethod')}
            value={t(METHOD_LABEL[creator?.payoutMethod ?? 'iban'])}
            hint={railReady ? undefined : t('dash.payoutSettingsHint')}
          />
        </StatGrid>

        <Panel title={t('studio.requestPayout')}>
          {/* A disabled control with no explanation is the fastest route to a
              support ticket, so the blocking reason is always named. */}
          {!railReady ? (
            <Alert variant="warning" className="mb-4">
              <AlertDescription>
                {t('dash.payoutSettingsHint')}{' '}
                <Link href="/studio/settings" className="underline underline-offset-4">
                  {t('dash.payoutSettings')}
                </Link>
              </AlertDescription>
            </Alert>
          ) : openRequest ? (
            <Alert variant="info" className="mb-4">
              <AlertDescription>{t('dash.payoutRequested')}</AlertDescription>
            </Alert>
          ) : earnings.available < MIN_PAYOUT_USD ? (
            <Alert variant="info" className="mb-4">
              <AlertDescription>
                {earnings.available <= 0
                  ? t('dash.nothingAvailable')
                  : t('dash.belowMinimum', { amount: formatMoney(MIN_PAYOUT_USD) })}
              </AlertDescription>
            </Alert>
          ) : null}

          {eligible ? (
            <ActionButton
              action={requestPayout}
              label={t('studio.requestPayout')}
              variant="gold"
              size="default"
              successMessage={t('dash.payoutRequested')}
            />
          ) : null}
        </Panel>

        <Panel title={t('dash.payoutHistory')} className="overflow-hidden">
          {payouts.length === 0 ? (
            <EmptyState title={t('dash.noPayouts')} description={t('dash.payoutsHint')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('dash.colDate')}</TableHead>
                  <TableHead>{t('dash.payoutMethod')}</TableHead>
                  <TableHead className="text-end">{t('dash.payoutAmount')}</TableHead>
                  <TableHead className="text-end">{t('dash.payoutNet')}</TableHead>
                  <TableHead>{t('dash.colStatus')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="text-muted-foreground">
                      <span className="numeric">{formatDate(payout.createdAt)}</span>
                    </TableCell>
                    <TableCell>{t(METHOD_LABEL[payout.method])}</TableCell>
                    <TableCell className="numeric text-end">
                      {formatMoney(Number(payout.amount), payout.currency)}
                    </TableCell>
                    <TableCell className="numeric text-end text-gold">
                      {formatMoney(Number(payout.netAmount), payout.currency)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge domain="payout" value={payout.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </div>
    </>
  )
}
