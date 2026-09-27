/**
 * Album bundles: the buyer pays the bundle price, the creators are paid in
 * full, and Laqta pays the difference (DEV-62).
 *
 *   npm run verify:bundles        (no server needed)
 *
 * What this protects:
 *   - the bundle arithmetic: percent off and fixed price, the split across
 *     albums adds up to the discount to the cent;
 *   - the Laqta-share ceiling: no album's discount may exceed Laqta's
 *     commission on it — refused at save, skipped at checkout;
 *   - the owner's rules at save: 2–12 live albums, a sane price, a clean
 *     link, no banned wording, valid dates; audited;
 *   - checkout: the bundle applies only when every album is in the order,
 *     only while it runs, and the biggest saving wins between overlapping
 *     bundles; each creator's net is exactly what the album earns alone; a
 *     promo code does not stack on bundled albums;
 *   - settlement posts the creator's full net, and a full refund reverses
 *     exactly what was posted — the ledger nets to zero.
 *
 * Everything it creates is removed at the end.
 */
import { db } from '../lib/db'
import { checkout, settleOrder } from '../lib/orders'
import { refundOrderItem } from '../lib/admin'
import { resolveCommission } from '../lib/commission'
import {
  bundledCommission,
  bundleLines,
  BUNDLE_ALBUM_SELECT,
  overCeiling,
  priceBundle,
  resolveBundles,
  saveBundle,
  setBundleActive,
} from '../lib/bundles'
import { priceNow } from '../lib/offers'

let failures = 0
function report(label: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}
const cents = (value: number) => Math.round(value * 100) / 100

async function main() {
  console.log('Album bundles\n')

  // ── The arithmetic ───────────────────────────────────────────────────────
  const lines = [
    { albumId: 'a', gross: 99, rate: 0.35 },
    { albumId: 'b', gross: 149, rate: 0.3 },
    { albumId: 'c', gross: 49.5, rate: 0.25 },
  ]
  const pct = priceBundle('percent_off', 20, lines)!
  report(
    'percent off: the split adds up to the discount',
    pct.discount === cents(297.5 * 0.2) && cents(Object.values(pct.discounts).reduce((a, b) => a + b, 0)) === pct.discount,
    JSON.stringify(pct.discounts),
  )
  report('percent off: price = regular − discount', pct.price === cents(pct.regular - pct.discount))
  const fixed = priceBundle('fixed_price', 250, lines)!
  report('fixed price: the bundle costs exactly that', fixed.price === 250 && fixed.discount === 47.5)
  report('a fixed price at or above the regular total gives nothing', priceBundle('fixed_price', 400, lines) === null)
  report('20% off is within the ceiling here (lowest share 25%)', overCeiling(lines, pct.discounts).length === 0)
  const deep = priceBundle('percent_off', 30, lines)!
  report('30% off exceeds Laqta\'s share on the 25% album only', JSON.stringify(overCeiling(lines, deep.discounts)) === '["c"]')
  const standalone = resolveCommission({ grossAmount: 149, tier: 'silver', isExclusive: false })
  const money = bundledCommission({ preDiscount: 149, discount: 20, standalone })
  report(
    'a bundled line: the creator keeps the stand-alone net, Laqta the rest',
    money.creatorNetAmount === standalone.creatorNetAmount && money.commissionAmount === cents(129 - standalone.creatorNetAmount),
  )

  // ── Against the database ─────────────────────────────────────────────────
  const admin = await db.user.findFirst({ where: { role: 'admin' }, select: { id: true } })
  if (!admin) throw new Error('need an admin — npm run db:seed')
  const albums = await db.album.findMany({
    where: { status: 'live', priceStandard: { gt: 20 } },
    select: { ...BUNDLE_ALBUM_SELECT, creatorId: true },
    take: 3,
  })
  if (albums.length < 3) throw new Error('need three live albums — npm run db:seed')
  const ids = albums.map((album) => album.id)
  const minRate = Math.min(...bundleLines(albums).map((line) => line.rate))
  const safe = Math.max(1, Math.floor(minRate * 100) - 5)

  const stamp = Date.now()
  const bundleIds: string[] = []
  const orderIds: string[] = []
  const buyer = await db.user.create({ data: { email: `bundles-buyer-${stamp}@laqta.test` } })
  const promo = await db.promoCode.create({ data: { code: `BNDL${stamp}`.slice(0, 20), kind: 'percent', value: 10 } })

  const base = {
    titleAr: 'حزمة اختبار',
    titleEn: 'Test bundle',
    pricing: 'percent_off',
    value: safe,
    isActive: true,
  }
  const refused = async (label: string, input: Partial<Parameters<typeof saveBundle>[0]>, key: string) => {
    const result = await saveBundle({ ...base, slug: `test-${stamp}`, albumIds: ids, ...input } as Parameters<typeof saveBundle>[0], admin.id)
    report(`refuses ${label}`, !result.ok && result.error.key === `dash.bundles.error.${key}`, result.ok ? 'saved' : result.error.key)
    if (result.ok) bundleIds.push(result.id)
  }

  const buy = async (albumIds: string[], promoCode?: string) => {
    const result = await checkout({
      userId: buyer.id,
      lines: albumIds.map((albumId) => ({ albumId })),
      billing: { billingEntityType: 'individual' },
      method: 'bank_transfer',
      promoCode,
    })
    if (result.ok) orderIds.push(result.orderId)
    return result
  }

  try {
    await refused('a single album', { albumIds: [ids[0]] }, 'albumCount')
    await refused('a percentage over 90', { value: 95 }, 'percent')
    await refused('a discount over Laqta\'s share', { value: Math.ceil(minRate * 100) + 5 }, 'ceiling')
    await refused('a fixed price above the separate total', { pricing: 'fixed_price', value: 100000 }, 'fixed')
    await refused('a bad link', { slug: 'Not A Slug!' }, 'slug')
    await refused('banned wording', { titleEn: 'The largest Saudi library bundle' }, 'claim')
    await refused('an end date in the past', { endsAt: new Date(stamp - 1000) }, 'dates')
    const draft = await db.album.findFirst({ where: { status: { not: 'live' } }, select: { id: true } })
    if (draft) await refused('an album that is not live', { albumIds: [ids[0], draft.id] }, 'albumsLive')

    const saved = await saveBundle({ ...base, slug: `test-${stamp}`, albumIds: ids } as Parameters<typeof saveBundle>[0], admin.id)
    if (!saved.ok) throw new Error(`save failed: ${JSON.stringify(saved.error)}`)
    bundleIds.push(saved.id)
    report('a valid bundle saves, audited', (await db.auditLog.count({ where: { action: 'bundle.create', entityId: saved.id } })) === 1)
    const taken = await saveBundle({ ...base, slug: `test-${stamp}`, albumIds: ids } as Parameters<typeof saveBundle>[0], admin.id)
    report('refuses a link another bundle uses', !taken.ok && taken.error.key === 'dash.bundles.error.slugTaken')

    const all = bundleLines(albums)
    const resolved = await resolveBundles(all)
    report('every album in the cart → the bundle applies', resolved.applied.length === 1 && resolved.applied[0].bundleId === saved.id)
    report('one album missing → it does not', (await resolveBundles(all.slice(0, 2))).applied.length === 0)

    // A smaller bundle over two of the same albums, with a smaller saving.
    const small = await saveBundle(
      { ...base, value: 1, slug: `test-small-${stamp}`, albumIds: ids.slice(0, 2) } as Parameters<typeof saveBundle>[0],
      admin.id,
    )
    if (small.ok) bundleIds.push(small.id)
    const overlap = await resolveBundles(all)
    report('overlapping bundles: the bigger saving wins, once', overlap.applied.length === 1 && overlap.applied[0].bundleId === saved.id)

    // ── Checkout ───────────────────────────────────────────────────────────
    const order = await buy(ids)
    if (!order.ok) throw new Error(`checkout failed: ${order.messageKey}`)
    const placed = await db.order.findUniqueOrThrow({ where: { id: order.orderId }, include: { items: true } })
    const expected = priceBundle('percent_off', safe, all)!
    report('the order carries the bundle discount', Number(placed.bundleDiscountAmount) === expected.discount)
    report('the subtotal is the bundle price', cents(Number(placed.subtotal)) === expected.price)
    let creatorsWhole = true
    let linesAddUp = true
    for (const item of placed.items) {
      const album = albums.find((a) => a.id === item.albumId)!
      const pre = priceNow(album).priceStandard
      const alone = resolveCommission({
        grossAmount: pre,
        tier: album.creator.tier,
        isExclusive: album.isExclusive,
        override: album.creator.commissionRateOverride ? Number(album.creator.commissionRateOverride) : null,
      })
      if (Number(item.creatorNetAmount) !== alone.creatorNetAmount) creatorsWhole = false
      if (
        item.bundleId !== saved.id ||
        cents(Number(item.grossAmount) + Number(item.discountAmount)) !== pre ||
        cents(Number(item.commissionAmount) + Number(item.creatorNetAmount)) !== Number(item.grossAmount)
      ) linesAddUp = false
    }
    report('every creator is paid what the album earns alone', creatorsWhole)
    report('each line: paid + discount = price, Laqta + creator = paid', linesAddUp)

    const withPromo = await buy(ids, promo.code)
    report('a promo code does not stack on bundled albums', !withPromo.ok && withPromo.messageKey === 'promo.notApplicable')

    await setBundleActive(saved.id, false, admin.id)
    await setBundleActive(small.ok ? small.id : '', false, admin.id)
    const off = await buy(ids)
    const offOrder = off.ok ? await db.order.findUnique({ where: { id: off.orderId } }) : null
    report('a switched-off bundle does not apply', Number(offOrder?.bundleDiscountAmount ?? -1) === 0)
    await setBundleActive(saved.id, true, admin.id)

    // ── Settlement and refund ──────────────────────────────────────────────
    await settleOrder(order.orderId, `TEST-${stamp}`)
    const item = placed.items[0]
    const sale = await db.creatorLedger.findFirst({ where: { orderItemId: item.id, entryType: 'sale' } })
    report('settlement posts the creator\'s full net', Number(sale?.amount) === Number(item.creatorNetAmount))

    const half = cents(Number(item.grossAmount) / 3)
    await refundOrderItem({ orderItemId: item.id, amount: half, reason: 'verify:bundles', policyBasis: 'test', actorId: admin.id })
    await refundOrderItem({ orderItemId: item.id, amount: 100000, reason: 'verify:bundles', policyBasis: 'test', actorId: admin.id })
    const reversed = await db.refundLine.aggregate({
      where: { orderItemId: item.id },
      _sum: { creatorNetReversed: true, commissionReversed: true },
    })
    report(
      'partial + final refund reverses exactly what was posted',
      Number(reversed._sum.creatorNetReversed) === Number(item.creatorNetAmount) &&
        Number(reversed._sum.commissionReversed) === Number(item.commissionAmount),
      `${reversed._sum.creatorNetReversed} / ${item.creatorNetAmount}`,
    )
    const ledger = await db.creatorLedger.aggregate({ where: { orderItemId: item.id }, _sum: { amount: true } })
    report('the creator ledger nets to zero on the line', Number(ledger._sum.amount) === 0, String(ledger._sum.amount))
  } finally {
    const items = await db.orderItem.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })
    const itemIds = items.map((i) => i.id)
    const refunds = await db.refundLine.findMany({ where: { orderItemId: { in: itemIds } }, select: { refundId: true } })
    await db.refundLine.deleteMany({ where: { orderItemId: { in: itemIds } } })
    await db.refund.deleteMany({ where: { id: { in: refunds.map((r) => r.refundId) } } })
    await db.entitlement.deleteMany({ where: { userId: buyer.id } })
    await db.licenceCertificate.deleteMany({ where: { orderItemId: { in: itemIds } } })
    await db.creatorLedger.deleteMany({ where: { orderItemId: { in: itemIds } } })
    await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })
    await db.mailOutbox.deleteMany({ where: { toEmail: buyer.email! } })
    await db.order.deleteMany({ where: { id: { in: orderIds } } })
    await db.auditLog.deleteMany({ where: { entity: 'Bundle', entityId: { in: bundleIds } } })
    await db.auditLog.deleteMany({ where: { detail: { path: ['reason'], equals: 'verify:bundles' } } })
    await db.bundle.deleteMany({ where: { id: { in: bundleIds } } })
    await db.promoCode.delete({ where: { id: promo.id } })
    await db.user.delete({ where: { id: buyer.id } })
    await db.$disconnect()
  }

  console.log(failures ? `\n${failures} bundle check(s) failed.\n` : '\nBundles price right, creators are paid in full, and Laqta pays the difference.\n')
  process.exit(failures ? 1 : 0)
}

main().catch(async (error) => {
  console.error(error)
  await db.$disconnect()
  process.exit(1)
})
