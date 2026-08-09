import { Link } from '@/components/ui/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatMoney, t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('library.purchasesTitle'),
  }
}

export default async function PurchasesPage() {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const user = await requireUser()
  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { items: { select: { id: true } }, invoice: { select: { invoiceNumber: true } } },
  })

  return (
    <div className="space-y-6">
      <PageTitle>{t('library.purchasesTitle')}</PageTitle>

      {orders.length === 0 ? (
        <EmptyState title={t('state.empty')} />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('checkout.orderNumber')}</TableHead>
                <TableHead>{t('library.purchasedOn')}</TableHead>
                <TableHead>{t('cart.total')}</TableHead>
                <TableHead>{t('library.invoiceNumber')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="numeric">{order.orderNumber}</TableCell>
                  <TableCell className="numeric">{formatDate(order.createdAt)}</TableCell>
                  <TableCell className="numeric">
                    {formatMoney(Number(order.total), order.currency)}
                  </TableCell>
                  <TableCell className="numeric">{order.invoice?.invoiceNumber ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={order.status === 'paid' ? 'success' : 'warning'}>
                      {order.status === 'paid'
                        ? t('checkout.successPaid')
                        : t('checkout.successPending')}
                    </Badge>
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
