import type { Prisma, Role } from '@prisma/client'
import { db } from '@/lib/db'

/**
 * Finding a person — the reads behind `/admin/users` and `/admin/users/[id]`.
 *
 * The operator runs Laqta alone, so the one question support always starts
 * with is "who is this?". A customer writes from an email, a phone number, or
 * a name they typed at sign-up; any of the three has to find the account.
 */

export const USER_ROLES: Role[] = ['buyer', 'creator', 'admin']

/**
 * Phone digits the way they are stored. Numbers are kept E.164 (`+9665…`,
 * `+201…`), but people read them out with the national 0 (`055…`, `010…`), so
 * a leading 0 is dropped before matching — `0555` finds `+966555…`.
 */
function phoneDigits(q: string): string | null {
  const digits = q.replace(/\D/g, '').replace(/^00/, '').replace(/^0/, '')
  return digits.length >= 4 ? digits : null
}

export function userSearchWhere(q?: string, role?: string): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {
    // The house account is the licensor of the free sample, not a person.
    NOT: { creator: { isHouse: true } },
  }
  if (role && (USER_ROLES as string[]).includes(role)) where.role = role as Role

  const term = q?.trim()
  if (term) {
    const digits = phoneDigits(term)
    where.OR = [
      { email: { contains: term, mode: 'insensitive' } },
      { name: { contains: term, mode: 'insensitive' } },
      { legalName: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term } },
      ...(digits ? [{ phone: { contains: digits } }] : []),
      { creator: { displayNameAr: { contains: term, mode: 'insensitive' } } },
      { creator: { displayNameEn: { contains: term, mode: 'insensitive' } } },
    ]
  }
  return where
}

export async function searchUsers(q?: string, role?: string) {
  const where = userSearchWhere(q, role)
  const [users, counts] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        creator: { select: { displayNameAr: true } },
        _count: { select: { orders: true } },
      },
    }),
    db.user.groupBy({
      by: ['role'],
      where: userSearchWhere(q),
      _count: { role: true },
    }),
  ])
  return { users, byRole: new Map(counts.map((row) => [row.role, row._count.role])) }
}

/** Everything `/admin/users/[id]` shows, in one round of queries. */
export async function loadUserDetail(id: string) {
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      phone: true,
      phoneVerified: true,
      name: true,
      country: true,
      locale: true,
      role: true,
      status: true,
      billingEntityType: true,
      legalName: true,
      twoFactorEnabled: true,
      createdAt: true,
      creator: {
        select: { id: true, handle: true, displayNameAr: true, status: true, isHouse: true },
      },
    },
  })
  if (!user) return null

  const [orders, entitlements, comps, messages, impersonations] = await Promise.all([
    db.order.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        currency: true,
        paymentMethod: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    db.entitlement.findMany({
      where: { userId: id },
      orderBy: { grantedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        grantedAt: true,
        revokedAt: true,
        revokeReason: true,
        clipIdsSnapshot: true,
        album: {
          select: {
            id: true,
            slug: true,
            titleAr: true,
            creator: { select: { handle: true, isHouse: true } },
          },
        },
        orderItem: { select: { order: { select: { orderNumber: true } } } },
      },
    }),
    db.compDownload.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        isAlbumZip: true,
        fileCount: true,
        createdAt: true,
        album: { select: { titleAr: true } },
        clip: { select: { titleAr: true } },
      },
    }),
    user.email
      ? db.contactMessage.findMany({
          where: { email: { equals: user.email, mode: 'insensitive' } },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { id: true, topic: true, message: true, status: true, createdAt: true },
        })
      : Promise.resolve([]),
    db.impersonation.findMany({
      where: { targetUserId: id },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        reason: true,
        ticketRef: true,
        startedAt: true,
        endedAt: true,
        expiresAt: true,
        endReason: true,
        admin: { select: { name: true, email: true } },
      },
    }),
  ])

  const sample = entitlements.find((row) => row.album.creator.isHouse) ?? null

  return { user, orders, entitlements, comps, messages, impersonations, sample }
}

export type UserDetail = NonNullable<Awaited<ReturnType<typeof loadUserDetail>>>
