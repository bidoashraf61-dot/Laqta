/**
 * The operator sets every album's price, at approval, inside $49–$249 (DEV-09).
 *
 *   npm run verify:pricing        (no server needed)
 *
 * ── What broke before ───────────────────────────────────────────────────────
 * A creator picked a price band when creating an album, and the band's price
 * was copied on. The bands still dated from the 8–35-clip era, so a creator
 * could put a 70-clip album on sale at $79 or $799 with nobody deciding.
 *
 * ── What this proves ────────────────────────────────────────────────────────
 * Approval is refused without a price, and below or above the range; an
 * in-range price lands on the album with the band tier for its clip count;
 * checkout refuses a live album that was never priced.
 */
import { decideReview } from '../lib/admin'
import { checkout } from '../lib/orders'
import { CHECK_KEYS, type Checklist } from '../lib/review-checklist'
import { PRICE_MAX_USD, PRICE_MIN_USD, bandForCount, parseAlbumPrice } from '../lib/price-bands'
import { db } from '../lib/db'

let failures = 0
function report(label: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

const allPass = Object.fromEntries(CHECK_KEYS.map((key) => [key, { state: 'pass' }])) as Checklist

async function main() {
  console.log('Album pricing\n')

  report('range is $49–$249', PRICE_MIN_USD === 49 && PRICE_MAX_USD === 249)
  report('48.99 and 249.01 are refused', parseAlbumPrice('48.99') === null && parseAlbumPrice('249.01') === null)
  report('49 and 249 are accepted', parseAlbumPrice('49') === 49 && parseAlbumPrice(249) === 249)
  report('a third of a cent is refused', parseAlbumPrice('99.999') === null)
  report('blank is refused', parseAlbumPrice('') === null && parseAlbumPrice(null) === null)

  const bands = await db.priceBand.findMany({ orderBy: { minClips: 'asc' } })
  report(
    'every band sits inside the 30–70 album and the price range',
    bands.length > 0 &&
      bands.every(
        (band) =>
          band.minClips >= 30 &&
          band.maxClips !== null &&
          band.maxClips <= 70 &&
          parseAlbumPrice(Number(band.priceStandard)) !== null,
      ),
    bands.map((b) => `${b.minClips}–${b.maxClips ?? '∞'} $${b.priceStandard}`).join(', '),
  )
  report(
    'every count from 30 to 70 has a suggested band',
    Array.from({ length: 41 }, (_, i) => 30 + i).every((count) => bandForCount(count, bands) !== null),
  )

  // A throwaway creator, album (45 clips, unpriced) and review task.
  const run = Date.now()
  const user = await db.user.create({ data: { email: `pricing-${run}@laqta.test`, role: 'creator' } })
  const admin = await db.user.findFirst({ where: { role: 'admin' }, select: { id: true } })
  const creator = await db.creator.create({
    data: { userId: user.id, handle: `pricing-${run}`, displayNameAr: 'تسعير', displayNameEn: 'Pricing', status: 'approved' },
  })
  const album = await db.album.create({
    data: {
      slug: `pricing-${run}`,
      creatorId: creator.id,
      titleAr: 'ألبوم تسعير',
      titleEn: 'Pricing album',
      priceStandard: 0,
      clipCount: 45,
      status: 'in_review',
    },
  })
  const task = await db.reviewTask.create({
    data: { albumId: album.id, status: 'unassigned', checklist: allPass, submittedAt: new Date(), slaDueAt: new Date() },
  })
  const buyer = await db.user.create({ data: { email: `pricing-buyer-${run}@laqta.test` } })

  try {
    const approve = (price: unknown) =>
      decideReview({ taskId: task.id, reviewerId: admin!.id, checklist: allPass, decision: 'approve', note: '', price: price as string })

    const none = await approve(undefined)
    report('approval without a price is refused', !none.ok && none.messageKey === 'admin.priceRequired')
    const low = await approve('30')
    report('approval below $49 is refused', !low.ok)
    const high = await approve('300')
    report('approval above $249 is refused', !high.ok)
    report('a refused approval leaves the album unpriced', Number((await db.album.findUnique({ where: { id: album.id } }))?.priceStandard) === 0)

    // Unpriced and (forced) live: checkout must still refuse it.
    await db.album.update({ where: { id: album.id }, data: { status: 'live' } })
    const sold = await checkout({
      userId: buyer.id,
      lines: [{ albumId: album.id }],
      billing: { billingEntityType: 'individual' },
      method: 'bank_transfer',
    })
    report('checkout refuses an unpriced album', !sold.ok)
    await db.album.update({ where: { id: album.id }, data: { status: 'in_review' } })

    const ok = await approve('129.50')
    const after = await db.album.findUnique({ where: { id: album.id } })
    report('an in-range price approves', ok.ok)
    report('the album carries the operator’s price', Number(after?.priceStandard) === 129.5, String(after?.priceStandard))
    report('the tier records the band for 45 clips', after?.tier === bandForCount(45, bands)?.tier, after?.tier)
    report('the album is live, in USD', after?.status === 'live' && after?.currency === 'USD')
    report(
      'the price is audited',
      (await db.auditLog.count({ where: { action: 'album.review.approve', entityId: album.id, detail: { path: ['price'], equals: 129.5 } } })) === 1,
    )
  } finally {
    await db.auditLog.deleteMany({ where: { entityId: album.id } })
    await db.mailOutbox.deleteMany({ where: { toEmail: user.email! } }).catch(() => {})
    await db.order.deleteMany({ where: { userId: buyer.id } })
    await db.reviewTask.deleteMany({ where: { albumId: album.id } })
    await db.album.delete({ where: { id: album.id } })
    await db.user.delete({ where: { id: buyer.id } })
    await db.user.delete({ where: { id: user.id } })
    await db.$disconnect()
  }

  console.log(failures ? `\n${failures} pricing check(s) failed.\n` : '\nEvery album price is the operator’s, in range.\n')
  process.exit(failures ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
