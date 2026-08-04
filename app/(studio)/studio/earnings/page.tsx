import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireCreator } from '@/lib/auth'
import { getEarnings } from '@/lib/studio'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatMoney, t } from '@/lib/i18n'

export const metadata = { title: t('studio.earnings') }

const ENTRY_LABEL: Record<string, string> = {
  sale: 'studio.entrySale',
  payout: 'studio.entryPayout',
  refund: 'studio.entryRefund',
  adjustment: 'studio.entryAdjustment',
  withholding: 'studio.entryWithholding',
}

export default async function EarningsPage() {
  const user = await requireCreator()
  if (!user.creatorId) redirect('/sell')

  const earnings = await getEarnings(user.creatorId)
  const now = new Date()

  return (
    <div className="space-y-6">
      <Link href="/studio" className="text-sm text-muted-foreground hover:text-gold">
        ← {t('studio.title')}
      </Link>
      <h1 className="text-headline font-semibold">{t('studio.earnings')}</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground">{t('studio.available')}</p>
          <p className="numeric mt-1 text-2xl font-bold text-gold">
            {formatMoney(earnings.available)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground">{t('studio.held')}</p>
          <p className="numeric mt-1 text-2xl font-bold">{formatMoney(earnings.held)}</p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground">{t('studio.lifetime')}</p>
          <p className="numeric mt-1 text-2xl font-bold">{formatMoney(earnings.lifetime)}</p>
        </div>
      </div>

      <Alert variant="info">
        <AlertDescription>{t('studio.holdExplain')}</AlertDescription>
      </Alert>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('studio.ledger')}</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('library.purchasedOn')}</TableHead>
                <TableHead>{t('studio.ledger')}</TableHead>
                <TableHead>{t('cart.total')}</TableHead>
                <TableHead>{t('studio.available')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {earnings.entries.map((entry) => {
                const released = entry.availableAt ? entry.availableAt <= now : true
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="numeric">{formatDate(entry.createdAt)}</TableCell>
                    <TableCell>
                      {t(ENTRY_LABEL[entry.entryType] ?? entry.entryType)}
                      {entry.memo ? (
                        <span className="block text-xs text-muted-foreground">{entry.memo}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="numeric">
                      {formatMoney(Number(entry.amount), entry.currency)}
                    </TableCell>
                    <TableCell>
                      {entry.entryType !== 'sale' ? (
                        '—'
                      ) : released ? (
                        <Badge variant="success">{t('studio.available')}</Badge>
                      ) : (
                        <Badge variant="warning" className="numeric">
                          {entry.availableAt ? formatDate(entry.availableAt) : ''}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
