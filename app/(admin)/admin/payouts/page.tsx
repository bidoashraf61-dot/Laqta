import type { Prisma } from '@prisma/client'
import { Wallet } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { EmptyState } from '@/components/ui/state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Download } from '@/components/ui/icons'
import { DashboardHeader, Panel, StatGrid, StatTile } from '@/components/dashboard/primitives'
import { FilterChips, Toolbar } from '@/components/dashboard/toolbar'
import { StatusBadge, statusLabel, statusValues } from '@/components/dashboard/status'
import { ActionButton } from '@/components/dashboard/form'
import { PayoutControls } from '@/components/admin/payout-controls'
import { RunLineExclude, RunPayForm } from '@/components/admin/payout-run-controls'
import { createRun } from '@/app/(admin)/admin/actions'
import { RAILS, RUN_ELIGIBLE, fromCents, toCents } from '@/lib/payouts'
import { formatDate, formatMoney, formatNumber, t } from '@/lib/i18n'
import { UserText } from '@/components/ui/bilingual'
import { cn } from '@/lib/utils'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('admin.payoutRuns'),
  }
}

const METHOD_LABEL: Record<string, string> = {
  iban: 'dash.methodIban',
  payoneer: 'dash.methodPayoneer',
  wise: 'dash.methodWise',
}

const RUN_STATUS: Record<string, { key: string; variant: 'warning' | 'success' | 'neutral' }> = {
  draft: { key: 'payoutRun.statusDraft', variant: 'warning' },
  paid: { key: 'payoutRun.statusPaid', variant: 'success' },
  void: { key: 'payoutRun.statusVoid', variant: 'neutral' },
}

function RunStatus({ status }: { status: string }) {
  const entry = RUN_STATUS[status]
  return <Badge variant={entry?.variant ?? 'neutral'}>{entry ? t(entry.key) : status}</Badge>
}

type Snapshot = { iban?: string | null; email?: string | null }

/** Enough of the frozen destination to check against the file, not all of it. */
function destinationHint(snapshot: Prisma.JsonValue | null) {
  const snap = (snapshot ?? {}) as Snapshot
  if (snap.iban) return `•••• ${snap.iban.replace(/\s+/g, '').slice(-4)}`
  return snap.email ?? ''
}

/**
 * Payout queue and payout runs.
 *
 * Grouped by rail in the summary, because the export is per rail: Saudi
 * creators go out as an IBAN batch and foreign ones through Payoneer or Wise.
 * A run gathers every approved payout, gives one file per rail, and is closed
 * as paid in one step with the rail's batch reference — see lib/payouts.ts.
 */
export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; run?: string }>
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
  const { status, run: runParam } = await searchParams

  const where: Prisma.PayoutWhereInput = status
    ? statusValues('payout').includes(status)
      ? { status: status as Prisma.EnumPayoutStatusFilter['equals'] }
      : {}
    : { status: { in: ['requested', 'approved', 'processing'] } }

  const [payouts, counts, pendingByMethod, eligibleCount, runs] = await Promise.all([
    db.payout.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      take: 100,
      include: {
        creator: { select: { displayNameAr: true, handle: true, country: true } },
        run: { select: { label: true } },
      },
    }),
    db.payout.groupBy({ by: ['status'], _count: { status: true } }),
    db.payout.groupBy({
      by: ['method'],
      where: { status: { in: ['requested', 'approved', 'processing'] } },
      _sum: { netAmount: true },
      _count: { method: true },
    }),
    db.payout.count({ where: RUN_ELIGIBLE }),
    db.payoutRun.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
  ])

  // The run on screen: the one asked for, else the newest still awaiting payment.
  const selectedId = runs.find((run) => run.id === runParam)?.id ?? runs.find((run) => run.status === 'draft')?.id
  const selected = selectedId
    ? await db.payoutRun.findUnique({
        where: { id: selectedId },
        include: {
          payouts: {
            orderBy: [{ method: 'asc' }, { createdAt: 'asc' }],
            include: { creator: { select: { displayNameAr: true, handle: true } } },
          },
        },
      })
    : null

  const byStatus = new Map(counts.map((row) => [row.status, row._count.status]))
  const queuedTotal = pendingByMethod.reduce((sum, row) => sum + Number(row._sum.netAmount ?? 0), 0)

  const railTotals = RAILS.map((rail) => {
    const lines = selected?.payouts.filter((payout) => payout.method === rail) ?? []
    const cents = lines.reduce((sum, payout) => sum + toCents(payout.netAmount), 0)
    return { rail, count: lines.length, total: Number(fromCents(cents)) }
  })
  const runCurrency = selected?.payouts[0]?.currency ?? 'USD'
  const runTotalLabel = selected ? formatMoney(Number(selected.totalAmount), runCurrency) : ''

  return (
    <>
      <DashboardHeader title={t('dash.payoutQueueTitle')} description={t('dash.payoutQueueHint')} />

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

        <Panel
          title={t('payoutRun.sectionTitle')}
          action={
            eligibleCount > 0 ? (
              <ActionButton action={createRun} label={t('payoutRun.create')} variant="default" />
            ) : null
          }
        >
          <p className="text-sm text-muted-foreground">
            {eligibleCount > 0
              ? t('payoutRun.readyHint', { count: formatNumber(eligibleCount) })
              : t('payoutRun.noneReady')}
          </p>

          {selected ? (
            <div className="mt-6 space-y-6 border-t border-border/60 pt-6">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <h3 className="ltr-island text-lg font-medium">{selected.label}</h3>
                <RunStatus status={selected.status} />
                <span className="text-sm text-muted-foreground">
                  <span className="numeric">{formatNumber(selected.payoutCount)}</span>
                  {' · '}
                  <span className="numeric text-foreground">{runTotalLabel}</span>
                </span>
              </div>

              <section aria-labelledby="run-files" className="space-y-3">
                <div>
                  <h4 id="run-files" className="font-medium">
                    {t('payoutRun.filesTitle')}
                  </h4>
                  <p className="mt-1 text-sm text-muted-foreground">{t('payoutRun.filesHint')}</p>
                </div>
                <ul className="grid gap-3 sm:grid-cols-3">
                  {railTotals.map(({ rail, count, total }) => (
                    <li key={rail} className="flex flex-col gap-3 rounded-md border border-border/70 p-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{t(METHOD_LABEL[rail])}</span>
                        <span className="numeric text-sm text-muted-foreground">{formatNumber(count)}</span>
                      </div>
                      <span className="numeric text-lg">{formatMoney(total, runCurrency)}</span>
                      {count > 0 && selected.status !== 'void' ? (
                        <a
                          href={`/admin/payouts/runs/${selected.id}/${rail}`}
                          download
                          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'self-start')}
                          aria-label={`${t('payoutRun.download')} — ${t(METHOD_LABEL[rail])}`}
                        >
                          <Download className="size-4" />
                          {t('payoutRun.download')}
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">{t('payoutRun.noLinesOnRail')}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              {selected.payouts.length > 0 ? (
                <section aria-labelledby="run-lines" className="space-y-3">
                  <h4 id="run-lines" className="font-medium">
                    {t('payoutRun.linesTitle')}
                  </h4>
                  <div className="overflow-x-auto rounded-md border border-border/70">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('dash.colCreator')}</TableHead>
                          <TableHead>{t('dash.payoutMethod')}</TableHead>
                          <TableHead className="text-end">{t('dash.payoutNet')}</TableHead>
                          <TableHead>{t('dash.colStatus')}</TableHead>
                          {selected.status === 'draft' ? <TableHead /> : null}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selected.payouts.map((payout) => (
                          <TableRow key={payout.id}>
                            <TableCell className="font-medium">
                              <UserText>{payout.creator.displayNameAr}</UserText>
                              <span className="ltr-island mt-0.5 block text-2xs text-muted-foreground">
                                @{payout.creator.handle}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {t(METHOD_LABEL[payout.method])}
                              <span className="ltr-island mt-0.5 block text-2xs">
                                {destinationHint(payout.destinationSnapshot)}
                              </span>
                            </TableCell>
                            <TableCell className="numeric text-end">
                              {formatMoney(Number(payout.netAmount), payout.currency)}
                            </TableCell>
                            <TableCell>
                              <StatusBadge domain="payout" value={payout.status} />
                            </TableCell>
                            {selected.status === 'draft' ? (
                              <TableCell>
                                <RunLineExclude runId={selected.id} payoutId={payout.id} />
                              </TableCell>
                            ) : null}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              ) : null}

              {selected.status === 'draft' ? (
                <section aria-labelledby="run-pay" className="space-y-3 rounded-md bg-muted/60 p-4">
                  <div>
                    <h4 id="run-pay" className="font-medium">
                      {t('payoutRun.payTitle')}
                    </h4>
                    <p className="mt-1 max-w-prose text-sm text-muted-foreground">{t('payoutRun.payHint')}</p>
                  </div>
                  <RunPayForm runId={selected.id} count={selected.payoutCount} totalLabel={runTotalLabel} />
                </section>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('payoutRun.closedHint')}
                  {selected.reference ? (
                    <>
                      {' '}
                      {t('payoutRun.colReference')}: <span className="ltr-island text-foreground">{selected.reference}</span>
                    </>
                  ) : null}
                  {selected.paidAt ? (
                    <>
                      {' · '}
                      <span className="numeric">{formatDate(selected.paidAt)}</span>
                    </>
                  ) : null}
                </p>
              )}
            </div>
          ) : null}
        </Panel>

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
                        {payout.status === 'approved' && payout.failureReason ? (
                          <span className="mt-1 block max-w-48 text-2xs text-warning">
                            {t('payoutRun.returnedNote', { reason: payout.failureReason })}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <PayoutControls
                            payoutId={payout.id}
                            status={payout.status}
                            runLabel={payout.run?.label ?? null}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          )}
        </div>

        <Panel title={t('payoutRun.historyTitle')} className="overflow-hidden">
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('payoutRun.noRuns')}</p>
          ) : (
            <div className="-m-5 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('payoutRun.colRun')}</TableHead>
                    <TableHead>{t('payoutRun.colCreated')}</TableHead>
                    <TableHead>{t('dash.colStatus')}</TableHead>
                    <TableHead className="text-end">{t('payoutRun.colLines')}</TableHead>
                    <TableHead className="text-end">{t('payoutRun.colTotal')}</TableHead>
                    <TableHead>{t('payoutRun.colReference')}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id} className={cn(run.id === selected?.id && 'bg-muted/50')}>
                      <TableCell className="ltr-island font-medium">{run.label}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <span className="numeric">{formatDate(run.createdAt)}</span>
                      </TableCell>
                      <TableCell>
                        <RunStatus status={run.status} />
                      </TableCell>
                      <TableCell className="numeric text-end">{formatNumber(run.payoutCount)}</TableCell>
                      <TableCell className="numeric text-end">{formatMoney(Number(run.totalAmount))}</TableCell>
                      <TableCell className="ltr-island text-xs text-muted-foreground">{run.reference ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          {run.id === selected?.id ? null : (
                            // Plain anchor: a load-bearing navigation (see CLAUDE.md).
                            <a
                              href={`/admin/payouts?run=${run.id}`}
                              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                              aria-label={`${t('payoutRun.view')} ${run.label}`}
                            >
                              {t('payoutRun.view')}
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
