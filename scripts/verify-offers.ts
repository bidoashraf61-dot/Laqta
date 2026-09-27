/**
 * Album offers run by their dates, and checkout charges what the page shows
 * (DEV-60).
 *
 *   npm run verify:offers        (no server needed)
 *
 * An offer is a sale price with optional start/end instants, decided at read
 * time (lib/offers.ts). What this protects: a buyer is never charged an offer
 * that has not started or has ended, and never charged the regular price while
 * an offer is running.
 */
import { checkout } from '../lib/orders'
import { offerRunning, offerRunningWhere, priceNow } from '../lib/offers'
import { db } from '../lib/db'
import { setRegularPrice } from '../lib/album-price'

let failures = 0
function report(label: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

const day = 86_400_000
const base = { priceStandard: 200, offerLabelAr: 'عرض', offerLabelEn: 'Offer' }

async function main() {
  console.log('Album offers\n')

  // ── The rule, on plain values ──────────────────────────────────────────────
  const none = priceNow({ ...base, offerPrice: null, offerStartsAt: null, offerEndsAt: null })
  report('no offer → regular price, nothing struck', none.priceStandard === 200 && none.compareAtPrice === null)
  const open = priceNow({ ...base, offerPrice: 150, offerStartsAt: null, offerEndsAt: null })
  report('an open offer → sale price, regular struck', open.priceStandard === 150 && open.compareAtPrice === 200 && open.offerLabelAr === 'عرض')
  const later = priceNow({ ...base, offerPrice: 150, offerStartsAt: new Date(Date.now() + day), offerEndsAt: null })
  report('a scheduled offer is not running yet', later.priceStandard === 200 && later.offerLabelAr === null)
  const over = priceNow({ ...base, offerPrice: 150, offerStartsAt: null, offerEndsAt: new Date(Date.now() - 1000) })
  report('an ended offer is not running', over.priceStandard === 200 && over.compareAtPrice === null)
  report(
    'an offer at or above the regular price never runs',
    !offerRunning({ priceStandard: 200, offerPrice: 200, offerStartsAt: null, offerEndsAt: null }),
  )

  // ── Against the database and checkout ──────────────────────────────────────
  const album = await db.album.findFirst({
    where: { status: 'live', priceStandard: { gt: 20 } },
    select: { id: true, priceStandard: true, offerPrice: true, offerStartsAt: true, offerEndsAt: true, offerLabelAr: true, offerLabelEn: true },
  })
  if (!album) throw new Error('need a live album — npm run db:seed')
  const regular = Number(album.priceStandard)
  const sale = Math.round(regular * 0.7)
  const buyer = await db.user.create({ data: { email: `offers-buyer-${Date.now()}@laqta.test` } })
  const orderIds: string[] = []

  const buy = async () => {
    const result = await checkout({
      userId: buyer.id,
      lines: [{ albumId: album.id }],
      billing: { billingEntityType: 'individual' },
      method: 'bank_transfer',
    })
    if (!result.ok) return null
    orderIds.push(result.orderId)
    const item = await db.orderItem.findFirst({ where: { orderId: result.orderId } })
    return Number(item?.grossAmount)
  }
  const setOffer = (data: { offerPrice: number | null; offerStartsAt?: Date | null; offerEndsAt?: Date | null }) =>
    db.album.update({
      where: { id: album.id },
      data: { offerStartsAt: null, offerEndsAt: null, offerLabelAr: 'عرض اختبار', offerLabelEn: null, ...data },
    })

  try {
    await setOffer({ offerPrice: sale })
    report('the running-offers filter finds it', (await db.album.count({ where: { id: album.id, ...offerRunningWhere() } })) === 1)
    report('checkout charges the running offer', (await buy()) === sale, `${sale}`)

    await setOffer({ offerPrice: sale, offerStartsAt: new Date(Date.now() + day) })
    report('the filter skips a scheduled offer', (await db.album.count({ where: { id: album.id, ...offerRunningWhere() } })) === 0)
    report('checkout charges the regular price before it starts', (await buy()) === regular, `${regular}`)

    await setOffer({ offerPrice: sale, offerEndsAt: new Date(Date.now() - 1000) })
    report('checkout charges the regular price after it ends', (await buy()) === regular)

    // ── DEV-61: the owner's special regular price ─────────────────────────────
    const admin = await db.user.findFirst({ where: { role: 'admin' }, select: { id: true } })
    await setOffer({ offerPrice: sale })
    const below = await setRegularPrice({ albumId: album.id, price: sale, actorId: admin!.id })
    report('a regular price at or under the offer is refused', !below.ok && below.error.key === 'dash.price.belowOffer')
    await setOffer({ offerPrice: null })
    const bad = await setRegularPrice({ albumId: album.id, price: '0', actorId: admin!.id })
    report('a zero price is refused', !bad.ok && bad.error.key === 'dash.price.invalid')
    const special = 999
    const done = await setRegularPrice({ albumId: album.id, price: special, reason: 'test', actorId: admin!.id })
    report('any price outside the calculator range is accepted', done.ok)
    report('checkout charges the new regular price', (await buy()) === special)
    report(
      'the change is audited with from/to',
      (await db.auditLog.count({ where: { action: 'album.price.set', entityId: album.id, detail: { path: ['to'], equals: special } } })) >= 1,
    )
    const draft = await db.album.findFirst({ where: { status: 'draft' }, select: { id: true } })
    if (draft) {
      const refusedDraft = await setRegularPrice({ albumId: draft.id, price: 100, actorId: admin!.id })
      report('a draft is priced at approval, not by hand', !refusedDraft.ok && refusedDraft.error.key === 'dash.price.notLive')
    }
  } finally {
    await db.auditLog.deleteMany({ where: { action: 'album.price.set', entityId: album.id, detail: { path: ['reason'], equals: 'test' } } })
    await db.album.update({
      where: { id: album.id },
      data: {
        priceStandard: album.priceStandard,
        offerPrice: album.offerPrice,
        offerStartsAt: album.offerStartsAt,
        offerEndsAt: album.offerEndsAt,
        offerLabelAr: album.offerLabelAr,
        offerLabelEn: album.offerLabelEn,
      },
    })
    const items = await db.orderItem.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })
    const ids = items.map((item) => item.id)
    await db.entitlement.deleteMany({ where: { userId: buyer.id } })
    await db.licenceCertificate.deleteMany({ where: { orderItemId: { in: ids } } })
    await db.creatorLedger.deleteMany({ where: { orderItemId: { in: ids } } })
    await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })
    await db.mailOutbox.deleteMany({ where: { toEmail: buyer.email! } })
    await db.order.deleteMany({ where: { id: { in: orderIds } } })
    await db.user.delete({ where: { id: buyer.id } })
    await db.$disconnect()
  }

  console.log(failures ? `\n${failures} offer check(s) failed.\n` : '\nOffers run by their dates, and checkout charges what the page shows.\n')
  process.exit(failures ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
