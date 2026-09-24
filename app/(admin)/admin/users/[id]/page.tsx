import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { requireAdmin } from '@/lib/auth'
import { loadUserDetail } from '@/lib/admin-users'
import { closeExpiredImpersonations, viewRefusal } from '@/lib/impersonation'
import { IMPERSONATION_MINUTES } from '@/lib/impersonation-shared'
import { Badge } from '@/components/ui/badge'
import { UserText } from '@/components/ui/bilingual'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { StatusBadge } from '@/components/dashboard/status'
import { UserStatusControl, ViewAsForm } from '@/components/admin/user-controls'
import { formatDate, formatDateTime, formatMoney, formatNumber, t } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  await requestLocale()
  return { title: t('dash.usersTitle') }
}

/** One fact in the profile grid. Latin values (email, phone) are isolated. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{children}</dd>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

/**
 * One account, everything support asks about it, on one screen.
 *
 * Read-mostly by design. The two things an operator can DO here are the two
 * that belong to the account itself — suspend/reactivate and view-as-user.
 * Money actions stay where their audit and their guard rails live: a refund
 * (which is also the only way ownership is withdrawn) is on `/admin/orders`,
 * and every order here links there.
 */
export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requestLocale()
  const admin = await requireAdmin()
  const { id } = await params

  // Views whose clock ran out are closed before the history is read, so the
  // list never shows a view as running that ended half an hour ago.
  await closeExpiredImpersonations()

  const detail = await loadUserDetail(id)
  if (!detail || detail.user.creator?.isHouse) notFound()
  const { user, orders, entitlements, comps, messages, impersonations, sample } = detail

  const title = user.creator?.displayNameAr || user.name || user.email || user.phone || user.id
  const refusal = viewRefusal(admin.id, user)
  const now = Date.now()

  return (
    <>
      <DashboardHeader
        title={title}
        back={{ href: '/admin/users', label: t('dash.usersTitle') }}
        action={
          user.role === 'admin' ? null : <UserStatusControl userId={user.id} status={user.status} />
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Panel title={t('dash.userProfile')}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant="neutral">{t(`role.${user.role}`)}</Badge>
              <StatusBadge domain="user" value={user.status} />
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              <Fact label={t('dash.userName')}>
                {user.name ? <UserText>{user.name}</UserText> : t('dash.notSet')}
              </Fact>
              <Fact label={t('dash.userEmail')}>
                {user.email ? (
                  <>
                    <span className="ltr-island">{user.email}</span>{' '}
                    <span className="text-xs text-muted-foreground">
                      ({user.emailVerified ? t('dash.verified') : t('dash.unverified')})
                    </span>
                  </>
                ) : (
                  t('dash.notSet')
                )}
              </Fact>
              <Fact label={t('dash.userPhone')}>
                {user.phone ? (
                  <>
                    <span className="ltr-island">{user.phone}</span>{' '}
                    <span className="text-xs text-muted-foreground">
                      ({user.phoneVerified ? t('dash.verified') : t('dash.unverified')})
                    </span>
                  </>
                ) : (
                  t('dash.notSet')
                )}
              </Fact>
              <Fact label={t('dash.userCountry')}>
                {user.country ? <span className="ltr-island">{user.country}</span> : t('dash.notSet')}
              </Fact>
              <Fact label={t('dash.userLocale')}>
                <span className="ltr-island">{user.locale}</span>
              </Fact>
              <Fact label={t('dash.colJoined')}>
                <span className="numeric">{formatDate(user.createdAt)}</span>
              </Fact>
              <Fact label={t('dash.userBilling')}>
                {user.billingEntityType === 'business' ? t('dash.billingBusiness') : t('dash.billingIndividual')}
                {user.legalName ? (
                  <>
                    {' · '}
                    <UserText>{user.legalName}</UserText>
                  </>
                ) : null}
              </Fact>
              <Fact label={t('dash.userTwoFactor')}>
                {user.twoFactorEnabled ? t('dash.userTwoFactorOn') : t('dash.userTwoFactorOff')}
              </Fact>
            </dl>
            {user.role !== 'admin' ? (
              <p className="mt-4 text-xs text-muted-foreground">{t('dash.userSuspendHint')}</p>
            ) : null}
          </Panel>

          <Panel title={t('dash.userOrders')}>
            {orders.length === 0 ? (
              <Empty>{t('dash.userOrdersEmpty')}</Empty>
            ) : (
              <ul className="divide-y divide-border/60">
                {orders.map((order) => (
                  <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="ltr-island">{order.orderNumber}</span>
                        <StatusBadge domain="order" value={order.status} />
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="numeric">{formatDate(order.createdAt)}</span>
                        {' · '}
                        {t('dash.orderAlbums')}: <span className="numeric">{formatNumber(order._count.items)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="numeric text-sm font-medium text-gold">
                        {formatMoney(Number(order.total), order.currency)}
                      </span>
                      <a
                        href={`/admin/orders?q=${encodeURIComponent(order.orderNumber)}`}
                        className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                      >
                        {t('dash.openInOrders')}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={t('dash.userLibrary')}>
            <p className="mb-4 text-xs text-muted-foreground">{t('dash.userLibraryHint')}</p>
            {entitlements.length === 0 ? (
              <Empty>{t('dash.userLibraryEmpty')}</Empty>
            ) : (
              <ul className="divide-y divide-border/60">
                {entitlements.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <UserText>{row.album.titleAr}</UserText>
                        {row.album.creator.isHouse ? (
                          <Badge variant="neutral">{t('dash.entitlementSample')}</Badge>
                        ) : null}
                        {row.revokedAt ? (
                          <Badge variant="destructive">{t('dash.entitlementRevoked')}</Badge>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="numeric">{formatDate(row.grantedAt)}</span>
                        {' · '}
                        {t('dash.colClips')}: <span className="numeric">{formatNumber(row.clipIdsSnapshot.length)}</span>
                        {' · '}
                        <span className="ltr-island">{row.orderItem.order.orderNumber}</span>
                      </p>
                      {row.revokeReason ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          <UserText>{row.revokeReason}</UserText>
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={t('dash.userComps')}>
            {comps.length === 0 ? (
              <Empty>{t('dash.userCompsEmpty')}</Empty>
            ) : (
              <ul className="space-y-2 text-sm">
                {comps.map((comp) => (
                  <li key={comp.id} className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="min-w-0">
                      <UserText>{comp.clip?.titleAr ?? comp.album.titleAr}</UserText>
                      <span className="text-xs text-muted-foreground">
                        {' · '}
                        {comp.isAlbumZip ? t('dash.compZip') : t('dash.compClip')}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <span className="numeric">{formatDateTime(comp.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={t('dash.userMessages')}>
            <p className="mb-4 text-xs text-muted-foreground">{t('dash.userMessagesHint')}</p>
            {messages.length === 0 ? (
              <Empty>{t('dash.userMessagesEmpty')}</Empty>
            ) : (
              <ul className="divide-y divide-border/60">
                {messages.map((message) => (
                  <li key={message.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <StatusBadge domain="contact" value={message.status} />
                      {message.topic ? t(`contact.topic.${message.topic}`) : t('dash.messagesNoTopic')}
                      {' · '}
                      <span className="numeric">{formatDateTime(message.createdAt)}</span>
                    </p>
                    <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-sm">
                      <UserText>{message.message}</UserText>
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {messages.length > 0 ? (
              <a
                href="/admin/messages"
                className="mt-3 inline-block text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {t('dash.messagesTitle')}
              </a>
            ) : null}
          </Panel>
        </div>

        <aside className="min-w-0 space-y-6">
          <Panel title={t('dash.viewAs')}>
            {refusal ? (
              <p className="text-sm text-muted-foreground">{t(refusal)}</p>
            ) : (
              <ViewAsForm userId={user.id} minutes={IMPERSONATION_MINUTES} />
            )}
          </Panel>

          <Panel title={t('dash.viewAsHistory')}>
            {impersonations.length === 0 ? (
              <Empty>{t('dash.viewAsNone')}</Empty>
            ) : (
              <ul className="space-y-3">
                {impersonations.map((view) => {
                  const running = !view.endedAt && view.expiresAt && view.expiresAt.getTime() > now
                  const expired = view.endReason === 'expired' || (!view.endedAt && !running)
                  return (
                    <li key={view.id} className="text-sm">
                      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant={running ? 'warning' : 'neutral'}>
                          {running ? t('dash.viewAsActive') : expired ? t('dash.viewAsExpired') : t('dash.viewAsEnded')}
                        </Badge>
                        <span className="numeric">{formatDateTime(view.startedAt)}</span>
                      </p>
                      <p className="mt-1">
                        <UserText>{view.reason}</UserText>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="ltr-island">{view.admin.email ?? view.admin.name}</span>
                        {view.ticketRef ? (
                          <>
                            {' · '}
                            <span className="ltr-island">{view.ticketRef}</span>
                          </>
                        ) : null}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          <Panel title={t('dash.userSample')}>
            <p className="text-sm">
              {sample ? (
                <>
                  {t('dash.sampleClaimedOn')} <span className="numeric">{formatDate(sample.grantedAt)}</span>
                </>
              ) : (
                <span className="text-muted-foreground">{t('dash.sampleNotClaimed')}</span>
              )}
            </p>
          </Panel>

          {user.creator ? (
            <Panel title={t('dash.userCreator')}>
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <UserText>{user.creator.displayNameAr}</UserText>
                <StatusBadge domain="creator" value={user.creator.status} />
              </p>
              <p className="ltr-island mt-0.5 text-xs text-muted-foreground">@{user.creator.handle}</p>
              <a
                href={`/admin/creators?q=${encodeURIComponent(user.creator.handle)}`}
                className="mt-3 inline-block text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {t('dash.openCreator')}
              </a>
            </Panel>
          ) : null}
        </aside>
      </div>
    </>
  )
}
