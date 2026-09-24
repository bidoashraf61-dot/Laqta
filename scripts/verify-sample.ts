/**
 * The free sample album.
 *
 *   npm run verify:sample        (DB on :5433)
 *
 * The sample is given away, so the danger is not money in — it is the frozen
 * entitlement path being bent to do it. This proves a claim is an ordinary
 * frozen entitlement: one per user, manifest fixed at claim time, no ledger
 * credit, no tax invoice, and nothing claimable while unpublished.
 *
 * It curates the real sample for the test and restores it afterwards.
 */

import { db } from '@/lib/db'
import { claimSample, getLibrary } from '@/lib/orders'
import { ensureSample, getPublicSample } from '@/lib/sample'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  console.log('Free sample album\n')

  const sample = await ensureSample()
  const before = await db.sampleAlbum.findUniqueOrThrow({
    where: { id: sample.id },
    select: { isPublished: true, publishedAt: true, clips: { select: { clipId: true, orderIndex: true } } },
  })

  const buyer = await db.user.findFirstOrThrow({ where: { email: 'buyer@agency.sa' }, select: { id: true } })
  const other = await db.user.findFirstOrThrow({ where: { email: 'creator@laqta.sa' }, select: { id: true } })
  const priorEntitlements = await db.entitlement.findMany({
    where: { albumId: sample.albumId, userId: { in: [buyer.id, other.id] } },
    select: { id: true },
  })
  const priorIds = new Set(priorEntitlements.map((row) => row.id))

  const clips = await db.clip.findMany({
    where: { album: { status: 'live' } },
    orderBy: [{ albumId: 'asc' }, { orderIndex: 'asc' }],
    distinct: ['albumId'],
    take: 3,
    select: { id: true },
  })

  const createdOrderIds: string[] = []
  try {
    // A clean slate for the two test users on this album.
    await removeClaims(sample.albumId, [buyer.id, other.id], priorIds, false)

    await db.sampleClip.deleteMany({ where: { sampleId: sample.id } })
    await db.sampleClip.createMany({
      data: clips.map((clip, index) => ({ sampleId: sample.id, clipId: clip.id, orderIndex: index })),
    })

    // ── Unpublished: invisible and unclaimable ───────────────────────────
    await db.sampleAlbum.update({ where: { id: sample.id }, data: { isPublished: false } })
    check('unpublished sample is not public', (await getPublicSample()) === null)
    const refused = await claimSample(other.id)
    check('unpublished sample cannot be claimed', !refused.ok)

    // ── Published: claim once ────────────────────────────────────────────
    await db.sampleAlbum.update({ where: { id: sample.id }, data: { isPublished: true, publishedAt: new Date() } })
    const pub = await getPublicSample()
    check('published sample is public with its clips', pub?.clips.length === clips.length, `${pub?.clips.length}`)

    const first = await claimSample(buyer.id)
    check('first claim succeeds', first.ok && !first.alreadyClaimed)
    if (!first.ok) throw new Error('claim failed')

    const entitlement = await db.entitlement.findUniqueOrThrow({
      where: { id: first.entitlementId },
      include: { orderItem: { include: { order: { include: { invoice: true } } } } },
    })
    const order = entitlement.orderItem.order
    createdOrderIds.push(order.id)
    check('claim is a paid order of 0', order.status === 'paid' && Number(order.total) === 0, `${order.status} ${order.total}`)
    check('no tax invoice for a zero-value order', order.invoice == null)
    check(
      'commission frozen at 0',
      Number(entitlement.orderItem.commissionRate) === 0 && Number(entitlement.orderItem.creatorNetAmount) === 0,
    )
    const ledger = await db.creatorLedger.count({ where: { orderItemId: entitlement.orderItemId } })
    check('no creator ledger row for a free claim', ledger === 0, `${ledger}`)
    check(
      'manifest snapshot = the curated clips, in order',
      JSON.stringify(entitlement.clipIdsSnapshot) === JSON.stringify(clips.map((clip) => clip.id)),
    )

    // ── Idempotent ───────────────────────────────────────────────────────
    const again = await claimSample(buyer.id)
    check(
      'second claim returns the same entitlement, creates nothing',
      again.ok && again.alreadyClaimed && again.entitlementId === first.entitlementId,
    )
    const orders = await db.orderItem.count({ where: { albumId: sample.albumId, order: { userId: buyer.id } } })
    check('exactly one order line for the buyer', orders === 1, `${orders}`)

    // ── Frozen against later curation ────────────────────────────────────
    await db.sampleClip.deleteMany({ where: { sampleId: sample.id, clipId: clips[0].id } })
    const after = await db.entitlement.findUniqueOrThrow({
      where: { id: first.entitlementId },
      select: { clipIdsSnapshot: true, orderItem: { select: { clipManifestSnapshot: true } } },
    })
    check(
      'curating afterwards does not change what the buyer owns',
      JSON.stringify(after.clipIdsSnapshot) === JSON.stringify(clips.map((clip) => clip.id)) &&
        (after.orderItem.clipManifestSnapshot as unknown[]).length === clips.length,
    )

    const library = await getLibrary(buyer.id)
    const entry = library.find((row) => row.id === first.entitlementId)
    check('library shows the sample, marked as the sample', entry?.isSample === true && entry.paid)
    check(
      'every sample clip names its source album',
      entry?.clips.every((clip) => clip.sourceAlbum?.slug) === true,
    )
  } finally {
    await removeClaims(sample.albumId, [buyer.id, other.id], priorIds, true)
    await db.sampleClip.deleteMany({ where: { sampleId: sample.id } })
    if (before.clips.length) {
      await db.sampleClip.createMany({
        data: before.clips.map((row) => ({ sampleId: sample.id, clipId: row.clipId, orderIndex: row.orderIndex })),
      })
    }
    await db.sampleAlbum.update({
      where: { id: sample.id },
      data: { isPublished: before.isPublished, publishedAt: before.publishedAt },
    })
    await db.$disconnect()
  }

  console.log(failures ? `\n${failures} sample check(s) failed.` : '\nThe free sample is an ordinary frozen entitlement: once per user, no money moves.')
  process.exit(failures ? 1 : 0)
}

/** Remove the test users' claims on the sample (never ones that existed before). */
async function removeClaims(albumId: string, userIds: string[], keep: Set<string>, _final: boolean) {
  const rows = await db.entitlement.findMany({
    where: { albumId, userId: { in: userIds } },
    select: { id: true, orderItemId: true, orderItem: { select: { orderId: true, order: { select: { orderNumber: true } } } } },
  })
  for (const row of rows) {
    if (keep.has(row.id)) continue
    await db.download.deleteMany({ where: { entitlementId: row.id } })
    await db.entitlement.delete({ where: { id: row.id } })
    await db.licenceCertificate.deleteMany({ where: { orderItemId: row.orderItemId } })
    await db.creatorLedger.deleteMany({ where: { orderItemId: row.orderItemId } })
    await db.orderItem.delete({ where: { id: row.orderItemId } })
    await db.invoice.deleteMany({ where: { orderId: row.orderItem.orderId } })
    await db.order.delete({ where: { id: row.orderItem.orderId } })
    await db.mailOutbox.deleteMany({
      where: { template: 'sample.claimed', payload: { path: ['orderNumber'], equals: row.orderItem.order.orderNumber } },
    })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
