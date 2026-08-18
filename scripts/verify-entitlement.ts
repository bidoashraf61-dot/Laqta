/**
 * The entitlement rule.
 *
 *   npx tsx scripts/verify-entitlement.ts
 *
 * Brief 04 asks for this test by name: "buy, then mutate the album, confirm
 * library unchanged". It is the one invariant the whole business model rests
 * on — "buy once, own forever" — and the failure mode is silent. Nobody
 * notices entitlement drifting until a buyer reports that footage they paid
 * for has vanished, by which point the trust is gone.
 *
 * Runs against the development database and cleans up after itself.
 */
import { checkout, getLibrary, settleOrder } from '../lib/orders'
import { db } from '../lib/db'

let failures = 0
function report(name: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  console.log('Entitlement survives album edits\n')

  const buyer = await db.user.findUnique({ where: { email: 'buyer@agency.sa' } })
  const album = await db.album.findFirst({
    where: { slug: 'alula-golden-hour-aerials' },
    include: { clips: { orderBy: { orderIndex: 'asc' } } },
  })
  if (!buyer || !album) throw new Error('seed the database first: npm run db:seed')

  const originalCount = album.clips.length
  report('album has clips to sell', originalCount > 0, `${originalCount} clips`)

  // ── Buy ───────────────────────────────────────────────────────────────────
  const result = await checkout({
    userId: buyer.id,
    lines: [{ albumId: album.id }],
    billing: { billingEntityType: 'business', legalName: 'اختبار', vatNumber: '300000000000003' },
    method: 'bank_transfer',
  })
  report('checkout succeeds', result.ok, result.ok ? result.orderNumber : result.messageKey)
  if (!result.ok) throw new Error('checkout failed')

  await settleOrder(result.orderId, 'TEST-SETTLE')

  const before = await getLibrary(buyer.id)
  const entry = before.find((row) => row.orderNumber === result.orderNumber)
  report('purchase appears in the library', Boolean(entry))
  report(
    'manifest froze every clip',
    entry?.clips.length === originalCount,
    `${entry?.clips.length}`,
  )

  const frozenIds = new Set(entry?.clips.map((clip) => clip.id))

  // ── Now mutate the album the way a creator would ──────────────────────────
  const victim = album.clips[album.clips.length - 1]
  const addedTitle = 'لقطة أُضيفت بعد الشراء'

  await db.clip.delete({ where: { id: victim.id } })
  const added = await db.clip.create({
    data: {
      albumId: album.id,
      orderIndex: 999,
      slug: `post-purchase-${Date.now()}`,
      titleAr: addedTitle,
      titleEn: 'Added after purchase',
      durationS: 5,
      width: 3840,
      height: 2160,
      fps: 24,
      ingestStatus: 'ready',
    },
  })
  await db.clip.update({
    where: { id: album.clips[0].id },
    data: { titleAr: 'عنوان تغيّر بعد الشراء' },
  })

  const liveNow = await db.clip.count({ where: { albumId: album.id } })
  report('the live album really did change', liveNow === originalCount, `${liveNow} clips now`)

  // ── The assertion that matters ────────────────────────────────────────────
  const after = await getLibrary(buyer.id)
  const entryAfter = after.find((row) => row.orderNumber === result.orderNumber)

  report(
    'library still lists the same number of clips',
    entryAfter?.clips.length === originalCount,
    `${entryAfter?.clips.length} vs ${originalCount}`,
  )
  report(
    'the DELETED clip is still owned',
    Boolean(entryAfter?.clips.some((clip) => clip.id === victim.id)),
  )
  report(
    'the ADDED clip was NOT granted retroactively',
    !entryAfter?.clips.some((clip) => clip.id === added.id),
  )
  report(
    'the RENAMED clip keeps its title as sold',
    entryAfter?.clips.find((clip) => clip.id === album.clips[0].id)?.titleAr ===
      album.clips[0].titleAr,
  )
  report(
    'every frozen id is still present',
    entryAfter?.clips.every((clip) => frozenIds.has(clip.id)) ?? false,
  )

  // ── Clean up ──────────────────────────────────────────────────────────────
  await db.clip.delete({ where: { id: added.id } })
  await db.clip.update({
    where: { id: album.clips[0].id },
    data: { titleAr: album.clips[0].titleAr },
  })
  await db.clip.create({
    data: {
      albumId: album.id,
      orderIndex: victim.orderIndex,
      slug: victim.slug,
      titleAr: victim.titleAr,
      titleEn: victim.titleEn,
      durationS: victim.durationS,
      width: victim.width,
      height: victim.height,
      fps: victim.fps,
      thumbnailKeys: victim.thumbnailKeys,
      ingestStatus: 'ready',
    },
  })

  const order = await db.order.findUnique({
    where: { id: result.orderId },
    include: { items: true },
  })
  if (order) {
    await db.creatorLedger.deleteMany({
      where: { orderItemId: { in: order.items.map((item) => item.id) } },
    })
    await db.entitlement.deleteMany({
      where: { orderItemId: { in: order.items.map((item) => item.id) } },
    })
    await db.licenceCertificate.deleteMany({
      where: { orderItemId: { in: order.items.map((item) => item.id) } },
    })
    await db.invoice.deleteMany({ where: { orderId: order.id } })
    await db.order.delete({ where: { id: order.id } })
  }

  console.log(
    failures === 0
      ? '\nEntitlement is frozen. "Buy once, own forever" holds.'
      : `\n${failures} check(s) failed — the ownership promise is broken.`,
  )
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
