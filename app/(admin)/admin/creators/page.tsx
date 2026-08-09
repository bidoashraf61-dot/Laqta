import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { TIER_RATES } from '@/lib/commission'
import { EmptyState } from '@/components/ui/state'
import { Badge } from '@/components/ui/badge'
import { DashboardHeader } from '@/components/dashboard/primitives'
import { FilterChips, SearchBox, Toolbar } from '@/components/dashboard/toolbar'
import { StatusBadge, statusLabel, statusValues } from '@/components/dashboard/status'
import { CreatorControls } from '@/components/admin/creator-controls'
import { formatDate, formatMoney, formatNumber, formatPercent, t } from '@/lib/i18n'
import { UserText } from '@/components/ui/bilingual'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('admin.creators'),
  }
}

const TIER_LABEL: Record<string, string> = {
  standard: 'dash.tierStandard',
  silver: 'dash.tierSilver',
  gold: 'dash.tierGold',
}

/**
 * Creator roster.
 *
 * Rows rather than a table, because each creator carries a control panel that
 * a table cell cannot hold without either truncating it or blowing the column
 * widths apart. The commission figure shown is the CREATOR's share — the
 * inverse of the platform take — since that is the number the conversation
 * with the creator is always about.
 */
export default async function AdminCreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
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
  const { q, status } = await searchParams

  const where: Prisma.CreatorWhereInput = {
    ...(status && statusValues('creator').includes(status)
      ? { status: status as Prisma.EnumCreatorStatusFilter['equals'] }
      : {}),
    ...(q
      ? {
          OR: [
            { displayNameAr: { contains: q, mode: 'insensitive' } },
            { displayNameEn: { contains: q, mode: 'insensitive' } },
            { handle: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [creators, counts] = await Promise.all([
    db.creator.findMany({
      where,
      orderBy: [{ status: 'asc' }, { lifetimeGmv: 'desc' }],
      take: 100,
      include: {
        user: { select: { email: true } },
        _count: { select: { albums: true } },
      },
    }),
    db.creator.groupBy({ by: ['status'], _count: { status: true } }),
  ])

  const byStatus = new Map(counts.map((row) => [row.status, row._count.status]))

  return (
    <>
      <DashboardHeader title={t('dash.creatorsTitle')} description={t('dash.creatorsHint')} />

      <Toolbar>
        <SearchBox placeholder={t('dash.searchCreators')} />
        <FilterChips
          options={statusValues('creator').map((value) => ({
            value,
            label: statusLabel('creator', value),
            count: byStatus.get(value as never) ?? 0,
          }))}
        />
      </Toolbar>

      {creators.length === 0 ? (
        <EmptyState title={t('dash.noCreators')} description={t('dash.creatorsHint')} />
      ) : (
        <div className="space-y-3">
          {creators.map((creator) => {
            const platformRate =
              creator.commissionRateOverride != null
                ? Number(creator.commissionRateOverride)
                : TIER_RATES[creator.tier] - (creator.isExclusive ? 0.05 : 0)

            return (
              <section key={creator.id} className="rounded-lg border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="flex flex-wrap items-center gap-2 font-medium">
                      <Link
                        href={`/creators/${creator.handle}`}
                        className="truncate transition-colors hover:text-gold"
                      >
                        <UserText>{creator.displayNameAr}</UserText>
                      </Link>
                      <StatusBadge domain="creator" value={creator.status} />
                      <Badge variant="neutral">{t(TIER_LABEL[creator.tier])}</Badge>
                      {creator.isExclusive ? (
                        <Badge variant="gold">{t('dash.exclusive')}</Badge>
                      ) : null}
                    </h2>
                    <p className="ltr-island mt-0.5 text-xs text-muted-foreground">
                      @{creator.handle} · {creator.user.email}
                    </p>
                  </div>

                  <CreatorControls
                    creatorId={creator.id}
                    status={creator.status}
                    tier={creator.tier}
                    overridePercent={
                      creator.commissionRateOverride != null
                        ? String(Number(creator.commissionRateOverride) * 100)
                        : ''
                    }
                  />
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-5">
                  <div>
                    <dt className="text-muted-foreground">{t('dash.commissionShare')}</dt>
                    <dd className="numeric mt-0.5 font-medium text-gold">
                      {formatPercent(1 - platformRate, 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t('dash.lifetimeGmv')}</dt>
                    <dd className="numeric mt-0.5">{formatMoney(Number(creator.lifetimeGmv))}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t('admin.catalogue')}</dt>
                    <dd className="numeric mt-0.5">{formatNumber(creator._count.albums)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t('dash.country')}</dt>
                    <dd className="ltr-island mt-0.5">{creator.country}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t('dash.colDate')}</dt>
                    <dd className="mt-0.5">
                      <span className="numeric">{formatDate(creator.appliedAt)}</span>
                    </dd>
                  </div>
                </dl>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
