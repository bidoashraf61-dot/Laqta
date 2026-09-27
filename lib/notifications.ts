import type { Prisma, PrismaClient } from '@prisma/client'
import { db } from '@/lib/db'
import { enqueue, drainSoon } from '@/lib/outbox'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/locale'
import { siteUrl } from '@/lib/site'

/**
 * Who is told what, and when.
 *
 * Every function here turns a business event into ONE queued message. None of
 * them sends: they write a `MailOutbox` row and ask the drain to run, so a
 * provider outage becomes a pending row on /admin/settings rather than an
 * exception in a checkout or a review.
 *
 * ── Three guarantees every caller relies on ─────────────────────────────────
 * 1. **A mail problem never fails the operation that owed the message.** The
 *    post-commit functions catch and log. The one that runs INSIDE a
 *    transaction (`notifyOrderPaid` from `settleOrder`) only reads and inserts,
 *    so the only way it throws is the database itself failing — which would
 *    fail the transaction anyway.
 * 2. **Idempotent.** Each message is keyed on the event it describes — the
 *    order number, the review task — and a second call for the same event finds
 *    the first row and returns it. A webhook retried by a gateway, an operator
 *    double-clicking "mark paid", a drain retrying after a timeout (the outbox
 *    passes its row id to Resend as the Idempotency-Key) all send once.
 * 3. **The recipient's language, frozen now.** `User.locale` is read here and
 *    written onto the row; the sender has no request to ask.
 *
 * Never recomputes money or entitlement. Amounts are read off the Order as
 * `lib/orders.ts` froze them.
 */

type Client = PrismaClient | Prisma.TransactionClient

const localeOf = (value: string | null | undefined): Locale =>
  isLocale(value) ? value : DEFAULT_LOCALE

/** Database copy follows the reader; Arabic is the fallback, never the default for English. */
const titleFor = (locale: Locale, ar: string, en: string | null | undefined) =>
  locale === 'en' ? en || ar : ar || en || ''

/** Is a message for this event already queued (or sent)? */
async function alreadyQueued(client: Client, template: string, key: string, value: string) {
  return client.mailOutbox.findFirst({
    where: { template, payload: { path: [key], equals: value } },
    select: { id: true },
  })
}

/**
 * The operator's inbox. MAIL_OPERATOR_TO is the name this module documents;
 * OPERATOR_EMAIL is the older name `review.queued` shipped with, still honoured
 * so an existing deployment keeps receiving submissions.
 */
export function operatorAddress() {
  return process.env.MAIL_OPERATOR_TO || process.env.OPERATOR_EMAIL || null
}

/* ─────────────────────────────── Orders ─────────────────────────────── */

/**
 * A bank-transfer order was placed: what to send, where, and what happens next.
 *
 * The bank details come from BANK_* env vars and are frozen into the payload,
 * so a message queued before an account change still shows the account the
 * buyer was told about. With no IBAN configured the message says, honestly,
 * that the details follow by reply — the checkout already promises "we'll send
 * you the transfer details".
 */
export async function notifyOrderPlaced(orderId: string): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        status: true,
        paymentMethod: true,
        gatewayRef: true,
        total: true,
        currency: true,
        user: { select: { name: true, email: true, locale: true } },
      },
    })
    if (!order?.user?.email) return
    // Only the rail that waits on the buyer. A gateway order is paid or failed
    // at checkout and gets the receipt instead.
    if (order.paymentMethod !== 'bank_transfer' || order.status !== 'pending') return
    if (await alreadyQueued(db, 'order.placed', 'orderNumber', order.orderNumber)) return

    const locale = localeOf(order.user.locale)
    await enqueue(db, {
      template: 'order.placed',
      toEmail: order.user.email,
      locale,
      payload: {
        name: order.user.name ?? order.user.email,
        orderNumber: order.orderNumber,
        total: Number(order.total),
        currency: order.currency,
        reference: order.gatewayRef ?? order.orderNumber,
        bankName: process.env.BANK_NAME ?? '',
        bankAccountName: process.env.BANK_ACCOUNT_NAME ?? '',
        bankIban: process.env.BANK_IBAN ?? '',
        bankSwift: process.env.BANK_SWIFT ?? '',
        orderUrl: siteUrl('/account/purchases', locale),
      },
    })
    drainSoon()
  } catch (error) {
    console.error('[notifications] order placed not queued:', error)
  }
}

/**
 * The order is paid: receipt, library link, certificate.
 *
 * Called by `settleOrder` INSIDE its transaction, with `client: tx`, so "paid"
 * and "a receipt is owed" commit together — and also callable on its own
 * (a gateway webhook, a repair script): it re-checks that the order is paid and
 * returns the existing row if one is already queued, so a second call never
 * sends a second receipt.
 *
 * Returns the outbox row id, which `attachCertificates` uses once the PDFs
 * exist. Rendering a PDF launches Chrome, which has no place inside a
 * transaction, so the attachment is added afterwards.
 */
export async function notifyOrderPaid(
  orderId: string,
  options: { client?: Client; drain?: boolean } = {},
): Promise<string | null> {
  const client = options.client ?? db
  const inTransaction = Boolean(options.client)

  try {
    const order = await client.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        status: true,
        subtotal: true,
        discountAmount: true,
        bundleDiscountAmount: true,
        promoCode: true,
        vatAmount: true,
        total: true,
        currency: true,
        paymentMethod: true,
        user: { select: { name: true, email: true, locale: true } },
        items: {
          select: {
            clipManifestSnapshot: true,
            album: { select: { titleAr: true, titleEn: true } },
          },
        },
      },
    })
    if (!order?.user?.email || order.status !== 'paid') return null

    const locale = localeOf(order.user.locale)

    /*
     * The free sample gets its own message. A receipt reading «المجموع ٠» for
     * something nobody bought is confusing, and it would call a gift a
     * purchase. Same idempotency, same certificate attachment, same library
     * button — keyed on the order number under its own template name.
     */
    if (order.paymentMethod === 'sample') {
      const queued = await alreadyQueued(client, 'sample.claimed', 'orderNumber', order.orderNumber)
      if (queued) return queued.id
      const manifest = order.items[0]?.clipManifestSnapshot
      const row = await enqueue(client, {
        template: 'sample.claimed',
        toEmail: order.user.email,
        locale,
        payload: {
          name: order.user.name ?? order.user.email,
          orderNumber: order.orderNumber,
          clipCount: Array.isArray(manifest) ? manifest.length : 0,
          libraryUrl: siteUrl('/account/library', locale),
          certificateAttached: false,
        },
      })
      if (options.drain !== false) drainSoon()
      return row.id
    }

    const existing = await alreadyQueued(client, 'order.confirmed', 'orderNumber', order.orderNumber)
    if (existing) return existing.id

    const row = await enqueue(client, {
      template: 'order.confirmed',
      toEmail: order.user.email,
      locale,
      payload: {
        name: order.user.name ?? order.user.email,
        orderNumber: order.orderNumber,
        albumTitles: order.items.map((item) => titleFor(locale, item.album.titleAr, item.album.titleEn)),
        subtotal: Number(order.subtotal),
        // A promo code's discount, already off the subtotal (DEV-63).
        ...(Number(order.discountAmount) > 0
          ? { discountAmount: Number(order.discountAmount), promoCode: order.promoCode ?? '' }
          : {}),
        // A bundle's discount, already off the subtotal (DEV-62).
        ...(Number(order.bundleDiscountAmount) > 0 ? { bundleDiscountAmount: Number(order.bundleDiscountAmount) } : {}),
        vatAmount: Number(order.vatAmount),
        total: Number(order.total),
        currency: order.currency,
        libraryUrl: siteUrl('/account/library', locale),
        certificateAttached: false,
      },
    })
    if (options.drain !== false) drainSoon()
    return row.id
  } catch (error) {
    // Inside a transaction a failed statement has already aborted it; hiding
    // the error would only move the failure to the next statement. Outside
    // one, nothing depends on this message — log and carry on.
    if (inTransaction) throw error
    console.error('[notifications] receipt not queued:', error)
    return null
  }
}

/**
 * Put the licence certificates on the queued receipt.
 *
 * Also flips `certificateAttached` in the payload, so the message says
 * "attached" only when it is, and "in your library" otherwise.
 */
export async function attachCertificates(outboxId: string, keys: string[]) {
  if (!keys.length) return
  try {
    const row = await db.mailOutbox.findUnique({ where: { id: outboxId }, select: { payload: true, sentAt: true } })
    // Already sent without them: the library link in that message still works.
    if (!row || row.sentAt) return
    await db.mailOutbox.update({
      where: { id: outboxId },
      data: {
        attachments: keys,
        payload: { ...(row.payload as Record<string, unknown>), certificateAttached: true },
      },
    })
  } catch (error) {
    console.error('[notifications] could not attach certificates:', error)
  }
}

/* ─────────────────────────────── Review ─────────────────────────────── */

/**
 * Tell the creator the outcome of the latest review decision on an album.
 *
 * Approved → the live album page. Changes requested → the album in the studio,
 * with the reviewer's note. Rejected → the reason, and an invitation to reply;
 * the note is mandatory for both of the latter (`admin.decisionNote`).
 *
 * Keyed on the review task, so re-running it for the same decision is a no-op
 * while a later decision on a resubmission is a new message.
 */
export async function notifyAlbumDecision(albumId: string): Promise<void> {
  try {
    const task = await db.reviewTask.findFirst({
      where: { albumId, decidedAt: { not: null }, decision: { not: null } },
      orderBy: { decidedAt: 'desc' },
      select: {
        id: true,
        decision: true,
        decisionNote: true,
        proposedPrice: true,
        album: {
          select: {
            id: true,
            slug: true,
            titleAr: true,
            titleEn: true,
            creator: { select: { handle: true, user: { select: { email: true, locale: true } } } },
          },
        },
      },
    })
    const recipient = task?.album.creator?.user
    if (!task || !recipient?.email) return

    const template =
      task.decision === 'approve'
        ? 'album.approved'
        : task.decision === 'reject'
          ? 'album.rejected'
          : task.decision === 'request_changes'
            ? 'album.changes'
            : null
    if (!template) return
    if (await alreadyQueued(db, template, 'taskId', task.id)) return

    const locale = localeOf(recipient.locale)
    const { album } = task
    await enqueue(db, {
      template,
      toEmail: recipient.email,
      locale,
      payload: {
        taskId: task.id,
        album: titleFor(locale, album.titleAr, album.titleEn),
        notes: task.decisionNote ?? '',
        // The owner's counter-price, when it came with the feedback (DEV-09b).
        ...(task.proposedPrice !== null ? { proposedPrice: String(task.proposedPrice), currency: 'USD' } : {}),
        albumUrl:
          template === 'album.approved'
            ? siteUrl(`/albums/${album.creator.handle}/${album.slug}`, locale)
            : // Changes and rejection both land on the album, where the
              // reviewer's note and the failed checks are shown.
              siteUrl(`/studio/albums/${album.id}`, locale),
      },
    })
    drainSoon()
  } catch (error) {
    console.error('[notifications] review decision not queued:', error)
  }
}

/* ─────────────────────────────── Contact ─────────────────────────────── */

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/
const MAX_MESSAGE = 5000

/**
 * A visitor wrote through the contact form. Goes to the operator, in the
 * product default (Arabic) — the operator's language is not knowable from a
 * visitor — with Reply-To set to the visitor so answering is one click.
 *
 * Returns whether the email was queued. The contact form stores the message
 * in `ContactMessage` BEFORE calling this, so the message is never lost; a
 * missing MAIL_OPERATOR_TO is logged loudly and returns false.
 */
export async function notifyContactMessage(input: {
  name: string
  email: string
  subject?: string
  message: string
  locale: 'ar' | 'en'
}): Promise<boolean> {
  const operator = operatorAddress()
  const email = input.email.trim()
  const payload = {
    name: input.name.trim().slice(0, 200),
    // An address that is not one is dropped rather than used as Reply-To.
    email: EMAIL.test(email) ? email.slice(0, 320) : '',
    subject: (input.subject ?? '').trim().slice(0, 200),
    message: input.message.trim().slice(0, MAX_MESSAGE),
    senderLocale: input.locale === 'en' ? 'en' : 'ar',
  }

  if (!operator) {
    console.error('[notifications] MAIL_OPERATOR_TO is not set; contact message not queued:', payload)
    return false
  }

  await enqueue(db, {
    template: 'contact.message',
    toEmail: operator,
    locale: DEFAULT_LOCALE,
    payload,
  })
  drainSoon()
  return true
}
