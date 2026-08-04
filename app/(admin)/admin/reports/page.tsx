import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { zeroResultReport } from '@/lib/admin'
import { EmptyState } from '@/components/ui/state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatNumber, t } from '@/lib/i18n'

export const metadata = { title: t('admin.reports') }

/**
 * The zero-result report.
 *
 * This is the most valuable content-acquisition signal the business has: a
 * ranked list, in buyers' own words, of footage they wanted and nobody had.
 * It drives what creators are asked to shoot next.
 */
export default async function ReportsPage() {
  await requireAdmin()
  const rows = await zeroResultReport(50)

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
        ← {t('admin.title')}
      </Link>
      <h1 className="font-display text-headline font-semibold">{t('admin.zeroResults')}</h1>

      {rows.length === 0 ? (
        <EmptyState title={t('state.empty')} />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('search.submit')}</TableHead>
                <TableHead>{t('admin.searches')}</TableHead>
                <TableHead>{t('library.purchasedOn')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.normalized}>
                  <TableCell>{row.query}</TableCell>
                  <TableCell className="numeric">{formatNumber(row.searches)}</TableCell>
                  <TableCell className="numeric">
                    {row.lastSeen ? formatDate(row.lastSeen) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
