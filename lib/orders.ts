import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { resolveCommission, vatOn } from '@/lib/commission'
import { createPaymentIntent, type PaymentMethod } from '@/lib/payments'
import { enqueue, drainSoon } from '@/lib/outbox'
import { generateCertificate } from '@/lib/certificate'
import { DEFAULT_LOCALE, isLocale } from '@/lib/locale'
import { siteUrl } from '@/lib/site'

/**
 * Checkout.
 *
 * ── The two freezes, and why they are here rather than at read time ─────────
 * This function is the only place an OrderItem is created, because it is the
 * only place two irreversible snapshots are taken:
 *
 *   1. `clipManifestSnapshot` — the exact clips owned, with titles and keys,
 *      as they exist at this instant. The buyer's library is served from this
 *      forever. If the creator later edits, replaces or deletes clips, what
 *      the buyer owns does not move. Computing entitlement from the live album
 *      would silently break "buy once, own forever", which is the entire
 *      business model, and it would break quietly — nobody notices until a
 *      buyer complains that footage they paid for is gone.
 *
 *   2. `licenceVersionId` + the commission fields. The licence text in force
 *      today governs this order for its whole life, and the commission rate is
 *      resolved once, here. A creator promoted to Gold in March must not
 *      retroactively change what they earned in January, and a refund must
 *      reverse against the rate that was actually charged.
 *
 * Nothing downstream may recompute either. Refunds read `commissionRate` off
 * the OrderItem; the library reads `clipIdsSnapshot` off the Entitlement.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type CheckoutLine = { albumId: string }

export type BillingEntity = {
  billingEntityType: 'individual' | 'business'
  legalName?: string | null
  crNumber?: string | null
  vatNumber?: string | null
  poNumber?: string | null
  billingAddress?: Prisma.InputJsonValue | null
}

export type CheckoutResult =
  | {
      ok: true
      orderId: string
      orderNumber: string
      settled: boolean
      /** Set when the method pays on a hosted page (Paymob). */
      redirectUrl?: string
    }
  | { ok: false; messageKey: string }

const VAT_RATE = Number(process.env.VAT_RATE ?? 0.15)

async function nextOrderNumber() {
  const year = new Date().getFullYear()
  const count = await db.order.count()
  return `LQ-${year}-${String(1000 + count + 1)}`
}

export async function checkout({
  userId,
  lines,
  billing,
  method,
  locale,
}: {
  userId: string
  lines: CheckoutLine[]
  billing: BillingEntity
  method: PaymentMethod
  /** The buyer's reading language, for the gateway's return URL. */
  locale?: string
}): Promise<CheckoutResult> {
  if (lines.length === 0) return { ok: false, messageKey: 'cart.empty' }

  const albums = await db.album.findMany({
    where: { id: { in: lines.map((line) => line.albumId) }, status: 'live' },
    include: {
      creator: { select: { id: true, tier: true, commissionRateOverride: true } },
      clips: {
        orderBy: { orderIndex: 'asc' },
        select: {
          id: true,
          slug: true,
          titleAr: true,
          titleEn: true,
          masterKey: true,
          proxyKey: true,
        },
      },
    },
  })

  if (albums.length !== lines.length) return { ok: false, messageKey: 'cart.unavailable' }

  const orderNumber = await nextOrderNumber()

  // One transaction: an order that exists without its entitlements is worse
  // than no order at all — the buyer has paid and owns nothing.
  const order = await db.$transaction(async (tx) => {
    let subtotal = 0
    let vatAmount = 0

    const created = await tx.order.create({
      data: {
        userId,
        orderNumber,
        status: 'pending',
        subtotal: 0,
        vatRate: VAT_RATE,
        vatAmount: 0,
        total: 0,
        paymentMethod: method,
        poNumber: billing.poNumber ?? null,
        // Frozen too: the tax invoice must reflect the entity as it was
        // agreed, not as the user later edits their profile.
        billingEntitySnapshot: {
          billingEntityType: billing.billingEntityType,
          legalName: billing.legalName ?? null,
          crNumber: billing.crNumber ?? null,
          vatNumber: billing.vatNumber ?? null,
          billingAddress: billing.billingAddress ?? null,
        } as Prisma.InputJsonValue,
      },
    })

    for (const line of lines) {
      const album = albums.find((candidate) => candidate.id === line.albumId)
      if (!album) throw new Error('ALBUM_UNAVAILABLE')

      const gross = Number(album.priceStandard)
      const lineVat = vatOn(gross, VAT_RATE)

      const commission = resolveCommission({
        grossAmount: gross,
        tier: album.creator.tier,
        isExclusive: album.isExclusive,
        override: album.creator.commissionRateOverride
          ? Number(album.creator.commissionRateOverride)
          : null,
      })

      const item = await tx.orderItem.create({
        data: {
          orderId: created.id,
          albumId: album.id,
          creatorId: album.creator.id,
          licenceVersionId: album.licenceVersionId,
          grossAmount: gross,
          vatAmount: lineVat,
          commissionRate: commission.rate,
          commissionAmount: commission.commissionAmount,
          creatorNetAmount: commission.creatorNetAmount,
          commissionBasis: commission.basis as Prisma.InputJsonValue,
          // ── FROZEN ──────────────────────────────────────────────────────
          clipManifestSnapshot: album.clips as unknown as Prisma.InputJsonValue,
        },
      })

      await tx.entitlement.upsert({
        where: { userId_albumId: { userId, albumId: album.id } },
        update: { orderItemId: item.id, revokedAt: null },
        create: {
          userId,
          albumId: album.id,
          orderItemId: item.id,
          clipIdsSnapshot: album.clips.map((clip) => clip.id),
        },
      })

      await tx.licenceCertificate.create({
        data: {
          orderItemId: item.id,
          certificateNumber: `LIC-${orderNumber}-${album.slug.slice(0, 8)}`,
        },
      })

      subtotal += gross
      vatAmount += lineVat
    }

    return tx.order.update({
      where: { id: created.id },
      data: { subtotal, vatAmount, total: subtotal + vatAmount },
    })
  })

  const buyer = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true },
  })

  const outcome = await createPaymentIntent({
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount: Number(order.total),
    currency: order.currency,
    method,
    buyer: {
      name: billing.legalName || buyer?.name || null,
      email: buyer?.email ?? null,
      phone: buyer?.phone ?? null,
    },
    locale,
  })

  if (outcome.status === 'unavailable') {
    await db.order.update({ where: { id: order.id }, data: { status: 'failed' } })
    return { ok: false, messageKey: outcome.reasonKey }
  }

  if (outcome.status === 'paid') {
    await settleOrder(order.id, outcome.reference)
    return { ok: true, orderId: order.id, orderNumber: order.orderNumber, settled: true }
  }

  // Hosted checkout (Paymob). The order stays `pending` and is settled ONLY by
  // the signed server callback (lib/paymob-callback.ts → settleOrder) — never
  // by the buyer's browser coming back.
  if (outcome.status === 'redirect') {
    await db.order.update({
      where: { id: order.id },
      data: { gatewayRef: outcome.reference },
    })
    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      settled: false,
      redirectUrl: outcome.url,
    }
  }

  // Awaiting settlement — bank transfer / Net-30. The entitlement already
  // exists so the buyer can see what they have bought, but nothing downloads
  // until an admin marks the order paid.
  await db.order.update({
    where: { id: order.id },
    data: { gatewayRef: outcome.reference },
  })
  return { ok: true, orderId: order.id, orderNumber: order.orderNumber, settled: false }
}

/**
 * Mark an order paid and post the creator ledger.
 *
 * Split out because bank transfer settles later, by hand, from the admin — the
 * accounting has to be identical whichever rail got there.
 */
export async function settleOrder(orderId: string, reference: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { album: { select: { titleAr: true, titleEn: true } } } },
      user: { select: { name: true, email: true, locale: true } },
    },
  })
  if (!order || order.status === 'paid') return

  const holdDays = Number(process.env.PAYOUT_HOLD_DAYS ?? 30)
  // Captured inside the transaction so the certificates can be attached to
  // exactly the row that was queued, rather than one matching its payload.
  let outboxId: string | null = null

  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'paid', paidAt: new Date(), gatewayRef: reference },
    })

    for (const item of order.items) {
      const creator = await tx.creator.findUnique({
        where: { id: item.creatorId },
        select: { balanceHeld: true, lifetimeGmv: true },
      })

      const previous = await tx.creatorLedger.findFirst({
        where: { creatorId: item.creatorId },
        orderBy: { createdAt: 'desc' },
        select: { balanceAfter: true },
      })

      const net = Number(item.creatorNetAmount)
      const balanceAfter = Number(previous?.balanceAfter ?? 0) + net

      await tx.creatorLedger.create({
        data: {
          creatorId: item.creatorId,
          entryType: 'sale',
          amount: net,
          balanceAfter,
          orderItemId: item.id,
          // The 30-day hold: funds are not payable until the refund window
          // has closed on the sale that produced them.
          availableAt: new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000),
        },
      })

      await tx.creator.update({
        where: { id: item.creatorId },
        data: {
          lifetimeGmv: Number(creator?.lifetimeGmv ?? 0) + Number(item.grossAmount),
          balanceHeld: Number(creator?.balanceHeld ?? 0) + net,
        },
      })

      await tx.album.update({
        where: { id: item.albumId },
        data: { salesCount: { increment: 1 } },
      })
    }

    await tx.invoice.create({
      data: {
        orderId,
        invoiceNumber: `INV-${order.orderNumber}`,
        uuid: crypto.randomUUID(),
      },
    })

    /*
     * The confirmation is QUEUED here, in the same transaction that marks the
     * order paid — so "they paid" and "we owe them an email" become one fact.
     * It is not SENT here: a mail failure must never roll back a purchase.
     *
     * The certificate is not attached yet either. Rendering a PDF launches a
     * browser, which has no business inside a database transaction; the drain
     * below attaches it once it exists.
     */
    if (order.user?.email) {
      const queued = await enqueue(tx, {
        template: 'order.confirmed',
        toEmail: order.user.email,
        locale: order.user.locale,
        payload: {
          name: order.user.name ?? order.user.email,
          orderNumber: order.orderNumber,
          // Database copy follows the reader, like every other surface. The
          // Arabic title is the fallback, never the default for an English
          // recipient.
          albums: order.items
            .map((item) => {
              const title =
                order.user?.locale === 'en'
                  ? item.album.titleEn || item.album.titleAr
                  : item.album.titleAr || item.album.titleEn
              return `• ${title}`
            })
            .join('\n'),
          libraryUrl: siteUrl('/account/library', order.user.locale ?? DEFAULT_LOCALE),
        },
      })
      outboxId = queued.id
    }
  })

  /*
   * Documents and delivery, after the money is safely committed.
   *
   * Every failure here is logged and swallowed. The order is paid, the
   * entitlement exists, and the buyer can already download from their library
   * — none of that may be undone because a PDF or an SMTP server misbehaved.
   */
  const locale = isLocale(order.user?.locale) ? order.user.locale : DEFAULT_LOCALE

  /*
   * Sequential, NOT Promise.all.
   *
   * Each render launches its own Chrome, so mapping concurrently over the
   * items starts one browser per album at the same instant — three for a
   * typical order, ten for a big one, each a few hundred megabytes. On a small
   * box the later launches fail, and the buyer silently gets no certificate.
   * A purchase is not a latency-critical path; one at a time is correct.
   */
  const keys: string[] = []
  for (const item of order.items) {
    const key = await generateCertificate(item.id, locale)
    if (key) keys.push(key)
  }

  // By id, captured from the enqueue above. Matching on the payload instead
  // would couple attachment to the payload's shape, and updateMany reports
  // success even when it matched nothing.
  if (keys.length && outboxId) {
    await db.mailOutbox
      .update({ where: { id: outboxId }, data: { attachments: keys } })
      .catch((error) => console.error('[orders] could not attach certificates:', error))
  }

  drainSoon()
}

/**
 * What a buyer owns.
 *
 * Reads the frozen snapshot. Deliberately does NOT join through to the live
 * album's clips — see the note at the top of this file.
 */
export async function getLibrary(userId: string) {
  const entitlements = await db.entitlement.findMany({
    where: { userId, revokedAt: null },
    orderBy: { grantedAt: 'desc' },
    include: {
      album: {
        select: {
          slug: true,
          titleAr: true,
          titleEn: true,
          creator: { select: { handle: true, displayNameAr: true, displayNameEn: true } },
        },
      },
      orderItem: {
        select: {
          clipManifestSnapshot: true,
          createdAt: true,
          order: { select: { orderNumber: true, status: true } },
        },
      },
    },
  })

  return entitlements.map((entitlement) => ({
    id: entitlement.id,
    grantedAt: entitlement.grantedAt,
    album: entitlement.album,
    orderNumber: entitlement.orderItem.order.orderNumber,
    paid: entitlement.orderItem.order.status === 'paid',
    // The manifest, not the album.
    clips: (entitlement.orderItem.clipManifestSnapshot ?? []) as Array<{
      id: string
      slug: string
      titleAr: string
      titleEn: string
      masterKey: string | null
      proxyKey: string | null
    }>,
  }))
}
