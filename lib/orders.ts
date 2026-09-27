import type { Prisma } from '@prisma/client'
import { priceNow } from '@/lib/offers'
import { db } from '@/lib/db'
import { currentLicenceId } from '@/lib/licence'
import { evaluatePromo, redeem } from '@/lib/promos'
import { resolveCommission, vatOn } from '@/lib/commission'
import { bundledCommission, bundleLines, resolveBundles } from '@/lib/bundles'
import { createPaymentIntent, type PaymentMethod } from '@/lib/payments'
import { drainSoon } from '@/lib/outbox'
import { attachCertificates, notifyCreatorSales, notifyOrderPaid, notifyOrderPlaced } from '@/lib/notifications'
import { generateCertificate } from '@/lib/certificate'
import { DEFAULT_LOCALE, isLocale } from '@/lib/locale'
import { getPublicSample, sampleManifest, type SampleManifestClip } from '@/lib/sample'

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
 *
 * The one other writer of an OrderItem is `claimSample`, below, and it lives in
 * this file for the same reason: a free sample claim takes the SAME two
 * snapshots — a frozen manifest and the licence in force — as a $0 order, and
 * is settled by the same `settleOrder`.
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
  promoCode,
}: {
  userId: string
  lines: CheckoutLine[]
  billing: BillingEntity
  method: PaymentMethod
  /** The buyer's reading language, for the gateway's return URL. */
  locale?: string
  /** A promo code typed at checkout (DEV-63). */
  promoCode?: string | null
}): Promise<CheckoutResult> {
  if (lines.length === 0) return { ok: false, messageKey: 'cart.empty' }

  // Frozen onto every line below. Never the album's own pointer: an album
  // created without one would sell with a blank licence (DEV-06).
  const licenceVersionId = await currentLicenceId()
  if (!licenceVersionId) {
    console.error('[checkout] no current LicenceVersion — refusing to sell without a licence')
    return { ok: false, messageKey: 'cart.unavailable' }
  }

  const albums = await db.album.findMany({
    // Never an unpriced album (priceStandard 0 until approval, DEV-09).
    where: { id: { in: lines.map((line) => line.albumId) }, status: 'live', priceStandard: { gt: 0 } },
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

  // Bundles the cart completes (DEV-62), priced now — the cart page's figure
  // is display only. Laqta pays their discount (lib/bundles.ts).
  const bundles = await resolveBundles(bundleLines(albums))

  // The promo code, re-evaluated here against the albums as they are now —
  // the preview on the page is not the boundary (lib/promos.ts). Only albums
  // outside an applied bundle: discounts do not stack.
  let promo: Extract<Awaited<ReturnType<typeof evaluatePromo>>, { ok: true }> | null = null
  if (promoCode && promoCode.trim()) {
    const evaluated = await evaluatePromo(
      promoCode,
      albums
        .filter((album) => !bundles.bundleOf[album.id])
        .map((album) => ({ albumId: album.id, gross: priceNow(album).priceStandard })),
    )
    if (!evaluated.ok) return { ok: false, messageKey: evaluated.error }
    promo = evaluated
  }

  const orderNumber = await nextOrderNumber()

  // One transaction: an order that exists without its entitlements is worse
  // than no order at all — the buyer has paid and owns nothing.
  const order = await db.$transaction(async (tx) => {
    let subtotal = 0
    let vatAmount = 0

    // One use of the code, against its cap, in the same transaction as the
    // order — two buyers cannot both take the last use.
    if (promo && !(await redeem(tx, promo.promoId))) throw new Error('PROMO_EXHAUSTED')

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

      // The price NOW — a running offer's price inside its dates (DEV-60).
      const listPrice = priceNow(album).priceStandard
      const bundleDiscount = bundles.discounts[album.id] ?? 0
      const commissionFor = (grossAmount: number) =>
        resolveCommission({
          grossAmount,
          tier: album.creator.tier,
          isExclusive: album.isExclusive,
          override: album.creator.commissionRateOverride
            ? Number(album.creator.commissionRateOverride)
            : null,
        })

      // A bundled line (DEV-62): the creator is paid on the album's own price
      // and the bundle discount comes out of Laqta's commission. Otherwise the
      // price actually paid is the list price less this line's share of the
      // promo discount, and commission, VAT and refunds all run on it (DEV-63).
      const bundled = bundleDiscount > 0
        ? bundledCommission({ preDiscount: listPrice, discount: bundleDiscount, standalone: commissionFor(listPrice) })
        : null
      const lineDiscount = bundled ? bundleDiscount : (promo?.discounts[album.id] ?? 0)
      const gross = bundled ? bundled.paid : Math.round((listPrice - lineDiscount) * 100) / 100
      const lineVat = vatOn(gross, VAT_RATE)
      const commission = bundled ?? commissionFor(gross)

      const item = await tx.orderItem.create({
        data: {
          orderId: created.id,
          albumId: album.id,
          creatorId: album.creator.id,
          licenceVersionId,
          grossAmount: gross,
          discountAmount: lineDiscount,
          bundleId: bundles.bundleOf[album.id] ?? null,
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
      data: {
        subtotal,
        vatAmount,
        total: subtotal + vatAmount,
        ...(promo ? { promoCodeId: promo.promoId, promoCode: promo.code, discountAmount: promo.total } : {}),
        bundleDiscountAmount: bundles.applied.reduce((sum, bundle) => sum + bundle.discount, 0),
      },
    })
  }).catch((error: unknown) => {
    // The code's last use went to someone else between evaluate and redeem.
    if (error instanceof Error && error.message === 'PROMO_EXHAUSTED') return null
    throw error
  })
  if (!order) return { ok: false, messageKey: 'promo.exhausted' }

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

  // What to transfer, where, and what happens next. Only bank transfer is
  // told (the function checks); it never throws, so a mail problem cannot
  // turn a placed order into an error on the checkout page.
  await notifyOrderPlaced(order.id)

  return { ok: true, orderId: order.id, orderNumber: order.orderNumber, settled: false }
}

/**
 * Mark an order paid and post the creator ledger.
 *
 * Split out because bank transfer settles later, by hand, from the admin — the
 * accounting has to be identical whichever rail got there.
 */
export async function settleOrder(
  orderId: string,
  reference: string,
  options: {
    /**
     * Render certificates and drain mail AFTER returning, instead of before.
     * For a request a person is waiting on (the free sample claim): the order
     * is already paid and downloadable when this returns; only the PDF, which
     * launches Chrome, follows a few seconds later.
     */
    deferDocuments?: boolean
  } = {},
) {
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

  const settled = await db.$transaction(async (tx) => {
    /*
     * Compare-and-set, not a blind update.
     *
     * The check above reads outside the transaction, so two callers — an
     * operator's double click, a gateway webhook retried while the first
     * delivery is still settling — can both pass it. The conditional update
     * takes the row lock: the second caller waits, then matches nothing and
     * leaves. Without it the creator ledger would be posted twice and the
     * buyer would get two receipts.
     */
    const flipped = await tx.order.updateMany({
      where: { id: orderId, status: { not: 'paid' } },
      data: { status: 'paid', paidAt: new Date(), gatewayRef: reference },
    })
    if (flipped.count === 0) return false

    for (const item of order.items) {
      /*
       * A zero-value line posts nothing to the creator ledger.
       *
       * The free sample is the case: commission on 0 is 0, and a `sale` row of
       * 0.00 would show on /studio/earnings as a sale that earned nothing —
       * noise that reads as a bug. Nothing was sold, so nothing is recorded;
       * the claim is still counted on the (house) album.
       */
      if (Number(item.grossAmount) === 0 && Number(item.creatorNetAmount) === 0) {
        await tx.album.update({
          where: { id: item.albumId },
          data: { salesCount: { increment: 1 } },
        })
        continue
      }

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

    /*
     * No tax invoice for a zero-value order. Nothing was supplied for a
     * consideration, so there is nothing to invoice or report to ZATCA; the
     * order number and the licence certificate are the record. Only the free
     * sample produces one today.
     */
    if (Number(order.total) > 0) {
      await tx.invoice.create({
        data: {
          orderId,
          invoiceNumber: `INV-${order.orderNumber}`,
          uuid: crypto.randomUUID(),
        },
      })
    }

    /*
     * The receipt is QUEUED here, in the same transaction that marks the order
     * paid — so "they paid" and "we owe them an email" become one fact. It is
     * not SENT here: a mail failure must never roll back a purchase.
     * `notifyOrderPaid` is idempotent on the order number, so a gateway
     * webhook calling it again after this commit sends nothing twice.
     *
     * The certificate is not attached yet either. Rendering a PDF launches a
     * browser, which has no business inside a database transaction; it is
     * attached below once it exists, and only then is the drain asked to run.
     */
    outboxId = await notifyOrderPaid(orderId, { client: tx, drain: false })
    // «وصلك بيع جديد» to each creator in the order (DEV-30), same transaction.
    await notifyCreatorSales(orderId, tx)
    return true
  })

  // Another caller settled it between our read and our lock. Nothing to do.
  if (!settled) return

  const documents = async () => {
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
    // would couple attachment to the payload's shape. Never throws.
    if (outboxId) await attachCertificates(outboxId, keys)

    drainSoon()
  }

  if (options.deferDocuments) {
    void documents().catch((error) => console.error('[orders] documents after settle:', error))
  } else {
    await documents()
  }
}

/**
 * Claim the free sample — owner decision 2026-09-24.
 *
 * A zero-value order through the same frozen path as a purchase: one Order,
 * one OrderItem carrying `clipManifestSnapshot` (the chosen clips as they are
 * NOW, with the album each is sold in) and the licence in force, one
 * Entitlement, one LicenceCertificate — then `settleOrder`, which marks it
 * paid, posts no ledger row and raises no tax invoice for a zero-value line,
 * and queues the `sample.claimed` message with the certificate.
 *
 * Never touches the cart or a payment gateway: there is nothing to pay, and a
 * Paymob intention for 0 would be refused by the gateway anyway.
 *
 * ── One claim per user, idempotent ──────────────────────────────────────────
 * `Entitlement` is unique on (userId, albumId), and the sample is one album.
 * A second claim — a double click, a refresh, the sign-in callback firing
 * twice — finds the first entitlement and returns it. Two concurrent claims
 * race to that unique index; the loser's whole transaction rolls back and it
 * returns the winner's entitlement.
 */
export type SampleClaimResult =
  { ok: true; entitlementId: string; alreadyClaimed: boolean } | { ok: false; messageKey: string }

export async function claimSample(
  userId: string,
  options: { deferDocuments?: boolean } = {},
): Promise<SampleClaimResult> {
  const sample = await getPublicSample()
  if (!sample) return { ok: false, messageKey: 'sample.unavailable' }

  const existing = await db.entitlement.findUnique({
    where: { userId_albumId: { userId, albumId: sample.albumId } },
    select: { id: true, revokedAt: true },
  })
  if (existing) {
    // Revoked by an operator: not re-granted by claiming again.
    if (existing.revokedAt) return { ok: false, messageKey: 'sample.unavailable' }
    return { ok: true, entitlementId: existing.id, alreadyClaimed: true }
  }

  const manifest = await sampleManifest(sample.id)
  if (manifest.length === 0) return { ok: false, messageKey: 'sample.unavailable' }

  const [user, licence, album] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        billingEntityType: true,
        legalName: true,
        crNumber: true,
        vatNumber: true,
        billingAddress: true,
      },
    }),
    // The licence IN FORCE now — the same one every album is sold under.
    db.licenceVersion.findFirst({ where: { isCurrent: true }, select: { id: true } }),
    db.album.findUnique({
      where: { id: sample.albumId },
      select: { id: true, slug: true, creatorId: true, licenceVersionId: true },
    }),
  ])
  if (!user || !album) return { ok: false, messageKey: 'sample.unavailable' }

  const attempt = async () => {
    const orderNumber = await nextOrderNumber()
    return db.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          orderNumber,
          status: 'pending',
          subtotal: 0,
          vatRate: VAT_RATE,
          vatAmount: 0,
          total: 0,
          // Marks the order as a sample claim everywhere it is read: the
          // receipt template, /admin/orders, /account/purchases.
          paymentMethod: 'sample',
          billingEntitySnapshot: {
            billingEntityType: user.billingEntityType,
            legalName: user.legalName ?? null,
            crNumber: user.crNumber ?? null,
            vatNumber: user.vatNumber ?? null,
            billingAddress: user.billingAddress ?? null,
          } as Prisma.InputJsonValue,
        },
      })

      const item = await tx.orderItem.create({
        data: {
          orderId: order.id,
          albumId: album.id,
          creatorId: album.creatorId,
          licenceVersionId: licence?.id ?? album.licenceVersionId,
          grossAmount: 0,
          vatAmount: 0,
          // Commission on nothing is nothing. Stated, not computed: no rate
          // is resolved for a house album that is never sold.
          commissionRate: 0,
          commissionAmount: 0,
          creatorNetAmount: 0,
          commissionBasis: { kind: 'free_sample', effectiveRate: 0 } as Prisma.InputJsonValue,
          // ── FROZEN ──────────────────────────────────────────────────────
          clipManifestSnapshot: manifest as unknown as Prisma.InputJsonValue,
        },
      })

      // `create`, never `upsert`: the unique index is the one-claim rule.
      const entitlement = await tx.entitlement.create({
        data: {
          userId,
          albumId: album.id,
          orderItemId: item.id,
          clipIdsSnapshot: manifest.map((clip) => clip.id),
        },
        select: { id: true },
      })

      await tx.licenceCertificate.create({
        data: { orderItemId: item.id, certificateNumber: `LIC-${orderNumber}-sample` },
      })

      return { orderId: order.id, entitlementId: entitlement.id }
    })
  }

  let created: { orderId: string; entitlementId: string }
  try {
    created = await attempt()
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') throw error
    // Either a concurrent claim by the same user won the entitlement, or a
    // concurrent checkout took the same order number. Nothing was written.
    const winner = await db.entitlement.findUnique({
      where: { userId_albumId: { userId, albumId: album.id } },
      select: { id: true },
    })
    if (winner) return { ok: true, entitlementId: winner.id, alreadyClaimed: true }
    created = await attempt()
  }

  await settleOrder(created.orderId, 'SAMPLE', { deferDocuments: options.deferDocuments })
  return { ok: true, entitlementId: created.entitlementId, alreadyClaimed: false }
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
          sample: { select: { id: true } },
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
    /** The free sample: its public page is /sample, not an album page. */
    isSample: entitlement.album.sample != null,
    // The manifest, not the album.
    clips: (entitlement.orderItem.clipManifestSnapshot ?? []) as Array<{
      id: string
      slug: string
      titleAr: string
      titleEn: string
      masterKey: string | null
      proxyKey: string | null
      /** Present on sample manifests only: the album the clip is sold in. */
      sourceAlbum?: SampleManifestClip['sourceAlbum']
    }>,
  }))
}
