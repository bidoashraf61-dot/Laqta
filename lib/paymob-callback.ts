import { notifyPaymentStatus } from '@/lib/notifications'
import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { settleOrder } from '@/lib/orders'
import {
  hmacMatches,
  paymobConfig,
  toMinorUnits,
  transactionHmac,
  type PaymobConfig,
} from '@/lib/paymob'

/**
 * The Paymob server-to-server callback, kept apart from `lib/paymob.ts` so the
 * driver (imported by `lib/payments.ts`, imported by `lib/orders.ts`) never
 * imports `lib/orders.ts` back.
 */

// ── The processed callback ──────────────────────────────────────────────────

export type CallbackResult = {
  httpStatus: number
  outcome:
    | 'unconfigured'
    | 'malformed'
    | 'bad_signature'
    | 'ignored'
    | 'replay'
    | 'settled'
    | 'declined'
    | 'pending'
    | 'amount_mismatch'
    | 'integration_mismatch'
    | 'already_paid'
    | 'order_not_pending'
    | 'unknown_order'
    | 'reversed_at_gateway'
    | 'error'
  orderId?: string
}

type TransactionObj = Record<string, unknown> & {
  id?: number | string
  success?: boolean
  pending?: boolean
  is_refunded?: boolean
  is_voided?: boolean
  error_occured?: boolean
  amount_cents?: number
  currency?: string
  integration_id?: number
  order?: { id?: number; merchant_order_id?: string | null }
  payment_key_claims?: { extra?: { laqta_order_id?: string } }
}

function transactionState(obj: TransactionObj) {
  if (obj.is_refunded) return 'refunded'
  if (obj.is_voided) return 'voided'
  if (obj.pending) return 'pending'
  if (obj.success && !obj.error_occured) return 'success'
  return 'failed'
}

/**
 * Handle one "transaction processed" callback.
 *
 * Order of operations, each a gate the next relies on:
 *   1. Configured?          — otherwise 503 and nothing is read.
 *   2. HMAC                 — a bad signature is rejected BEFORE any database
 *                             read or write. It leaves no trace but a log line.
 *   3. Claim                — insert PaymentEvent(gateway, txn id, state). A
 *                             replay hits the unique key and is acknowledged.
 *   4. Decide               — amount, currency and integration must match the
 *                             frozen order exactly; anything else is recorded
 *                             and NOT settled.
 *   5. settleOrder()        — the one paid path, shared with the admin.
 */
export async function handlePaymobCallback(
  body: unknown,
  providedHmac: string | null,
  config: PaymobConfig | null = paymobConfig(),
): Promise<CallbackResult> {
  if (!config) return { httpStatus: 503, outcome: 'unconfigured' }

  const envelope = body as { type?: string; obj?: TransactionObj } | null
  if (!envelope || typeof envelope !== 'object' || !envelope.obj) {
    return { httpStatus: 400, outcome: 'malformed' }
  }
  // Card-token and subscription callbacks are signed differently and carry no
  // payment. Acknowledge them so Paymob stops retrying; act on none of them.
  if (envelope.type && envelope.type !== 'TRANSACTION') {
    return { httpStatus: 200, outcome: 'ignored' }
  }

  const obj = envelope.obj
  if (!hmacMatches(providedHmac, transactionHmac(obj, config.hmacSecret))) {
    console.warn('[paymob] rejected a callback with a bad HMAC')
    return { httpStatus: 401, outcome: 'bad_signature' }
  }

  const transactionId = String(obj.id ?? '')
  if (!transactionId) return { httpStatus: 400, outcome: 'malformed' }
  const state = transactionState(obj)

  // ── Claim ────────────────────────────────────────────────────────────────
  // `skipDuplicates` turns the unique key into an atomic claim without a
  // thrown (and logged) constraint error on every legitimate replay.
  const eventId = eventRowId()
  const claimed = await db.paymentEvent.createMany({
    data: {
      id: eventId,
      gateway: 'paymob',
      transactionId,
      state,
      outcome: 'received',
      amountCents: typeof obj.amount_cents === 'number' ? obj.amount_cents : null,
      currency: typeof obj.currency === 'string' ? obj.currency : null,
      payload: obj as Prisma.InputJsonValue,
    },
    skipDuplicates: true,
  })
  if (claimed.count === 0) return { httpStatus: 200, outcome: 'replay' }

  const record = async (outcome: CallbackResult['outcome'], orderId?: string) => {
    await db.paymentEvent.update({
      where: { id: eventId },
      data: { outcome, orderId: orderId ?? null },
    })
    return { httpStatus: 200, outcome, orderId }
  }

  // ── Find the order ───────────────────────────────────────────────────────
  const orderNumber = obj.order?.merchant_order_id ?? null
  const extraId = obj.payment_key_claims?.extra?.laqta_order_id ?? null
  const order = orderNumber
    ? await db.order.findUnique({ where: { orderNumber: String(orderNumber) } })
    : extraId
      ? await db.order.findUnique({ where: { id: String(extraId) } })
      : null
  if (!order) return record('unknown_order')

  // ── Decide ───────────────────────────────────────────────────────────────
  if (state === 'refunded' || state === 'voided') {
    // Money moved back at the gateway. Laqta's refund tooling lives in the
    // admin and reverses at the frozen rate; it is not triggered from here.
    return record('reversed_at_gateway', order.id)
  }
  // The buyer hears about both (DEV-30) — once per order and state.
  if (state === 'pending') {
    await notifyPaymentStatus(order.id, 'pending')
    return record('pending', order.id)
  }
  if (state === 'failed') {
    await notifyPaymentStatus(order.id, 'failed')
    return record('declined', order.id)
  }

  const expectedCents = toMinorUnits(Number(order.total))
  if (
    obj.amount_cents !== expectedCents ||
    String(obj.currency ?? '').toUpperCase() !== order.currency.toUpperCase()
  ) {
    console.error(
      `[paymob] amount mismatch on ${order.orderNumber}: got ${obj.amount_cents} ${obj.currency}, expected ${expectedCents} ${order.currency}`,
    )
    return record('amount_mismatch', order.id)
  }

  const configuredIds = Object.values(config.integrations)
  if (!configuredIds.includes(Number(obj.integration_id))) {
    return record('integration_mismatch', order.id)
  }

  if (order.status === 'paid') return record('already_paid', order.id)
  if (order.status !== 'pending') return record('order_not_pending', order.id)

  // ── Settle, through the one paid path ────────────────────────────────────
  try {
    await settleOrder(order.id, `PAYMOB-${transactionId}`)
  } catch (error) {
    // Release the claim so Paymob's retry can try again, and tell it to.
    await db.paymentEvent.delete({ where: { id: eventId } }).catch(() => undefined)
    console.error(`[paymob] settlement failed for ${order.orderNumber}:`, error)
    return { httpStatus: 500, outcome: 'error', orderId: order.id }
  }

  // The cart survives the redirect so an abandoned payment can be retried; it
  // is emptied of these albums only now that they are actually paid for.
  const items = await db.orderItem.findMany({
    where: { orderId: order.id },
    select: { albumId: true },
  })
  await db.cartItem
    .deleteMany({
      where: {
        cart: { userId: order.userId },
        albumId: { in: items.map((item) => item.albumId) },
      },
    })
    .catch((error) => console.error('[paymob] could not clear the cart:', error))

  return record('settled', order.id)
}

/** How an order became paid, for the admin. Derived, never stored twice. */
export function settlementSource(
  status: string,
  events: { outcome: string }[],
): 'webhook' | 'manual' | null {
  if (status !== 'paid' && status !== 'partially_refunded' && status !== 'refunded') return null
  return events.some((event) => event.outcome === 'settled') ? 'webhook' : 'manual'
}

/** createMany cannot return the row, so the id is chosen here. */
function eventRowId() {
  return `pe_${randomUUID().replace(/-/g, '')}`
}
