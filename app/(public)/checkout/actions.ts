'use server'

import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { checkout } from '@/lib/orders'
import { PAYMENT_METHODS, availableMethods, type PaymentMethod } from '@/lib/payments'
import { requestLocale } from '@/lib/locale-request'
import { evaluatePromo } from '@/lib/promos'
import { vatOn } from '@/lib/commission'

const schema = z.object({
  billingEntityType: z.enum(['individual', 'business']),
  legalName: z.string().optional(),
  crNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  poNumber: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  method: z.enum(PAYMENT_METHODS),
  promoCode: z.string().max(64).optional(),
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
    promoCode: (formData.get('promoCode') as string) || undefined,
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
    promoCode: parsed.data.promoCode,
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

export type PromoPreview =
  | { ok: true; code: string; discount: number; subtotal: number; vatAmount: number; total: number }
  | { ok: false; messageKey: string; vars?: Record<string, string | number> }

/**
 * What a promo code would take off this cart (DEV-63) — shown before the
 * buyer pays. Uses the albums' prices NOW, the same as `checkout()`, which
 * re-evaluates the code on its own when the order is placed.
 */
export async function previewPromo(rawCode: string): Promise<PromoPreview> {
  const user = await requireUser()
  const cart = await db.cart.findUnique({ where: { userId: user.id }, include: { items: true } })
  if (!cart || cart.items.length === 0) return { ok: false, messageKey: 'cart.empty' }
  const albums = await db.album.findMany({
    where: { id: { in: cart.items.map((item) => item.albumId) }, status: 'live', priceStandard: { gt: 0 } },
    select: { id: true, priceStandard: true },
  })
  const lines = albums.map((album) => ({ albumId: album.id, gross: Number(album.priceStandard) }))
  const result = await evaluatePromo(rawCode, lines)
  if (!result.ok) return { ok: false, messageKey: result.error, vars: result.vars }

  const paid = lines.map((line) => Math.round((line.gross - (result.discounts[line.albumId] ?? 0)) * 100) / 100)
  const subtotal = paid.reduce((sum, value) => sum + value, 0)
  const vatAmount = paid.reduce((sum, value) => sum + vatOn(value), 0)
  return { ok: true, code: result.code, discount: result.total, subtotal, vatAmount, total: subtotal + vatAmount }
}
