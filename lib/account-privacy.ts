import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'

/**
 * The account holder's own privacy controls (DEV-52; decision BIZ-12, 2026-09-28:
 * "a button in the account", not an email to support).
 *
 * ── Export ──────────────────────────────────────────────────────────────────
 * Everything Laqta holds that is ABOUT this person, as one JSON file: profile,
 * billing details, orders with their lines and licence numbers, boards, reviews,
 * footage requests, downloads and the waitlist entry. Not the footage itself —
 * that is the library's job — and nothing about anyone else (no creator's
 * commission, no other buyer).
 *
 * ── Deletion ────────────────────────────────────────────────────────────────
 * Deletion keeps the User ROW and clears the PERSON. Orders, invoices and
 * licence certificates point at the row and must be kept for tax; a licence
 * already granted stays valid, because it was paid for. Everything personal
 * goes: name, email, mobile, password, 2FA, billing profile, boards, cart,
 * reviews, the waitlist entry, and the IP / browser recorded against downloads.
 * `deletedAt` makes the `jwt` callback (lib/auth.ts) refuse every session the
 * account still has, so it is signed out everywhere at the next render.
 *
 * Creators and admins cannot delete themselves here: a creator has albums that
 * buyers hold licences to, and money owed; an admin is the operator. Both are
 * told to write to support, where the owner handles it by hand.
 */

export type DeletionRefusal = 'not_buyer' | 'confirm_mismatch' | 'already_deleted'

/** What the reader has to type to confirm: their email, else their mobile. */
export function deletionConfirmationValue(user: { email: string | null; phone: string | null }) {
  return (user.email ?? user.phone ?? '').trim()
}

function sameConfirmation(typed: string, expected: string) {
  return expected.length > 0 && typed.trim().toLowerCase() === expected.toLowerCase()
}

export async function deleteOwnAccount(
  userId: string,
  typed: string,
): Promise<{ ok: true } | { ok: false; reason: DeletionRefusal }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, phone: true, role: true, deletedAt: true, creator: { select: { id: true } } },
  })
  if (!user || user.deletedAt) return { ok: false, reason: 'already_deleted' }
  if (user.role !== 'buyer' || user.creator) return { ok: false, reason: 'not_buyer' }
  if (!sameConfirmation(typed, deletionConfirmationValue(user))) return { ok: false, reason: 'confirm_mismatch' }

  const email = user.email

  await db.$transaction(async (tx) => {
    await tx.board.deleteMany({ where: { userId } })
    await tx.cart.deleteMany({ where: { userId } })
    await tx.albumReview.deleteMany({ where: { userId } })
    await tx.account.deleteMany({ where: { userId } })
    await tx.session.deleteMany({ where: { userId } })
    await tx.passwordResetToken.deleteMany({ where: { userId } })
    // Download history stays — it is the record of what a licence was used
    // for — but not where it was downloaded from.
    await tx.download.updateMany({ where: { userId }, data: { ip: null, userAgent: null } })
    await tx.compDownload.updateMany({ where: { userId }, data: { ip: null, userAgent: null } })
    await tx.footageRequest.updateMany({
      where: { OR: [{ userId }, ...(email ? [{ email }] : [])] },
      data: { userId: null, email: 'deleted' },
    })
    if (email) await tx.waitlistEntry.deleteMany({ where: { email } })

    await tx.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        status: 'suspended',
        email: null,
        emailVerified: null,
        phone: null,
        phoneVerified: null,
        passwordHash: null,
        name: null,
        image: null,
        country: null,
        legalName: null,
        crNumber: null,
        vatNumber: null,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        billingAddress: Prisma.DbNull,
      },
    })

  })

  // No email in the audit row — the point is that it is gone.
  await recordAudit({ actorId: userId, action: 'user.delete_self', entity: 'User', entityId: userId })
  return { ok: true }
}

const money = (value: unknown) => Number(value ?? 0)

export async function exportAccountData(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      phone: true,
      phoneVerified: true,
      country: true,
      locale: true,
      role: true,
      createdAt: true,
      billingEntityType: true,
      legalName: true,
      crNumber: true,
      vatNumber: true,
      billingAddress: true,
      twoFactorEnabled: true,
    },
  })
  if (!user) return null

  const [orders, boards, reviews, requests, downloads, samples, waitlist] = await Promise.all([
    db.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        items: {
          include: {
            album: { select: { slug: true, titleAr: true, titleEn: true } },
            certificate: { select: { certificateNumber: true, issuedAt: true } },
          },
        },
        invoice: { select: { invoiceNumber: true } },
      },
    }),
    db.board.findMany({
      where: { userId },
      include: { clips: { select: { clipId: true } } },
    }),
    db.albumReview.findMany({
      where: { userId },
      select: { rating: true, bodyAr: true, status: true, createdAt: true, album: { select: { slug: true } } },
    }),
    db.footageRequest.findMany({
      where: { OR: [{ userId }, ...(user.email ? [{ email: user.email }] : [])] },
      select: { briefAr: true, locationSlug: true, categorySlug: true, status: true, createdAt: true },
    }),
    db.download.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, isAlbumZip: true, clipId: true, ip: true, userAgent: true, entitlement: { select: { album: { select: { slug: true } } } } },
    }),
    db.compDownload.findMany({
      where: { userId },
      select: { createdAt: true, isAlbumZip: true, clipId: true, album: { select: { slug: true } } },
    }),
    user.email
      ? db.waitlistEntry.findUnique({
          where: { email: user.email },
          select: { locale: true, source: true, consentAt: true, consentText: true, unsubscribedAt: true },
        })
      : null,
  ])

  return {
    exportedAt: new Date().toISOString(),
    site: 'Laqta — لقطة',
    account: user,
    orders: orders.map((order) => ({
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      paymentMethod: order.paymentMethod,
      currency: order.currency,
      subtotal: money(order.subtotal),
      discount: money(order.discountAmount) + money(order.bundleDiscountAmount),
      vat: money(order.vatAmount),
      total: money(order.total),
      refunded: money(order.refundedAmount),
      promoCode: order.promoCode,
      poNumber: order.poNumber,
      billing: order.billingEntitySnapshot,
      invoiceNumber: order.invoice?.invoiceNumber ?? null,
      albums: order.items.map((item) => ({
        album: item.album.slug,
        titleAr: item.album.titleAr,
        titleEn: item.album.titleEn,
        price: money(item.grossAmount),
        refunded: money(item.refundedAmount),
        licenceCertificate: item.certificate?.certificateNumber ?? null,
      })),
    })),
    boards: boards.map((board) => ({
      name: board.name,
      public: board.isPublic,
      createdAt: board.createdAt,
      clips: board.clips.map((clip) => clip.clipId),
    })),
    reviews: reviews.map((review) => ({ ...review, album: review.album.slug })),
    footageRequests: requests,
    downloads: downloads.map((row) => ({
      at: row.createdAt,
      album: row.entitlement.album.slug,
      clip: row.clipId,
      wholeAlbum: row.isAlbumZip,
      ip: row.ip,
      browser: row.userAgent,
    })),
    freeSamples: samples.map((row) => ({ at: row.createdAt, album: row.album.slug, clip: row.clipId, wholeAlbum: row.isAlbumZip })),
    waitlist,
  }
}
