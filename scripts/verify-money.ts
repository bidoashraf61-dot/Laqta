/**
 * The money invariants.
 *
 *   npx tsx scripts/verify-money.ts
 *
 * Two things must hold no matter what happens to a creator's tier afterwards:
 *
 *   1. A refund reverses commission at the rate FROZEN on the OrderItem. If it
 *      recomputed from the creator's current tier, a creator promoted between
 *      sale and refund would make the ledger stop netting to zero — the
 *      platform would silently absorb or claw back the difference, and nobody
 *      would notice until an audit.
 *
 *   2. The 30-day hold is a property of the ledger rows, not a stored number.
 *      Money from a sale is not payable until the refund window on that sale
 *      has closed.
 */
import { checkout, settleOrder } from '../lib/orders'
import { refundOrderItem } from '../lib/admin'
import { getEarnings } from '../lib/studio'
import { resolveCommission, reverseCommission } from '../lib/commission'
import { db } from '../lib/db'

let failures = 0
function report(name: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

async function main() {
  console.log('Money invariants\n')

  const buyer = await db.user.findUnique({ where: { email: 'buyer@agency.sa' } })
  const album = await db.album.findFirst({
    where: { slug: 'alula-golden-hour-aerials' },
    include: { creator: true },
  })
  if (!buyer || !album) throw new Error('seed the database first: npm run db:seed')

  const originalTier = album.creator.tier

  // ── Sell at the creator's current tier ────────────────────────────────────
  const result = await checkout({
    userId: buyer.id,
    lines: [{ albumId: album.id, licenceTier: 'standard' }],
    billing: { billingEntityType: 'individual' },
    method: 'bank_transfer',
  })
  if (!result.ok) throw new Error('checkout failed')
  await settleOrder(result.orderId, 'TEST')

  const item = await db.orderItem.findFirst({
    where: { orderId: result.orderId },
  })
  if (!item) throw new Error('no order item')

  const expected = resolveCommission({
    grossAmount: Number(album.priceStandard),
    tier: originalTier,
    isExclusive: album.isExclusive,
    override: album.creator.commissionRateOverride
      ? Number(album.creator.commissionRateOverride)
      : null,
  })

  const frozenRate = Number(item.commissionRate)
  report('commission frozen at sale', frozenRate === expected.rate, `${frozenRate}`)
  report(
    'creator net matches the frozen rate',
    Number(item.creatorNetAmount) === expected.creatorNetAmount,
    `${Number(item.creatorNetAmount)}`,
  )
  report('the basis is recorded for audit', item.commissionBasis !== null)

  // ── Hold ──────────────────────────────────────────────────────────────────
  const ledgerRow = await db.creatorLedger.findFirst({
    where: { orderItemId: item.id, entryType: 'sale' },
  })
  const holdDays = Number(process.env.PAYOUT_HOLD_DAYS ?? 30)
  const expectedRelease = Date.now() + holdDays * 24 * 60 * 60 * 1000
  const drift = Math.abs((ledgerRow?.availableAt?.getTime() ?? 0) - expectedRelease)
  report('sale is held for the payout window', drift < 60_000, `${holdDays} days`)

  const earningsBefore = await getEarnings(album.creatorId)
  report(
    'held money is not counted as available',
    earningsBefore.held >= Number(item.creatorNetAmount),
    `held ${round2(earningsBefore.held)}`,
  )

  // ── Now promote the creator, THEN refund ─────────────────────────────────
  // This is the trap. A naive refund recomputes commission and uses the new
  // tier, and the numbers stop reconciling.
  const promoted = originalTier === 'gold' ? 'standard' : 'gold'
  await db.creator.update({ where: { id: album.creatorId }, data: { tier: promoted } })

  const refundResult = await refundOrderItem({
    orderItemId: item.id,
    amount: Number(item.grossAmount),
    reason: 'اختبار',
    policyBasis: 'no_download_within_7d',
    actorId: (await db.user.findFirstOrThrow({ where: { role: 'admin' } })).id,
  })
  report('refund succeeds', refundResult.ok)

  const line = await db.refundLine.findFirst({ where: { orderItemId: item.id } })
  const expectedReversal = reverseCommission({
    refundGross: Number(item.grossAmount),
    frozenRate,
  })

  report(
    'refund reverses at the FROZEN rate, not the new tier',
    Number(line?.commissionReversed) === expectedReversal.commissionReversed,
    `${Number(line?.commissionReversed)} (tier moved ${originalTier} → ${promoted})`,
  )
  report(
    'creator net reversal matches the original credit',
    Number(line?.creatorNetReversed) === Number(item.creatorNetAmount),
    `${Number(line?.creatorNetReversed)} vs ${Number(item.creatorNetAmount)}`,
  )

  const saleEntry = await db.creatorLedger.findFirst({
    where: { orderItemId: item.id, entryType: 'sale' },
  })
  const refundEntry = await db.creatorLedger.findFirst({
    where: { orderItemId: item.id, entryType: 'refund' },
  })
  report(
    'ledger nets to zero on a full refund',
    round2(Number(saleEntry?.amount ?? 0) + Number(refundEntry?.amount ?? 0)) === 0,
    `${Number(saleEntry?.amount)} + ${Number(refundEntry?.amount)}`,
  )

  const entitlement = await db.entitlement.findFirst({ where: { orderItemId: item.id } })
  report('a fully refunded entitlement is revoked', entitlement?.revokedAt != null)

  // ── Clean up ──────────────────────────────────────────────────────────────
  await db.creator.update({ where: { id: album.creatorId }, data: { tier: originalTier } })
  await db.refundLine.deleteMany({ where: { orderItemId: item.id } })
  await db.refund.deleteMany({ where: { orderId: result.orderId } })
  await db.creatorLedger.deleteMany({ where: { orderItemId: item.id } })
  await db.entitlement.deleteMany({ where: { orderItemId: item.id } })
  await db.licenceCertificate.deleteMany({ where: { orderItemId: item.id } })
  await db.invoice.deleteMany({ where: { orderId: result.orderId } })
  await db.orderItem.deleteMany({ where: { orderId: result.orderId } })
  await db.order.delete({ where: { id: result.orderId } })

  console.log(failures === 0 ? '\nAll money checks passed.' : `\n${failures} check(s) failed.`)
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
