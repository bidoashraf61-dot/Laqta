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
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { UserText } from '@/components/ui/bilingual'
import { formatDate, t } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('request.adminTitle'),
  }
}

/**
 * The footage request queue.
 *
 * This is the shortest list in the product that is worth reading every day:
 * buyers naming, in their own words, catalogue that does not exist. Ordered
 * oldest-first within `open`, because a request that has sat unanswered for a
 * fortnight is the one costing a sale.
 *
 * Deliberately read-only for now. Fulfilling a request means shipping an album,
 * which happens in the catalogue, not here — a status control that only
 * changed a label would invite the queue to be marked done without anything
 * being made.
 */
export default async function AdminRequestsPage() {
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

  const requests = await db.footageRequest.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    take: 200,
  })

  return (
    <>
      <DashboardHeader title={t('request.adminTitle')} description={t('request.adminHint')} />

      {requests.length === 0 ? (
        <EmptyState title={t('request.empty')} description={t('request.adminHint')} />
      ) : (
        <Panel className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('request.colBrief')}</TableHead>
                <TableHead>{t('request.colEmail')}</TableHead>
                <TableHead>{t('request.colDate')}</TableHead>
                <TableHead>{t('request.colStatus')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-[28rem]">
                    {/* The buyer's own phrasing is the whole value of this
                        table — never truncated to a taxonomy label. */}
                    <UserText>{row.briefAr}</UserText>
                  </TableCell>
                  <TableCell className="ltr-island text-muted-foreground">{row.email}</TableCell>
                  <TableCell className="numeric text-xs text-muted-foreground">
                    {formatDate(row.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.status === 'open' ? 'warning' : 'neutral'}>
                      {row.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </>
  )
}
