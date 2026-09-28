/**
 * The account holder's privacy controls (DEV-52).
 *
 *   npx tsx scripts/verify-privacy.ts
 *
 * Makes a throwaway buyer who owns an album, has a board, a cart and a waitlist
 * entry, then proves:
 *
 *   1. The export is theirs and complete: profile, the order with its licence
 *      number, the board, the waitlist entry.
 *   2. Deletion refuses a confirmation that is not their email, and refuses a
 *      creator outright.
 *   3. Deletion clears the person — email, name, mobile, password, 2FA,
 *      billing profile, boards, cart, waitlist — and marks the row deleted.
 *   4. It keeps what tax needs: the order, its lines, its licence certificate
 *      and the frozen commission, untouched.
 *
 * Everything it creates is removed at the end, and the album's sale counters
 * and the creator's balances are put back.
 */
import { randomBytes } from 'node:crypto'
import { checkout, settleOrder } from '../lib/orders'
import { deleteOwnAccount, exportAccountData } from '../lib/account-privacy'
import { db } from '../lib/db'

let failures = 0
function report(name: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  console.log('Privacy controls (DEV-52)\n')

  const album = await db.album.findFirst({
    where: { status: 'live', clips: { some: {} } },
    include: { creator: true, clips: { select: { id: true }, take: 1 } },
  })
  if (!album) throw new Error('seed the database first: npm run db:seed')
  const creatorBefore = { balanceHeld: album.creator.balanceHeld, lifetimeGmv: album.creator.lifetimeGmv }
  const salesBefore = album.salesCount

  const tag = randomBytes(4).toString('hex')
  const email = `privacy-${tag}@example.test`
  const buyer = await db.user.create({
    data: {
      email,
      name: 'Privacy Gate',
      phone: `+9665${String(Date.now()).slice(-8)}`,
      passwordHash: 'x',
      country: 'SA',
      legalName: 'Gate Co',
      vatNumber: '300000000000003',
      billingAddress: { line1: 'Riyadh' },
    },
  })
  let orderId: string | null = null
  let orderNumber: string | null = null

  try {
    const placed = await checkout({
      userId: buyer.id,
      lines: [{ albumId: album.id }],
      billing: { billingEntityType: 'individual' },
      method: 'bank_transfer',
    })
    if (!placed.ok) throw new Error(`checkout failed: ${placed.messageKey}`)
    orderId = placed.orderId
    orderNumber = placed.orderNumber
    await settleOrder(placed.orderId, 'MANUAL-verify-privacy')
    await db.board.create({
      data: { userId: buyer.id, name: 'Board', shareToken: `gate-${tag}`, clips: { create: { clipId: album.clips[0].id } } },
    })
    await db.cart.create({ data: { userId: buyer.id } })
    await db.waitlistEntry.create({
      data: { email, locale: 'ar', source: 'gate', consentAt: new Date(), consentText: 'gate', unsubscribeToken: `gate-${tag}` },
    })

    // ── 1. Export ──────────────────────────────────────────────────────────
    const data = await exportAccountData(buyer.id)
    report('the export is the account holder’s own', data?.account.email === email)
    report(
      'the export lists the order with its licence number',
      data?.orders.length === 1 && Boolean(data.orders[0].albums[0]?.licenceCertificate),
    )
    report('the export lists the board and the waitlist entry', data?.boards.length === 1 && data.waitlist !== null)
    report(
      'the export carries no commission or creator earnings',
      !JSON.stringify(data).match(/commission|creatorNet/i),
    )

    // ── 2. Refusals ────────────────────────────────────────────────────────
    const wrong = await deleteOwnAccount(buyer.id, 'someone-else@example.test')
    report('a confirmation that is not their email is refused', !wrong.ok && wrong.reason === 'confirm_mismatch')
    const creator = await deleteOwnAccount(album.creator.userId, 'anything')
    report('a creator cannot delete themselves here', !creator.ok && creator.reason === 'not_buyer')

    // ── 3. Deletion clears the person ──────────────────────────────────────
    const done = await deleteOwnAccount(buyer.id, `  ${email.toUpperCase()} `)
    report('their own email (any case, spaces trimmed) deletes the account', done.ok)
    const after = await db.user.findUniqueOrThrow({ where: { id: buyer.id } })
    report('the row is marked deleted and suspended', after.deletedAt !== null && after.status === 'suspended')
    report(
      'email, name, mobile, password and country are gone',
      after.email === null && after.name === null && after.phone === null && after.passwordHash === null && after.country === null,
    )
    report(
      'the billing profile is gone',
      after.legalName === null && after.vatNumber === null && after.billingAddress === null,
    )
    const [boards, carts, waitlist] = await Promise.all([
      db.board.count({ where: { userId: buyer.id } }),
      db.cart.count({ where: { userId: buyer.id } }),
      db.waitlistEntry.count({ where: { email } }),
    ])
    report('boards, cart and waitlist entry are gone', boards === 0 && carts === 0 && waitlist === 0)
    const again = await deleteOwnAccount(buyer.id, email)
    report('deleting twice is refused', !again.ok && again.reason === 'already_deleted')

    // ── 4. What tax needs is kept ──────────────────────────────────────────
    const order = await db.order.findUniqueOrThrow({
      where: { id: placed.orderId },
      include: { items: { include: { certificate: true } }, invoice: true },
    })
    report('the order is kept, still paid', order.status === 'paid')
    report(
      'its line keeps the frozen commission and the licence certificate',
      order.items.length === 1 && Number(order.items[0].commissionRate) > 0 && order.items[0].certificate !== null,
    )
    report('its invoice is kept', order.invoice !== null)
  } finally {
    if (orderId) {
      const items = await db.orderItem.findMany({ where: { orderId }, select: { id: true } })
      const itemIds = items.map((item) => item.id)
      await db.creatorLedger.deleteMany({ where: { orderItemId: { in: itemIds } } })
      await db.entitlement.deleteMany({ where: { orderItemId: { in: itemIds } } })
      await db.licenceCertificate.deleteMany({ where: { orderItemId: { in: itemIds } } })
      await db.invoice.deleteMany({ where: { orderId } })
      await db.orderItem.deleteMany({ where: { orderId } })
      await db.order.delete({ where: { id: orderId } })
      if (orderNumber) await db.mailOutbox.deleteMany({ where: { payload: { path: ['orderNumber'], equals: orderNumber } } })
    }
    await db.waitlistEntry.deleteMany({ where: { email } })
    await db.auditLog.deleteMany({ where: { actorId: buyer.id } })
    await db.user.delete({ where: { id: buyer.id } })
    await db.creator.update({ where: { id: album.creatorId }, data: creatorBefore })
    await db.album.update({ where: { id: album.id }, data: { salesCount: salesBefore } })
  }

  console.log(failures === 0 ? '\nAll privacy checks passed.' : `\n${failures} check(s) failed.`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
