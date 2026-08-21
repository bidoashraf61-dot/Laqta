import { Link } from '@/components/ui/link'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { TIER_RATES, TIER_THRESHOLDS_USD, EXCLUSIVE_BONUS_POINTS } from '@/lib/commission'
import { MIN_PAYOUT_USD } from '@/lib/studio'
import { storageConfigured } from '@/lib/storage'
import { mailConfigured } from '@/lib/mail'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { formatDate, formatMoney, formatPercent, t } from '@/lib/i18n'
import { UserText } from '@/components/ui/bilingual'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('dash.platformSettings'),
  }
}

const TIER_LABEL: Record<string, string> = {
  standard: 'dash.tierStandard',
  silver: 'dash.tierSilver',
  gold: 'dash.tierGold',
}

/**
 * Platform settings.
 *
 * Read-only, and honest about it. These numbers are constants in the money and
 * review code rather than rows in a settings table, and the two invariants —
 * entitlement served from the order snapshot, commission frozen at purchase —
 * are deliberately not configurable at all. Showing them here is worth more
 * than pretending they are editable: an operator can answer "what rate does a
 * Silver creator get" without reading TypeScript.
 */
export default async function AdminSettingsPage() {
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

  const [licence, recentAudit, mailPending, mailSent, mailFailed] = await Promise.all([
    db.licenceVersion.findFirst({ orderBy: { createdAt: 'desc' } }),
    db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { actor: { select: { name: true, email: true } } },
    }),
    db.mailOutbox.count({ where: { sentAt: null, failedAt: null } }),
    db.mailOutbox.count({ where: { sentAt: { not: null } } }),
    // Failed = permanently parked, or out of attempts. Both need a human.
    db.mailOutbox.count({
      where: { OR: [{ failedAt: { not: null } }, { sentAt: null, attempts: { gte: 5 } }] },
    }),
  ])

  const vatRate = Number(process.env.VAT_RATE ?? 0.15)

  return (
    <>
      <DashboardHeader
        title={t('dash.platformSettings')}
        description={t('dash.platformSettingsHint')}
      />

      <div className="space-y-6">
        <Alert variant="info">
          <AlertDescription>{t('dash.settingsReadOnly')}</AlertDescription>
        </Alert>

        <Panel title={t('dash.commissionTiers')} className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('dash.tier')}</TableHead>
                <TableHead className="text-end">{t('dash.lifetimeGmv')}</TableHead>
                <TableHead className="text-end">{t('dash.commissionShare')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(['standard', 'silver', 'gold'] as const).map((tier) => (
                <TableRow key={tier}>
                  <TableCell className="font-medium">{t(TIER_LABEL[tier])}</TableCell>
                  <TableCell className="numeric text-end text-muted-foreground">
                    {formatMoney(TIER_THRESHOLDS_USD[tier])}
                  </TableCell>
                  <TableCell className="numeric text-end text-gold">
                    {formatPercent(1 - TIER_RATES[tier], 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            {t('dash.exclusive')}: +
            <span className="numeric">{formatPercent(EXCLUSIVE_BONUS_POINTS, 0)}</span>
          </p>
        </Panel>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SettingTile label={t('dash.reviewSla')} value="3" />
          <SettingTile label={t('dash.holdDays')} value="30" />
          <SettingTile label={t('dash.minPayout')} value={formatMoney(MIN_PAYOUT_USD)} />
          <SettingTile label={t('dash.vatRate')} value={formatPercent(vatRate, 0)} />
        </div>

        <Panel title={t('dash.licenceCurrent')}>
          {licence ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  <span className="ltr-island">{licence.version}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="numeric">{formatDate(licence.createdAt)}</span>
                </p>
              </div>
              <Badge variant="neutral">{t('dash.settingsReadOnly')}</Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('state.empty')}</p>
          )}
        </Panel>

        {/*
          Mail, beside storage, because they fail the same way: silently, and
          only where nobody is looking. With one person operating the platform,
          "which emails did not go out" has to be answerable from a screen.
        */}
        <Panel title={t('dash.mail')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {mailConfigured ? t('dash.mailReady') : t('dash.mailNotConfigured')}
            </p>
            <Badge variant={mailConfigured ? 'success' : 'warning'}>
              {mailConfigured ? t('dash.slotActive') : t('dash.slotInactive')}
            </Badge>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">{t('dash.mailPending')}</dt>
              <dd className="numeric text-lg font-bold">{mailPending}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('dash.mailSent')}</dt>
              <dd className="numeric text-lg font-bold">{mailSent}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('dash.mailFailed')}</dt>
              <dd
                className={cn(
                  'numeric text-lg font-bold',
                  mailFailed > 0 && 'text-destructive',
                )}
              >
                {mailFailed}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel title={t('dash.storage')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t('studio.uploadHint')}</p>
            <Badge variant={storageConfigured ? 'success' : 'warning'}>
              {storageConfigured ? t('dash.slotActive') : t('dash.slotInactive')}
            </Badge>
          </div>
        </Panel>

        {/* Every privileged action in the panel writes here. Surfacing the tail
            of it makes the audit trail something an operator sees daily rather
            than something discovered during an incident. */}
        <Panel
          title={t('dash.auditTrail')}
          action={
            <Link
              href="/admin/reports"
              // `-my-1.5 py-1.5` lifts a 29×16 label over the 24px minimum without
              // moving it: it is a control, not a caption.
              className="-my-1.5 inline-block py-1.5 text-xs text-muted-foreground transition-colors duration-hover ease-lens hover:text-foreground"
            >
              {t('actions.more')}
            </Link>
          }
        >
          {recentAudit.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('state.empty')}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {recentAudit.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline gap-3 py-2 text-xs">
                  <span className="ltr-island min-w-0 flex-1 truncate font-medium">
                    {entry.action}
                  </span>
                  <UserText className="truncate text-muted-foreground">
                    {entry.actor?.name ?? entry.actor?.email ?? '—'}
                  </UserText>
                  <span className="numeric text-muted-foreground">
                    {formatDate(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}

function SettingTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="numeric mt-2 text-2xl font-bold">{value}</p>
    </div>
  )
}
