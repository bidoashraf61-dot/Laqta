/**
 * Payments.
 *
 * ── Status ──────────────────────────────────────────────────────────────────
 * No gateway is contracted yet, so the live driver is `manual`: it records the
 * intent and marks the order awaiting settlement, exactly as a real bank
 * transfer does. Nothing here pretends a card was charged.
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

export const PAYMENT_METHODS = [
  'card',
  'apple_pay',
  'mada',
  'tabby',
  'tamara',
  'bank_transfer',
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Methods that need a gateway we do not have yet. */
export const GATEWAY_METHODS: PaymentMethod[] = ['card', 'apple_pay', 'mada', 'tabby', 'tamara']

export function isGatewayMethod(method: PaymentMethod) {
  return GATEWAY_METHODS.includes(method)
}

export type PaymentIntent = {
  orderId: string
  orderNumber: string
  amount: number
  currency: string
  method: PaymentMethod
}

export type PaymentOutcome =
  | { status: 'paid'; reference: string }
  /** Recorded, not yet settled — bank transfer and Net-30 land here. */
  | { status: 'awaiting_settlement'; reference: string; instructionsKey: string }
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

const driver: PaymentDriver = manualDriver

export async function createPaymentIntent(intent: PaymentIntent) {
  return driver.createIntent(intent)
}

/** Which methods the checkout should offer as selectable today. */
export function availableMethods(): PaymentMethod[] {
  return PAYMENT_METHODS.filter((method) => !isGatewayMethod(method))
}
