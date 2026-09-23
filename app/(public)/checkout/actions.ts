'use server'

import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { checkout } from '@/lib/orders'
import { PAYMENT_METHODS, availableMethods, type PaymentMethod } from '@/lib/payments'
import { requestLocale } from '@/lib/locale-request'

const schema = z.object({
  billingEntityType: z.enum(['individual', 'business']),
  legalName: z.string().optional(),
  crNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  poNumber: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  method: z.enum(PAYMENT_METHODS),
})

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; settled: boolean; redirectUrl?: string }
  | { ok: false; messageKey: string }

export async function placeOrder(formData: FormData): Promise<PlaceOrderResult> {
  const user = await requireUser()

  const parsed = schema.safeParse({
    billingEntityType: formData.get('billingEntityType'),
    legalName: formData.get('legalName') || undefined,
    crNumber: formData.get('crNumber') || undefined,
    vatNumber: formData.get('vatNumber') || undefined,
    poNumber: formData.get('poNumber') || undefined,
    addressLine1: formData.get('addressLine1') || undefined,
    city: formData.get('city') || undefined,
    method: formData.get('method'),
  })
  if (!parsed.success) return { ok: false, messageKey: 'auth.somethingWentWrong' }

  // A method the page did not offer is refused before an order exists. The
  // page only renders `availableMethods()`, so this is a forged post or a
  // configuration that changed between render and submit.
  if (!availableMethods().includes(parsed.data.method as PaymentMethod)) {
    return { ok: false, messageKey: 'checkout.gatewayPending' }
  }

  // A compliant tax invoice for a business needs the legal name and the VAT
  // registration number. Refusing here is cheaper than issuing an invoice that
  // the buyer's finance department rejects.
  if (parsed.data.billingEntityType === 'business' && !parsed.data.vatNumber) {
    return { ok: false, messageKey: 'checkout.vatNumber' }
  }

  const cart = await db.cart.findUnique({
    where: { userId: user.id },
    include: { items: true },
  })
  if (!cart || cart.items.length === 0) return { ok: false, messageKey: 'cart.empty' }

  const billingAddress =
    parsed.data.addressLine1 || parsed.data.city
      ? { line1: parsed.data.addressLine1 ?? null, city: parsed.data.city ?? null, country: 'SA' }
      : null

  const result = await checkout({
    userId: user.id,
    lines: cart.items.map((item) => ({ albumId: item.albumId })),
    billing: {
      billingEntityType: parsed.data.billingEntityType,
      legalName: parsed.data.legalName,
      crNumber: parsed.data.crNumber,
      vatNumber: parsed.data.vatNumber,
      poNumber: parsed.data.poNumber,
      billingAddress,
    },
    method: parsed.data.method as PaymentMethod,
    // Taken from the return value, not the ambient store: an action is not a
    // render (see actionT in lib/locale-request.ts).
    locale: await requestLocale(),
  })

  if (!result.ok) return result

  // Persist the billing entity for next time, and empty the cart.
  await db.user.update({
    where: { id: user.id },
    data: {
      billingEntityType: parsed.data.billingEntityType,
      legalName: parsed.data.legalName ?? null,
      crNumber: parsed.data.crNumber ?? null,
      vatNumber: parsed.data.vatNumber ?? null,
      ...(billingAddress ? { billingAddress } : {}),
    },
  })

  // A hosted payment may be abandoned, so the cart survives the redirect and
  // is emptied by the signed callback once the albums are actually paid for.
  if (result.redirectUrl) {
    return {
      ok: true,
      orderNumber: result.orderNumber,
      settled: false,
      redirectUrl: result.redirectUrl,
    }
  }

  await db.cartItem.deleteMany({ where: { cartId: cart.id } })

  return { ok: true, orderNumber: result.orderNumber, settled: result.settled }
}
