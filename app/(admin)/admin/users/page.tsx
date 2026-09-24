import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { searchUsers, USER_ROLES } from '@/lib/admin-users'
import { EmptyState } from '@/components/ui/state'
import { UserText } from '@/components/ui/bilingual'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { FilterChips, SearchBox, Toolbar } from '@/components/dashboard/toolbar'
import { StatusBadge } from '@/components/dashboard/status'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatNumber, t } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  await requestLocale()
  return { title: t('dash.usersTitle') }
}

/**
 * Every account, found by whatever the customer wrote from.
 *
 * A table, not rows of cards: the operator is scanning for one person, and a
 * column of names with role, state and order count beside each is the
 * fastest shape to scan. The name opens the account — a plain `<a>`, because
 * this is the navigation support work hangs on (CLAUDE.md: navigations that
 * never commit).
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>
}) {
  await requestLocale()
  await requireAdmin()
  const { q, role } = await searchParams

  const { users, byRole } = await searchUsers(q, role)

  return (
    <>
      <DashboardHeader title={t('dash.usersTitle')} description={t('dash.usersHint')} />

      <Toolbar>
        <SearchBox placeholder={t('dash.searchUsers')} />
        <FilterChips
          param="role"
          options={USER_ROLES.map((value) => ({
            value,
            label: t(`role.${value}`),
            count: byRole.get(value) ?? 0,
          }))}
        />
      </Toolbar>

      {users.length === 0 ? (
        <EmptyState title={t('dash.noUsers')} description={t('dash.usersHint')} />
      ) : (
        <Panel className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('dash.colUser')}</TableHead>
                <TableHead>{t('dash.colRole')}</TableHead>
                <TableHead>{t('dash.colStatus')}</TableHead>
                <TableHead className="text-end">{t('dash.colOrders')}</TableHead>
                <TableHead className="text-end">{t('dash.colJoined')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const title = user.creator?.displayNameAr || user.name || user.email || user.phone
                const contact = [user.email, user.phone].filter(Boolean).join(' · ')
                return (
                  <TableRow key={user.id}>
                    <TableCell className="min-w-0">
                      <a
                        href={`/admin/users/${user.id}`}
                        className="font-medium transition-colors hover:text-foreground hover:underline"
                        data-user-row
                      >
                        <UserText>{title ?? user.id}</UserText>
                      </a>
                      {contact && contact !== title ? (
                        <p className="ltr-island mt-0.5 text-xs text-muted-foreground">{contact}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">{t(`role.${user.role}`)}</TableCell>
                    <TableCell>
                      <StatusBadge domain="user" value={user.status} />
                    </TableCell>
                    <TableCell className="numeric text-end">
                      {formatNumber(user._count.orders)}
                    </TableCell>
                    <TableCell className="text-end text-sm text-muted-foreground">
                      <span className="numeric">{formatDate(user.createdAt)}</span>
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
