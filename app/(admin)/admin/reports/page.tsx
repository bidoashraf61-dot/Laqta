import { requireAdmin } from '@/lib/auth'
import { zeroResultReport } from '@/lib/admin'
import { db } from '@/lib/db'
import { EmptyState } from '@/components/ui/state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { formatDate, formatNumber, t } from '@/lib/i18n'
import { UserText } from '@/components/ui/bilingual'

export const metadata = { title: t('admin.reports') }

/**
 * The zero-result report.
 *
 * The most valuable content-acquisition signal the business has: a ranked
 * list, in buyers' own words, of footage they wanted and nobody had. It drives
 * what creators are asked to shoot next, which is why it sits next to the
 * audit trail rather than buried in an analytics tab.
 */
export default async function ReportsPage() {
  await requireAdmin()

  const [rows, audit] = await Promise.all([
    zeroResultReport(50),
    db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { actor: { select: { name: true, email: true } } },
    }),
  ])

  return (
    <>
      <DashboardHeader title={t('admin.zeroResults')} description={t('studio.demandHint')} />

      <div className="space-y-6">
        {rows.length === 0 ? (
          <EmptyState title={t('state.empty')} description={t('studio.demandHint')} />
        ) : (
          <Panel className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('search.submit')}</TableHead>
                  <TableHead className="text-end">{t('admin.searches')}</TableHead>
                  <TableHead className="text-end">{t('library.purchasedOn')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.normalized}>
                    <TableCell className="font-medium">
                      <UserText>{row.query}</UserText>
                    </TableCell>
                    <TableCell className="numeric text-end">{formatNumber(row.searches)}</TableCell>
                    <TableCell className="numeric text-end text-muted-foreground">
                      {row.lastSeen ? formatDate(row.lastSeen) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}

        {/* Every privileged action in the panel writes here. Surfacing it makes
            the audit trail something an operator sees daily rather than
            something discovered during an incident. */}
        <Panel title={t('dash.auditTrail')} className="overflow-hidden">
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('state.empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('dash.auditAction')}</TableHead>
                  <TableHead>{t('dash.auditActor')}</TableHead>
                  <TableHead className="text-end">{t('dash.colDate')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <span className="ltr-island font-medium">{entry.action}</span>
                      <span className="ltr-island mt-0.5 block text-2xs text-muted-foreground">
                        {entry.entity}
                        {entry.entityId ? `/${entry.entityId.slice(0, 8)}` : ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <UserText>{entry.actor?.name ?? entry.actor?.email ?? '—'}</UserText>
                    </TableCell>
                    <TableCell className="numeric text-end text-muted-foreground">
                      {formatDate(entry.createdAt)}
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
