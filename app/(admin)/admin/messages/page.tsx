import type { Metadata } from 'next'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { EmptyState } from '@/components/ui/state'
import { UserText } from '@/components/ui/bilingual'
import { DashboardHeader } from '@/components/dashboard/primitives'
import { FilterChips, Toolbar } from '@/components/dashboard/toolbar'
import { StatusBadge } from '@/components/dashboard/status'
import { ActionButton } from '@/components/dashboard/form'
import { setContactMessageStatus } from '@/app/(admin)/admin/actions'
import { formatDateTime, t } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('dash.messagesTitle'),
  }
}

/**
 * Messages from /contact.
 *
 * Its own route rather than a tab on /admin/requests: a footage request is
 * deliberately read-only (it is fulfilled by shipping an album), while a
 * message is answered and then marked handled. Mixing the two would either
 * give requests a status control that invites marking them done without
 * anything being made, or take the one verb messages need away from them.
 *
 * The visitor's message is shown in full — it is the whole point of the row —
 * and whether the operator email left is stated, because with no mail
 * provider configured this page is the only place a message surfaces.
 */
export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
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
  const { status } = await searchParams

  // Default view is the work: open messages, oldest first, because the one
  // that has waited longest is the one most likely to cost a customer.
  const where: Prisma.ContactMessageWhereInput =
    status === 'handled' ? { status: 'handled' } : status === 'any' ? {} : { status: 'open' }

  const [messages, counts] = await Promise.all([
    db.contactMessage.findMany({
      where,
      orderBy: status === 'handled' || status === 'any' ? { createdAt: 'desc' } : { createdAt: 'asc' },
      take: 200,
    }),
    db.contactMessage.groupBy({ by: ['status'], _count: { status: true } }),
  ])
  const byStatus = new Map(counts.map((row) => [row.status, row._count.status]))

  return (
    <>
      <DashboardHeader title={t('dash.messagesTitle')} description={t('dash.messagesHint')} />

      <Toolbar>
        <FilterChips
          allLabel={t('dash.messagesOpen')}
          options={[
            {
              value: 'handled',
              label: t('dash.messagesHandled'),
              count: byStatus.get('handled') ?? 0,
            },
            { value: 'any', label: t('dash.filterAll') },
          ]}
        />
      </Toolbar>

      {messages.length === 0 ? (
        <EmptyState title={t('dash.messagesEmpty')} description={t('dash.messagesHint')} />
      ) : (
        <div className="space-y-3">
          {messages.map((row) => (
            <section key={row.id} className="rounded-lg border bg-card p-5">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 font-medium">
                    <UserText>{row.name}</UserText>
                    <StatusBadge domain="contact" value={row.status} />
                  </h2>
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    <span className="ltr-island">{row.email}</span>
                    <span aria-hidden>·</span>
                    <span>
                      {row.topic ? t(`contact.topic.${row.topic}`) : t('dash.messagesNoTopic')}
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                      <span className="numeric">{formatDateTime(row.createdAt)}</span>
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                      {t('dash.messagesWroteIn')}{' '}
                      <span className="ltr-island">{row.locale === 'en' ? 'EN' : 'AR'}</span>
                    </span>
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {row.mailDelivered ? t('dash.messagesMailed') : t('dash.messagesNotMailed')}
                </p>
              </div>

              <UserText className="block whitespace-pre-line text-sm leading-relaxed">
                {row.message}
              </UserText>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                {/* A plain anchor: mailto is not a route, and nothing here
                    should depend on the client router committing. */}
                <a
                  href={`mailto:${row.email}`}
                  className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm font-medium transition-colors duration-hover ease-lens hover:bg-accent hover:text-accent-foreground"
                >
                  {t('dash.messagesReply')}
                </a>
                {row.status === 'open' ? (
                  <ActionButton
                    action={setContactMessageStatus.bind(null, row.id, 'handled')}
                    label={t('dash.messagesMarkHandled')}
                  />
                ) : (
                  <>
                    <ActionButton
                      action={setContactMessageStatus.bind(null, row.id, 'open')}
                      label={t('dash.messagesReopen')}
                      variant="ghost"
                    />
                    {row.handledAt ? (
                      <span className="text-xs text-muted-foreground">
                        {t('dash.messagesHandledOn')}{' '}
                        <span className="numeric">{formatDateTime(row.handledAt)}</span>
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
