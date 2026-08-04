import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatMoney, t } from '@/lib/i18n'

export const metadata = { title: t('library.purchasesTitle') }

export default async function PurchasesPage() {
  const user = await requireUser()
  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { items: { select: { id: true } }, invoice: { select: { invoiceNumber: true } } },
  })

  return (
    <div className="space-y-6">
      <h1 className="font-display text-headline font-semibold">{t('library.purchasesTitle')}</h1>

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
