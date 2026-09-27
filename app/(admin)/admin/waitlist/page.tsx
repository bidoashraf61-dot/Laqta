import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { EmptyState } from '@/components/ui/state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { ActionButton } from '@/components/dashboard/form'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatNumber, t } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'
import { resendAudienceConfigured } from '@/lib/waitlist'
import { sendLaunchNoticeNow, syncWaitlistNow } from './actions'

export async function generateMetadata(): Promise<Metadata> {
  await requestLocale()
  return { title: t('dash.waitlistTitle') }
}

/**
 * The launch waitlist (DEV-45): who signed up, from where, in which
 * language; export as CSV; send the launch notice once; push to Resend.
 */
export default async function AdminWaitlistPage() {
  await requestLocale()
  await requireAdmin()

  const [entries, active, unsubscribed, notified] = await Promise.all([
    db.waitlistEntry.findMany({ orderBy: { createdAt: 'desc' }, take: 300 }),
    db.waitlistEntry.count({ where: { unsubscribedAt: null } }),
    db.waitlistEntry.count({ where: { unsubscribedAt: { not: null } } }),
    db.waitlistEntry.count({ where: { launchNotifiedAt: { not: null } } }),
  ])
  const pendingNotice = await db.waitlistEntry.count({ where: { unsubscribedAt: null, launchNotifiedAt: null } })
  const resend = resendAudienceConfigured()

  return (
    <>
      <DashboardHeader title={t('dash.waitlistTitle')} description={t('dash.waitlistHint')} />

      <Panel className="mb-6 space-y-4 p-5">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">{t('dash.waitlistActive')}</dt>
            <dd className="numeric text-2xl font-bold">{formatNumber(active)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('dash.waitlistUnsubscribed')}</dt>
            <dd className="numeric text-2xl font-bold">{formatNumber(unsubscribed)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('dash.waitlistNotified')}</dt>
            <dd className="numeric text-2xl font-bold">{formatNumber(notified)}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          {/* A file download: a plain anchor, never a client navigation. */}
          <a
            href="/admin/waitlist/export"
            className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm hover:bg-accent"
          >
            {t('dash.waitlistExport')}
          </a>
          <ActionButton
            action={sendLaunchNoticeNow}
            label={t('dash.waitlistSendLaunch')}
            confirm={t('dash.waitlistSendLaunchConfirm', { count: pendingNotice })}
            variant="gold"
          />
          <ActionButton action={syncWaitlistNow} label={t('dash.waitlistSync')} variant="ghost" />
        </div>
        <p className="text-xs text-muted-foreground">
          {resend ? t('dash.waitlistSyncOn') : t('dash.waitlistSyncOff')}
        </p>
      </Panel>

      {entries.length === 0 ? (
        <EmptyState title={t('dash.waitlistEmpty')} description={t('dash.waitlistHint')} />
      ) : (
        <Panel className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('dash.waitlistColEmail')}</TableHead>
                <TableHead>{t('dash.waitlistColLanguage')}</TableHead>
                <TableHead>{t('dash.waitlistColSource')}</TableHead>
                <TableHead>{t('dash.waitlistColDate')}</TableHead>
                <TableHead>{t('dash.waitlistColStatus')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="ltr-island">{row.email}</TableCell>
                  <TableCell>{row.locale === 'en' ? t('email.languageEn') : t('email.languageAr')}</TableCell>
                  <TableCell className="ltr-island text-muted-foreground">{row.source}</TableCell>
                  <TableCell className="numeric text-xs text-muted-foreground">{formatDate(row.createdAt)}</TableCell>
                  <TableCell>
                    {row.unsubscribedAt ? (
                      <Badge variant="neutral">{t('dash.waitlistStatusOut')}</Badge>
                    ) : row.launchNotifiedAt ? (
                      <Badge variant="success">{t('dash.waitlistStatusNotified')}</Badge>
                    ) : (
                      <Badge variant="warning">{t('dash.waitlistStatusWaiting')}</Badge>
                    )}
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
