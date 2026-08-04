import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { Bilingual } from '@/components/ui/bilingual'
import { EmptyState } from '@/components/ui/state'
import { DashboardHeader } from '@/components/dashboard/primitives'
import { FilterChips, Toolbar } from '@/components/dashboard/toolbar'
import { StatusBadge, statusLabel, statusValues } from '@/components/dashboard/status'
import { DisputeControls } from '@/components/admin/dispute-controls'
import { formatDate, formatNumber, t } from '@/lib/i18n'
import { UserText } from '@/components/ui/bilingual'

export const metadata = { title: t('admin.disputes') }

const TYPE_LABEL: Record<string, string> = {
  dmca: 'dash.disputeDmca',
  ip_claim: 'dash.disputeIp',
  takedown: 'dash.disputeTakedown',
  content_complaint: 'dash.disputeComplaint',
}

/**
 * Disputes.
 *
 * The claimant's sworn statement is shown in full rather than truncated: a
 * takedown decision made from a preview of the claim is a decision made on
 * half the facts, and the whole record has to be readable later by whoever
 * defends it.
 */
export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireAdmin()
  const { status } = await searchParams

  const where: Prisma.DisputeWhereInput = status
    ? statusValues('dispute').includes(status)
      ? { status: status as Prisma.EnumDisputeStatusFilter['equals'] }
      : {}
    : { status: { in: ['open', 'investigating', 'content_disabled'] } }

  const [disputes, counts] = await Promise.all([
    db.dispute.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      include: {
        assignee: { select: { name: true } },
        album: {
          select: { titleAr: true, titleEn: true, slug: true, creator: { select: { handle: true } } },
        },
      },
    }),
    db.dispute.groupBy({ by: ['status'], _count: { status: true } }),
  ])

  const byStatus = new Map(counts.map((row) => [row.status, row._count.status]))

  return (
    <>
      <DashboardHeader title={t('dash.disputesTitle')} description={t('dash.disputesHint')} />

      <Toolbar>
        <FilterChips
          options={statusValues('dispute').map((value) => ({
            value,
            label: statusLabel('dispute', value),
            count: byStatus.get(value as never) ?? 0,
          }))}
          allLabel={t('dash.disputeOpen')}
        />
      </Toolbar>

      {disputes.length === 0 ? (
        <EmptyState title={t('dash.noDisputes')} description={t('dash.disputesHint')} />
      ) : (
        <div className="space-y-3">
          {disputes.map((dispute) => (
            <section key={dispute.id} className="rounded-lg border bg-card p-5">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 font-medium">
                    {t(TYPE_LABEL[dispute.type] ?? dispute.type)}
                    <StatusBadge domain="dispute" value={dispute.status} />
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <UserText>{dispute.claimantName}</UserText>
                    {dispute.claimantOrg ? <UserText> · {dispute.claimantOrg}</UserText> : null}
                    {' · '}
                    <span className="numeric">{formatDate(dispute.createdAt)}</span>
                  </p>
                </div>
                {dispute.album ? (
                  <Link
                    href={`/albums/${dispute.album.creator.handle}/${dispute.album.slug}`}
                    className="max-w-[16rem] truncate text-sm transition-colors hover:text-gold"
                  >
                    <Bilingual ar={dispute.album.titleAr} en={dispute.album.titleEn} />
                  </Link>
                ) : null}
              </div>

              <UserText className="block whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {dispute.statement}
              </UserText>

              {dispute.affectedClipIds.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('dash.releaseClips')}:{' '}
                  <span className="numeric">{formatNumber(dispute.affectedClipIds.length)}</span>
                </p>
              ) : null}

              {dispute.counterNotice ? (
                <div className="mt-3 rounded-md border border-border/60 bg-background p-3">
                  <p className="mb-1 text-xs font-medium">{t('admin.decisionNote')}</p>
                  <UserText className="block whitespace-pre-line text-sm text-muted-foreground">
                    {dispute.counterNotice}
                  </UserText>
                </div>
              ) : null}

              {dispute.resolution ? (
                <div className="mt-3 rounded-md border border-border/60 bg-background p-3">
                  <p className="mb-1 text-xs font-medium">{t('dash.resolution')}</p>
                  <UserText className="block whitespace-pre-line text-sm text-muted-foreground">
                    {dispute.resolution}
                  </UserText>
                </div>
              ) : null}

              <DisputeControls disputeId={dispute.id} status={dispute.status} />
            </section>
          ))}
        </div>
      )}
    </>
  )
}
