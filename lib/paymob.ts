import { createHmac, timingSafeEqual } from 'node:crypto'
import { siteUrl } from '@/lib/site'
import type { PaymentIntent, PaymentOutcome } from '@/lib/payments'

/**
 * Paymob — card and Apple Pay, through the Intention API and Unified Checkout.
 *
 * ── The flow ────────────────────────────────────────────────────────────────
 *   1. checkout() freezes the order exactly as for bank transfer, then asks
 *      this driver for an intention: POST {base}/v1/intention/ with the secret
 *      key, the amount in minor units, the ONE integration the buyer picked,
 *      the order number as `special_reference`, and our two URLs.
 *   2. The buyer is sent to {base}/unifiedcheckout/?publicKey&clientSecret —
 *      Paymob's hosted page. No card data ever touches Laqta.
 *   3. Paymob POSTs the "transaction processed" callback to
 *      /api/payments/paymob. THAT, and only that, can mark an order paid — and
 *      it does so through `settleOrder()`, the same function the admin's
 *      «تأكيد الدفع» calls, so the ledger, invoice and confirmation mail are
 *      identical whichever rail got there.
 *   4. The buyer's browser comes back to /checkout/return, which only READS.
 *      A redirect is a claim made by a browser; a signed callback is a fact.
 *
 * ── Dormant until configured ────────────────────────────────────────────────
 * `paymobConfig()` returns null unless the keys AND at least one integration id
 * are set. Null keeps card/Apple Pay out of `availableMethods()`, exactly as
 * before this driver existed. There is no sandbox shortcut and no fake success.
 *
 * ── Region ──────────────────────────────────────────────────────────────────
 * The company is Egypt-registered (accept.paymob.com); Paymob also runs a KSA
 * region (ksa.paymob.com) with its own keys. PAYMOB_BASE_URL picks one; the
 * paths are the same on both.
 */

export type PaymobMethod = 'card' | 'apple_pay'
export const PAYMOB_METHODS: PaymobMethod[] = ['card', 'apple_pay']

export type PaymobConfig = {
  baseUrl: string
  secretKey: string
  publicKey: string
  hmacSecret: string
  currency: string
  integrations: Partial<Record<PaymobMethod, number>>
}

/**
 * `PAYMOB_INTEGRATION_IDS="card:1234567,apple_pay:7654321"`, or the per-method
 * variables `PAYMOB_INTEGRATION_ID_CARD` / `PAYMOB_INTEGRATION_ID_APPLE_PAY`
 * (the per-method variable wins). A bare number with no method is ignored —
 * guessing which rail an id belongs to would send a card buyer to Apple Pay.
 */
function parseIntegrations(env: NodeJS.ProcessEnv): Partial<Record<PaymobMethod, number>> {
  const result: Partial<Record<PaymobMethod, number>> = {}
  for (const pair of (env.PAYMOB_INTEGRATION_IDS ?? '').split(',')) {
    const [method, id] = pair.split(':').map((part) => part.trim())
    if (PAYMOB_METHODS.includes(method as PaymobMethod) && /^\d+$/.test(id ?? '')) {
      result[method as PaymobMethod] = Number(id)
    }
  }
  const card = env.PAYMOB_INTEGRATION_ID_CARD?.trim()
  const applePay = env.PAYMOB_INTEGRATION_ID_APPLE_PAY?.trim()
  if (card && /^\d+$/.test(card)) result.card = Number(card)
  if (applePay && /^\d+$/.test(applePay)) result.apple_pay = Number(applePay)
  return result
}

export function paymobConfig(env: NodeJS.ProcessEnv = process.env): PaymobConfig | null {
  const secretKey = env.PAYMOB_SECRET_KEY?.trim()
  const publicKey = env.PAYMOB_PUBLIC_KEY?.trim()
  const hmacSecret = env.PAYMOB_HMAC_SECRET?.trim()
  const integrations = parseIntegrations(env)
  if (!secretKey || !publicKey || !hmacSecret || Object.keys(integrations).length === 0) {
    return null
  }
  return {
    baseUrl: (env.PAYMOB_BASE_URL?.trim() || 'https://accept.paymob.com').replace(/\/$/, ''),
    secretKey,
    publicKey,
    hmacSecret,
    currency: (env.PAYMOB_CURRENCY?.trim() || 'USD').toUpperCase(),
    integrations,
  }
}

/** Which gateway methods can actually be offered right now. */
export function paymobMethods(config = paymobConfig()): PaymobMethod[] {
  if (!config) return []
  return PAYMOB_METHODS.filter((method) => config.integrations[method] !== undefined)
}

/** Major units → minor units, without float drift (19.99 → 1999, never 1998). */
export function toMinorUnits(amount: number) {
  return Math.round(Number((amount * 100).toFixed(4)))
}

// ── Intention ───────────────────────────────────────────────────────────────

function splitName(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  // Paymob requires every billing field and documents "NA" for the unknown
  // ones. We do not ask the buyer for anything the card network does not need.
  return {
    first: parts[0] || 'NA',
    last: parts.slice(1).join(' ') || 'NA',
  }
}

export async function createPaymobIntention(
  intent: PaymentIntent,
  config: PaymobConfig | null = paymobConfig(),
): Promise<PaymentOutcome> {
  const method = intent.method as PaymobMethod
  const integrationId = config?.integrations[method]
  if (!config || integrationId === undefined) {
    return { status: 'unavailable', reasonKey: 'checkout.gatewayPending' }
  }
  // The order is priced in its own currency. Charging a USD total as EGP (or
  // the reverse) is not a rounding error, it is a different price.
  if (intent.currency.toUpperCase() !== config.currency) {
    console.error(
      `[paymob] order ${intent.orderNumber} is in ${intent.currency}, gateway is set to ${config.currency}`,
    )
    return { status: 'unavailable', reasonKey: 'checkout.gatewayError' }
  }

  const amount = toMinorUnits(intent.amount)
  const name = splitName(intent.buyer?.name)
  const email = intent.buyer?.email || 'NA'

  const body = {
    amount,
    currency: config.currency,
    payment_methods: [integrationId],
    items: [
      {
        name: `Laqta ${intent.orderNumber}`,
        amount,
        description: `Laqta order ${intent.orderNumber}`,
        quantity: 1,
      },
    ],
    billing_data: {
      first_name: name.first,
      last_name: name.last,
      email,
      phone_number: intent.buyer?.phone || 'NA',
      apartment: 'NA',
      floor: 'NA',
      street: 'NA',
      building: 'NA',
      city: 'NA',
      state: 'NA',
      country: 'NA',
      postal_code: 'NA',
    },
    customer: { first_name: name.first, last_name: name.last, email },
    // Comes back on the callback as `obj.order.merchant_order_id`.
    special_reference: intent.orderNumber,
    extras: { laqta_order_id: intent.orderId },
    notification_url: siteUrl('/api/payments/paymob', 'ar'),
    redirection_url: siteUrl('/checkout/return', intent.locale ?? 'ar'),
  }

  try {
    const response = await fetch(`${config.baseUrl}/v1/intention/`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${config.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
    const json = (await response.json().catch(() => null)) as {
      id?: string
      client_secret?: string
    } | null

    if (!response.ok || !json?.client_secret) {
      // Never log the request body: it carries the buyer's email.
      console.error(`[paymob] intention refused for ${intent.orderNumber}: HTTP ${response.status}`)
      return { status: 'unavailable', reasonKey: 'checkout.gatewayError' }
    }

    const url = `${config.baseUrl}/unifiedcheckout/?publicKey=${encodeURIComponent(
      config.publicKey,
    )}&clientSecret=${encodeURIComponent(json.client_secret)}`

    return { status: 'redirect', reference: `PAYMOB-INT-${json.id ?? intent.orderNumber}`, url }
  } catch (error) {
    console.error(`[paymob] intention failed for ${intent.orderNumber}:`, error)
    return { status: 'unavailable', reasonKey: 'checkout.gatewayError' }
  }
}

// ── HMAC ────────────────────────────────────────────────────────────────────

/**
 * Paymob's documented field order for the transaction HMAC — lexicographic,
 * values concatenated with no separator, HMAC-SHA512 hex, keyed on the HMAC
 * secret. Do not "tidy" this list: order IS the contract.
 *
 * POST (processed callback) reads `obj.id` and `obj.order.id`; the GET
 * (response/redirect) callback flattens them to `id` and `order` / `order_id`.
 */
const TRANSACTION_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
] as const

function stringify(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function pick(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

function sign(concatenated: string, secret: string) {
  return createHmac('sha512', secret).update(concatenated, 'utf8').digest('hex')
}

/** The exact string Paymob signs for a processed callback. Exported for the gate. */
export function transactionHmacString(obj: Record<string, unknown>) {
  return TRANSACTION_FIELDS.map((field) => stringify(pick(obj, field))).join('')
}

/** HMAC for the POST "transaction processed" callback, from `body.obj`. */
export function transactionHmac(obj: Record<string, unknown>, secret: string) {
  return sign(transactionHmacString(obj), secret)
}

/** HMAC for the GET "transaction response" redirect, from its query string. */
export function redirectHmac(query: Record<string, string | undefined>, secret: string) {
  const value = (field: string) => {
    if (field === 'order.id') return query['order'] ?? query['order_id']
    return query[field]
  }
  return sign(TRANSACTION_FIELDS.map((field) => value(field) ?? '').join(''), secret)
}

/** Constant-time compare of two hex digests. */
export function hmacMatches(provided: string | null | undefined, expected: string) {
  if (!provided) return false
  const a = Buffer.from(provided.trim().toLowerCase(), 'utf8')
  const b = Buffer.from(expected, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}
