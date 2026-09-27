import { db } from '@/lib/db'
import { enqueue, drain } from '@/lib/outbox'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/locale'
import { operatorAddress } from '@/lib/notifications'
import { siteUrl } from '@/lib/site'

/**
 * The once-a-day jobs (DEV-30, DEV-57): nothing in a request triggers them,
 * so something must run them on a clock — `npm run jobs:daily` from cron, or
 * a scheduler calling `POST /api/cron/daily` with `CRON_SECRET`. Each job is
 * idempotent: running the day twice sends nothing twice.
 */

const DAY = 86_400_000

/** A bank-transfer order is reminded once, this long after it was placed. */
export const TRANSFER_REMINDER_AFTER_DAYS = 3

const localeOf = (value: string | null | undefined): Locale => (isLocale(value) ? value : DEFAULT_LOCALE)

/**
 * «تذكير: طلبك بانتظار التحويل» — for every bank-transfer order still pending
 * three days after it was placed, once. Keyed on the order number, like the
 * original «استلمنا طلبك».
 */
export async function sendTransferReminders(now = new Date()) {
  const due = await db.order.findMany({
    where: {
      status: 'pending',
      paymentMethod: 'bank_transfer',
      createdAt: { lt: new Date(now.getTime() - TRANSFER_REMINDER_AFTER_DAYS * DAY) },
    },
    select: {
      orderNumber: true,
      total: true,
      currency: true,
      gatewayRef: true,
      user: { select: { name: true, email: true, locale: true } },
    },
    take: 200,
  })
  let queued = 0
  for (const order of due) {
    if (!order.user?.email) continue
    const already = await db.mailOutbox.findFirst({
      where: { template: 'order.transferReminder', payload: { path: ['orderNumber'], equals: order.orderNumber } },
      select: { id: true },
    })
    if (already) continue
    const locale = localeOf(order.user.locale)
    await enqueue(db, {
      template: 'order.transferReminder',
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
    queued += 1
  }
  return queued
}

/** The numbers the digest reports — also what the admin home could show. */
export async function digestFigures(now = new Date()) {
  const [reviewQueue, reviewOverdue, transfers, oldest, payoutRequests, openMessages, newRequests, failedMail] =
    await Promise.all([
      db.reviewTask.count({ where: { status: { in: ['unassigned', 'assigned', 'in_progress'] } } }),
      db.reviewTask.count({ where: { status: { in: ['unassigned', 'assigned', 'in_progress'] }, slaDueAt: { lt: now } } }),
      db.order.count({ where: { status: 'pending', paymentMethod: 'bank_transfer' } }),
      db.order.findFirst({
        where: { status: 'pending', paymentMethod: 'bank_transfer' },
        orderBy: { createdAt: 'asc' },
        select: { orderNumber: true },
      }),
      db.payout.count({ where: { status: 'requested' } }),
      db.contactMessage.count({ where: { status: 'open' } }),
      db.footageRequest.count({ where: { status: 'open', createdAt: { gt: new Date(now.getTime() - DAY) } } }),
      db.mailOutbox.count({ where: { failedAt: { not: null }, sentAt: null } }),
    ])
  return {
    reviewQueue,
    reviewOverdue,
    unsettledTransfers: transfers,
    oldestTransfer: oldest?.orderNumber ?? '',
    payoutRequests,
    openMessages,
    newRequests,
    failedMail,
  }
}

/**
 * The operator's morning digest (DEV-57): the review queue, unconfirmed bank
 * transfers, payout requests, open messages, new footage requests and failed
 * mail — one message a day to MAIL_OPERATOR_TO, in Arabic. Keyed on the date,
 * so a second run the same day sends nothing.
 */
export async function sendOperatorDigest(now = new Date()) {
  const to = operatorAddress()
  if (!to) {
    console.error('[jobs] MAIL_OPERATOR_TO is not set; no digest')
    return false
  }
  const date = now.toISOString().slice(0, 10)
  const already = await db.mailOutbox.findFirst({
    where: { template: 'operator.digest', payload: { path: ['date'], equals: date } },
    select: { id: true },
  })
  if (already) return false

  const figures = await digestFigures(now)
  await enqueue(db, {
    template: 'operator.digest',
    toEmail: to,
    locale: DEFAULT_LOCALE,
    payload: {
      date,
      time: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(now),
      ...figures,
      adminUrl: siteUrl('/admin', DEFAULT_LOCALE),
    },
  })
  return true
}

/**
 * The launch notice (DEV-30) to a list of addresses — the waitlist (DEV-45)
 * supplies them with each person's language and unsubscribe link. Once per
 * address.
 */
export async function sendLaunchNotice(
  recipients: Array<{ email: string; locale?: string | null; unsubscribeUrl?: string }>,
) {
  let queued = 0
  for (const recipient of recipients) {
    const email = recipient.email.trim().toLowerCase()
    if (!email) continue
    const already = await db.mailOutbox.findFirst({
      where: { template: 'launch.notice', toEmail: email },
      select: { id: true },
    })
    if (already) continue
    const locale = localeOf(recipient.locale)
    await enqueue(db, {
      template: 'launch.notice',
      toEmail: email,
      locale,
      payload: { albumsUrl: siteUrl('/albums', locale), unsubscribeUrl: recipient.unsubscribeUrl ?? '' },
    })
    queued += 1
  }
  return queued
}

/** Everything the day owes, then one drain. */
export async function runDailyJobs(now = new Date()) {
  const reminders = await sendTransferReminders(now)
  const digest = await sendOperatorDigest(now)
  const sent = await drain(100)
  return { reminders, digest, sent }
}
