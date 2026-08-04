import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/state'
import { Bilingual } from '@/components/ui/bilingual'
import { formatDate, formatMoney, t } from '@/lib/i18n'

export const metadata = { title: t('admin.title') }

export default async function AdminPage() {
  await requireAdmin()

  const [queue, stats] = await Promise.all([
    db.reviewTask.findMany({
      where: { status: { in: ['unassigned', 'assigned', 'in_progress'] } },
      orderBy: [{ slaDueAt: 'asc' }, { submittedAt: 'asc' }],
      include: {
        album: {
          select: {
            id: true,
            titleAr: true,
            titleEn: true,
            clipCount: true,
            priceStandard: true,
            currency: true,
            creator: { select: { displayNameAr: true } },
          },
        },
      },
    }),
    Promise.all([
      db.album.count({ where: { status: 'live' } }),
      db.creator.count({ where: { status: 'pending' } }),
      db.order.count({ where: { status: 'pending' } }),
      db.dispute.count({ where: { status: { in: ['open', 'investigating'] } } }),
    ]),
  ])

  const [liveAlbums, pendingCreators, pendingOrders, openDisputes] = stats
  const now = new Date()

  return (
    <div className="space-y-8">
      <h1 className="font-display text-headline font-semibold">{t('admin.title')}</h1>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label={t('admin.catalogue')} value={liveAlbums} />
        <Stat label={t('admin.creators')} value={pendingCreators} />
        <Stat label={t('admin.orders')} value={pendingOrders} />
        <Stat label={t('admin.disputes')} value={openDisputes} />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">{t('admin.reviewQueue')}</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/reports">{t('admin.reports')}</Link>
          </Button>
        </div>

        {queue.length === 0 ? (
          <EmptyState title={t('state.empty')} />
        ) : (
          <div className="grid gap-3">
            {queue.map((task) => {
              const overdue = task.slaDueAt ? task.slaDueAt < now : false
              return (
                <Link
                  key={task.id}
                  href={`/admin/review/${task.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/25"
                >
                  <span className="min-w-0 flex-1 font-medium">
                    <Bilingual ar={task.album.titleAr} en={task.album.titleEn} />
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {task.album.creator.displayNameAr}
                  </span>
                  <span className="numeric text-sm text-muted-foreground">
                    {task.album.clipCount}
                  </span>
                  <span className="numeric text-sm text-gold">
                    {formatMoney(Number(task.album.priceStandard), task.album.currency)}
                  </span>
                  {task.slaDueAt ? (
                    <Badge variant={overdue ? 'destructive' : 'neutral'} className="numeric">
                      {formatDate(task.slaDueAt)}
                    </Badge>
                  ) : null}
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="numeric mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}
