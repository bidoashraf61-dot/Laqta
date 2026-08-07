import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { Bilingual } from '@/components/ui/bilingual'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { FilterChips, Toolbar } from '@/components/dashboard/toolbar'
import { StatusBadge, statusLabel } from '@/components/dashboard/status'
import { formatDate, formatMoney, formatNumber, t } from '@/lib/i18n'
import { UserText } from '@/components/ui/bilingual'

export const metadata = { title: t('admin.reviewQueue') }

const OPEN = ['unassigned', 'assigned', 'in_progress'] as const
const DECIDED = ['approved', 'changes_requested', 'rejected'] as const

/**
 * The review queue.
 *
 * Sorted by SLA, not by submission time — the queue's whole promise is three
 * business days, so the thing closest to breaching it is the thing to open
 * next. Decided tasks stay reachable behind a filter rather than disappearing,
 * because "what did we tell this creator last week" is a real support question.
 */
export default async function AdminReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireAdmin()

  const { status } = await searchParams
  const valid = [...OPEN, ...DECIDED] as readonly string[]

  const where: Prisma.ReviewTaskWhereInput = status
    ? valid.includes(status)
      ? { status: status as Prisma.EnumReviewStatusFilter['equals'] }
      : {}
    : { status: { in: [...OPEN] } }

  const now = new Date()

  const [tasks, counts] = await Promise.all([
    db.reviewTask.findMany({
      where,
      orderBy: [{ slaDueAt: 'asc' }, { submittedAt: 'asc' }],
      take: 100,
      include: {
        reviewer: { select: { name: true } },
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
    db.reviewTask.groupBy({ by: ['status'], _count: { status: true } }),
  ])

  const byStatus = new Map(counts.map((row) => [row.status, row._count.status]))

  return (
    <>
      <DashboardHeader title={t('dash.queueTitle')} description={t('dash.queueHint')} />

      <Toolbar>
        <FilterChips
          options={valid.map((value) => ({
            value,
            label: statusLabel('review', value),
            count: byStatus.get(value as never) ?? 0,
          }))}
          allLabel={t('dash.sectionOperations')}
        />
      </Toolbar>

      {tasks.length === 0 ? (
        <EmptyState title={t('dash.queueEmpty')} description={t('dash.queueHint')} />
      ) : (
        <Panel className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('dash.colAlbum')}</TableHead>
                <TableHead>{t('dash.colCreator')}</TableHead>
                <TableHead className="text-end">{t('dash.colClips')}</TableHead>
                <TableHead className="text-end">{t('dash.colPrice')}</TableHead>
                <TableHead>{t('admin.slaDue')}</TableHead>
                <TableHead>{t('dash.colStatus')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const overdue =
                  task.slaDueAt != null &&
                  task.slaDueAt < now &&
                  (OPEN as readonly string[]).includes(task.status)
                return (
                  <TableRow key={task.id}>
                    <TableCell className="max-w-[18rem] font-medium">
                      {/* A plain anchor, not next/link, and deliberately.
                          Opening a review task is the operator's core action,
                          and the client router intermittently fetched this
                          route's payload and then silently declined to commit
                          — the click did nothing, no error, roughly one time
                          in two under load. The same symptom hit the catalogue
                          and taxonomy filters. A real navigation always
                          commits; the cost is one round trip on a click that
                          re-queries the database anyway. */}
                      <a
                        href={`/admin/review/${task.id}`}
                        className="block truncate transition-colors hover:text-gold"
                      >
                        <Bilingual ar={task.album.titleAr} en={task.album.titleEn} />
                      </a>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <UserText>{task.album.creator.displayNameAr}</UserText>
                    </TableCell>
                    <TableCell className="numeric text-end text-muted-foreground">
                      {formatNumber(task.album.clipCount)}
                    </TableCell>
                    <TableCell className="numeric text-end text-gold">
                      {formatMoney(Number(task.album.priceStandard), task.album.currency)}
                    </TableCell>
                    <TableCell>
                      {task.slaDueAt ? (
                        overdue ? (
                          <Badge variant="destructive">
                            <span className="numeric">{formatDate(task.slaDueAt)}</span>
                          </Badge>
                        ) : (
                          <span className="numeric text-xs text-muted-foreground">
                            {formatDate(task.slaDueAt)}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusBadge domain="review" value={task.status} />
                        {task.reviewer?.name ? (
                          <UserText className="truncate text-xs text-muted-foreground">
                            {task.reviewer.name}
                          </UserText>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Panel>
      )}
    </>
  )
}
