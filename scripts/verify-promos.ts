/**
 * Promo codes apply at checkout, by their own rules, and pay creators on the
 * price actually paid (DEV-63).
 *
 *   npm run verify:promos        (no server needed)
 *
 * ── What was wrong ──────────────────────────────────────────────────────────
 * /admin/promos created codes that nothing ever applied: checkout had no code
 * field and `redemptions` never moved. A code handed to a buyer did nothing.
 */
import { checkout } from '../lib/orders'
import { evaluatePromo } from '../lib/promos'
import { db } from '../lib/db'
import { OFFER_SELECT, priceNow } from '../lib/offers'

let failures = 0
function report(label: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

async function main() {
  console.log('Promo codes\n')
  const run = Date.now()
  const [a, b] = await db.album.findMany({
    where: { status: 'live', priceStandard: { gt: 0 } },
    orderBy: { priceStandard: 'desc' },
    take: 2,
    select: { id: true, ...OFFER_SELECT },
  })
  if (!a || !b) throw new Error('need two live priced albums — npm run db:seed')
  // What checkout charges before the code: the price NOW, offer included.
  const priceA = priceNow(a).priceStandard
  const priceB = priceNow(b).priceStandard
  const lines = [
    { albumId: a.id, gross: priceA },
    { albumId: b.id, gross: priceB },
  ]

  const tag = `T${run}`.slice(-8)
  const make = (code: string, data: Record<string, unknown>) =>
    db.promoCode.create({ data: { code: `${code}${tag}`, kind: 'percent', value: 20, ...data } })
  const pct = await make('PCT', {})
  const fixed = await make('FIX', { kind: 'fixed', value: 30 })
  const capped = await make('CAP', { maxRedemptions: 1 })
  const expired = await make('OLD', { endsAt: new Date(Date.now() - 86_400_000) })
  const future = await make('NEW', { startsAt: new Date(Date.now() + 86_400_000) })
  const off = await make('OFF', { isActive: false })
  const minimum = await make('MIN', { minOrderTotal: priceA + priceB + 1 })
  const onlyA = await make('ONE', { albumIds: [a.id] })
  const elsewhere = await make('ELS', { albumIds: ['not-an-album'] })
  const buyer = await db.user.create({ data: { email: `promo-buyer-${run}@laqta.test` } })
  const orderIds: string[] = []

  try {
    // ── The rules ────────────────────────────────────────────────────────────
    const e = async (code: string) => evaluatePromo(code, lines)
    report('an unknown code is refused', (await e('NOPE')).ok === false)
    report('a switched-off code is refused', !(await e(off.code)).ok)
    const oldRes = await e(expired.code)
    report('an expired code is refused', !oldRes.ok && oldRes.error === 'promo.notActiveNow')
    report('a code not started yet is refused', !(await e(future.code)).ok)
    const minRes = await e(minimum.code)
    report('a code under its minimum order is refused', !minRes.ok && minRes.error === 'promo.minimum')
    const elseRes = await e(elsewhere.code)
    report('a code for other albums is refused', !elseRes.ok && elseRes.error === 'promo.notApplicable')
    report('codes are case-insensitive', (await e(pct.code.toLowerCase())).ok)

    const pctRes = await e(pct.code)
    report(
      '20% takes 20% of the order',
      pctRes.ok && pctRes.total === round2((priceA + priceB) * 0.2),
      pctRes.ok ? String(pctRes.total) : '',
    )
    const fixRes = await e(fixed.code)
    report(
      'a fixed code is split across lines and sums exactly',
      fixRes.ok && fixRes.total === 30 && round2(fixRes.discounts[a.id] + fixRes.discounts[b.id]) === 30,
      fixRes.ok ? JSON.stringify(fixRes.discounts) : '',
    )
    const oneRes = await e(onlyA.code)
    report(
      'an album-limited code discounts only that album',
      oneRes.ok && oneRes.discounts[b.id] === 0 && oneRes.discounts[a.id] === round2(priceA * 0.2),
    )

    // ── Checkout applies it, and the money follows the price paid ────────────
    const placed = await checkout({
      userId: buyer.id,
      lines: [{ albumId: a.id }, { albumId: b.id }],
      billing: { billingEntityType: 'individual' },
      method: 'bank_transfer',
      promoCode: pct.code,
    })
    report('checkout accepts the code', placed.ok)
    if (placed.ok) {
      orderIds.push(placed.orderId)
      const order = await db.order.findUnique({ where: { id: placed.orderId }, include: { items: true } })
      const expectedDiscount = round2((priceA + priceB) * 0.2)
      report('the order records the code and discount', order?.promoCode === pct.code && Number(order?.discountAmount) === expectedDiscount)
      report(
        'the subtotal is after the discount',
        round2(Number(order?.subtotal)) === round2(priceA + priceB - expectedDiscount),
        String(order?.subtotal),
      )
      const lineA = order?.items.find((item) => item.albumId === a.id)
      report(
        'each line is paid at list price less its share',
        lineA !== undefined && round2(Number(lineA.grossAmount) + Number(lineA.discountAmount)) === priceA,
      )
      report(
        'the creator is paid on the price actually paid',
        lineA !== undefined &&
          round2(Number(lineA.creatorNetAmount) + Number(lineA.commissionAmount)) === round2(Number(lineA.grossAmount)),
      )
      report('the use is counted', (await db.promoCode.findUnique({ where: { id: pct.id } }))?.redemptions === 1)
    }

    const first = await checkout({
      userId: buyer.id,
      lines: [{ albumId: a.id }],
      billing: { billingEntityType: 'individual' },
      method: 'bank_transfer',
      promoCode: capped.code,
    })
    if (first.ok) orderIds.push(first.orderId)
    const second = await checkout({
      userId: buyer.id,
      lines: [{ albumId: a.id }],
      billing: { billingEntityType: 'individual' },
      method: 'bank_transfer',
      promoCode: capped.code,
    })
    if (second.ok) orderIds.push(second.orderId)
    report('a one-use code works once', first.ok && !second.ok && second.messageKey === 'promo.exhausted')

    const refused = await checkout({
      userId: buyer.id,
      lines: [{ albumId: a.id }],
      billing: { billingEntityType: 'individual' },
      method: 'bank_transfer',
      promoCode: expired.code,
    })
    if (refused.ok) orderIds.push(refused.orderId)
    report('checkout refuses an invalid code and places no order', !refused.ok)
  } finally {
    const items = await db.orderItem.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })
    const itemIds = items.map((item) => item.id)
    await db.creatorLedger.deleteMany({ where: { orderItemId: { in: itemIds } } })
    await db.entitlement.deleteMany({ where: { userId: buyer.id } })
    await db.licenceCertificate.deleteMany({ where: { orderItemId: { in: itemIds } } })
    await db.invoice.deleteMany({ where: { orderId: { in: orderIds } } })
    await db.paymentEvent.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
    await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })
    await db.mailOutbox.deleteMany({ where: { toEmail: buyer.email! } })
    await db.order.deleteMany({ where: { id: { in: orderIds } } })
    await db.user.delete({ where: { id: buyer.id } })
    await db.promoCode.deleteMany({ where: { code: { endsWith: tag } } })
    await db.$disconnect()
  }

  console.log(failures ? `\n${failures} promo check(s) failed.\n` : '\nPromo codes apply by their rules and pay creators on the price paid.\n')
  process.exit(failures ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
