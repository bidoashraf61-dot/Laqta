/**
 * Payments.
 *
 * ── Status ──────────────────────────────────────────────────────────────────
 * Two drivers:
 *
 *   - `manual` — bank transfer. Records the intent and leaves the order
 *     awaiting settlement; an admin marks it paid from /admin/orders.
 *   - `paymob` (lib/paymob.ts) — card and Apple Pay through Paymob's Intention
 *     API + Unified Checkout. DORMANT until the PAYMOB_* variables are set;
 *     until then card/Apple Pay stay out of `availableMethods()` exactly as
 *     they did before the driver existed. It returns a `redirect` outcome and
 *     never `paid`: only the signed server callback settles
 *     (lib/paymob-callback.ts → settleOrder).
 *
 * mada, Tabby and Tamara are NOT part of the Paymob integration, so they are
 * not methods here at all (DEV-29 removed their labels too — a checkout must
 * not advertise a rail that does not exist). mada-branded cards that Paymob's
 * card integration accepts go through `card`. Nothing here pretends a card
 * was charged.
 *
 * That is deliberate. The alternative — a fake "card" path that flips orders
 * to paid — produces a system that looks finished, and the day a real gateway
 * arrives every assumption baked around the fake has to be unpicked. A driver
 * boundary plus an honest manual rail costs nothing now and is what a real
 * integration plugs into.
 *
 * ── What a real driver has to handle ────────────────────────────────────────
 * The company is Egypt-registered and buyers are mainly Saudi, so the intended
 * rails are Paymob / Fawry / Kashier (Egyptian gateways that take international
 * cards), Apple Pay, Tabby / Tamara for BNPL, and bank transfer.
 *
 * Bank transfer is not a nice-to-have: Saudi government and semi-government
 * procurement frequently *cannot* pay by card, and that segment is the high
 * ticket. `bank_transfer` is therefore a first-class method here, not a
 * fallback — and it is the one rail that is fully functional today, because it
 * is the one that does not need a gateway.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { createPaymobIntention, paymobMethods } from '@/lib/paymob'

export const PAYMENT_METHODS = ['card', 'apple_pay', 'bank_transfer'] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Methods that need a gateway. Only card + Apple Pay have one (Paymob). */
export const GATEWAY_METHODS: PaymentMethod[] = ['card', 'apple_pay']

export function isGatewayMethod(method: PaymentMethod) {
  return GATEWAY_METHODS.includes(method)
}

export type PaymentIntent = {
  orderId: string
  orderNumber: string
  amount: number
  currency: string
  method: PaymentMethod
  /** What a hosted checkout needs to address the buyer. Nothing more is asked. */
  buyer?: { name: string | null; email: string | null; phone: string | null }
  /** The language the buyer is reading, so the return page answers in it. */
  locale?: string
}

export type PaymentOutcome =
  | { status: 'paid'; reference: string }
  /** Recorded, not yet settled — bank transfer and Net-30 land here. */
  | { status: 'awaiting_settlement'; reference: string; instructionsKey: string }
  /** Hand the buyer to a hosted checkout. Settlement arrives by callback. */
  | { status: 'redirect'; reference: string; url: string }
  | { status: 'unavailable'; reasonKey: string }

interface PaymentDriver {
  createIntent(intent: PaymentIntent): Promise<PaymentOutcome>
}

const manualDriver: PaymentDriver = {
  async createIntent(intent) {
    if (isGatewayMethod(intent.method)) {
      // Honest refusal rather than a fake success.
      return { status: 'unavailable', reasonKey: 'checkout.gatewayPending' }
    }

    return {
      status: 'awaiting_settlement',
      reference: `BT-${intent.orderNumber}`,
      instructionsKey: 'checkout.bankTransferInstructions',
    }
  },
}

const paymobDriver: PaymentDriver = {
  createIntent: (intent) => createPaymobIntention(intent),
}

function driverFor(method: PaymentMethod): PaymentDriver {
  return (paymobMethods() as PaymentMethod[]).includes(method) ? paymobDriver : manualDriver
}

export async function createPaymentIntent(intent: PaymentIntent) {
  return driverFor(intent.method).createIntent(intent)
}

/**
 * Which methods the checkout offers today: card / Apple Pay only when Paymob is
 * configured with an integration for them, then bank transfer, always.
 */
export function availableMethods(): PaymentMethod[] {
  const gateway = paymobMethods() as PaymentMethod[]
  return PAYMENT_METHODS.filter((method) => !isGatewayMethod(method) || gateway.includes(method))
}
