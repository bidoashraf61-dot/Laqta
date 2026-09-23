/**
 * The Paymob gateway invariants.
 *
 *   npx tsx scripts/verify-payments.ts
 *
 * No network and no real keys: the gate generates a throwaway HMAC secret and
 * integration ids at runtime and hands them to the handler explicitly, and the
 * intention call runs against a stubbed `fetch`. What it proves:
 *
 *   1. The HMAC is computed over Paymob's documented field order — checked
 *      against the concatenated string in Paymob's own docs — and a forged or
 *      tampered callback is rejected before the database is touched.
 *   2. A callback is idempotent on (transaction id, state): a replay does not
 *      settle twice or post a second ledger row.
 *   3. An amount or currency that does not match the frozen order is recorded
 *      as a failure and settles nothing. So is a declined transaction.
 *   4. A paid webhook produces EXACTLY what the admin's manual «تأكيد الدفع»
 *      produces: same frozen commission, same ledger credit and hold, same
 *      frozen clip manifest, same library entry. There is one paid path.
 *   5. Card / Apple Pay are offered only when Paymob is fully configured, and
 *      mada / Tabby / Tamara never are.
 */
import { randomBytes } from 'node:crypto'
import { checkout, getLibrary, settleOrder } from '../lib/orders'
import { availableMethods } from '../lib/payments'
import {
  createPaymobIntention,
  paymobConfig,
  toMinorUnits,
  transactionHmac,
  transactionHmacString,
  type PaymobConfig,
} from '../lib/paymob'
import { handlePaymobCallback, settlementSource } from '../lib/paymob-callback'
import { db } from '../lib/db'

let failures = 0
function report(name: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const CARD_ID = 900001
const APPLE_ID = 900002

const config: PaymobConfig = {
  baseUrl: 'https://paymob.invalid',
  secretKey: `sk_test_${randomBytes(8).toString('hex')}`,
  publicKey: `pk_test_${randomBytes(8).toString('hex')}`,
  hmacSecret: randomBytes(32).toString('hex'),
  currency: 'USD',
  integrations: { card: CARD_ID, apple_pay: APPLE_ID },
}

let txnSeq = Date.now()
function transaction(
  orderNumber: string,
  amountCents: number,
  overrides: Record<string, unknown> = {},
) {
  txnSeq += 1
  return {
    id: txnSeq,
    pending: false,
    amount_cents: amountCents,
    success: true,
    is_auth: false,
    is_capture: false,
    is_standalone_payment: true,
    is_voided: false,
    is_refunded: false,
    is_3d_secure: true,
    integration_id: CARD_ID,
    has_parent_transaction: false,
    error_occured: false,
    currency: 'USD',
    created_at: '2026-09-24T10:00:00.000000',
    owner: 302852,
    order: { id: 217503754, merchant_order_id: orderNumber },
    source_data: { pan: '2346', type: 'card', sub_type: 'MasterCard' },
    ...overrides,
  }
}

const signed = (obj: Record<string, unknown>) => transactionHmac(obj, config.hmacSecret)
const envelope = (obj: Record<string, unknown>) => ({ type: 'TRANSACTION', obj })

async function main() {
  console.log('Payment gateway (Paymob)\n')

  // ── 1. HMAC field order, against Paymob's published example ──────────────
  const documented = transaction('X', 100000, {
    id: 192036465,
    currency: 'EGP',
    created_at: '2024-06-13T11:33:44.592345',
    integration_id: 4097558,
    order: { id: 217503754 },
    owner: 302852,
  })
  const expectedString =
    '1000002024-06-13T11:33:44.592345EGPfalsefalse1920364654097558truefalsefalsefalsetruefalse217503754302852false2346MasterCardcardtrue'
  report(
    'HMAC string matches Paymob’s documented field order',
    transactionHmacString(documented) === expectedString,
  )

  // ── 5 (config half). Dormant unless complete ─────────────────────────────
  const saved = { ...process.env }
  for (const key of Object.keys(process.env)) if (key.startsWith('PAYMOB_')) delete process.env[key]
  report('unconfigured: paymobConfig() is null', paymobConfig() === null)
  report(
    'unconfigured: only bank transfer is offered',
    JSON.stringify(availableMethods()) === JSON.stringify(['bank_transfer']),
    availableMethods().join(','),
  )
  process.env.PAYMOB_SECRET_KEY = 'x'
  process.env.PAYMOB_PUBLIC_KEY = 'y'
  process.env.PAYMOB_INTEGRATION_IDS = `card:${CARD_ID},apple_pay:${APPLE_ID}`
  report('keys without an HMAC secret stay dormant', paymobConfig() === null)
  process.env.PAYMOB_HMAC_SECRET = 'z'
  const offered = availableMethods()
  report(
    'configured: card + Apple Pay + bank transfer, nothing else',
    JSON.stringify(offered) === JSON.stringify(['card', 'apple_pay', 'bank_transfer']),
    offered.join(','),
  )
  report(
    'mada / Tabby / Tamara are never offered',
    !offered.some((method) => ['mada', 'tabby', 'tamara'].includes(method)),
  )
  report('currency defaults to USD', paymobConfig()?.currency === 'USD')
  for (const key of Object.keys(process.env)) if (key.startsWith('PAYMOB_')) delete process.env[key]
  Object.assign(process.env, saved)

  report(
    'unconfigured callback answers 503',
    (await handlePaymobCallback({}, 'x', null)).httpStatus === 503,
  )

  // ── Fixtures ─────────────────────────────────────────────────────────────
  const buyer = await db.user.findUnique({ where: { email: 'buyer@agency.sa' } })
  if (!buyer) throw new Error('seed the database first: npm run db:seed')
  const owned = await db.entitlement.findMany({
    where: { userId: buyer.id },
    select: { albumId: true },
  })
  const album = await db.album.findFirst({
    where: {
      status: 'live',
      id: { notIn: owned.map((row) => row.albumId) },
      clips: { some: {} },
    },
    include: { creator: true, clips: { select: { id: true } } },
  })
  if (!album) throw new Error('no live album this buyer does not already own')

  const creatorBefore = {
    balanceHeld: album.creator.balanceHeld,
    lifetimeGmv: album.creator.lifetimeGmv,
  }
  const salesBefore = album.salesCount
  const cart = await db.cart.findUnique({ where: { userId: buyer.id }, include: { items: true } })
  const cartLineBefore = cart?.items.find((item) => item.albumId === album.id) ?? null

  const orderIds: string[] = []
  const cleanupNumbers: string[] = []

  try {
    // ── Intention request, against a stubbed fetch ─────────────────────────
    const realFetch = globalThis.fetch
    let sent: { url: string; init: RequestInit } | null = null
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      sent = { url, init }
      return new Response(JSON.stringify({ id: 'pi_test_1', client_secret: 'cs_test_1' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    const outcome = await createPaymobIntention(
      {
        orderId: 'order_x',
        orderNumber: 'LQ-TEST-1',
        amount: 19.99,
        currency: 'USD',
        method: 'apple_pay',
        buyer: { name: 'Sara Al Harbi', email: 'sara@example.com', phone: null },
        locale: 'en',
      },
      config,
    )
    globalThis.fetch = realFetch
    const request = sent as { url: string; init: RequestInit } | null
    const body = request ? JSON.parse(String(request.init.body)) : {}
    report(
      'intention posts to {base}/v1/intention/',
      request?.url === `${config.baseUrl}/v1/intention/`,
    )
    report(
      'intention authenticates with the secret key',
      (request?.init.headers as Record<string, string>)?.Authorization ===
        `Token ${config.secretKey}`,
    )
    report(
      'amount is in minor units without float drift',
      body.amount === 1999,
      String(body.amount),
    )
    report(
      'only the chosen integration is sent',
      JSON.stringify(body.payment_methods) === `[${APPLE_ID}]`,
    )
    report('order number travels as special_reference', body.special_reference === 'LQ-TEST-1')
    report(
      'notification and return URLs are ours, return in the buyer’s language',
      String(body.notification_url).endsWith('/api/payments/paymob') &&
        String(body.redirection_url).endsWith('/en/checkout/return'),
    )
    report(
      'unknown billing fields are "NA", not invented',
      body.billing_data?.phone_number === 'NA' && body.billing_data?.first_name === 'Sara',
    )
    report(
      'outcome is a redirect to Unified Checkout, never "paid"',
      outcome.status === 'redirect' &&
        outcome.url ===
          `${config.baseUrl}/unifiedcheckout/?publicKey=${config.publicKey}&clientSecret=cs_test_1`,
    )
    const wrongCurrency = await createPaymobIntention(
      { orderId: 'o', orderNumber: 'LQ-TEST-2', amount: 10, currency: 'SAR', method: 'card' },
      config,
    )
    report(
      'an order in another currency is refused, not converted',
      wrongCurrency.status === 'unavailable',
    )

    // ── Order A: settled by the webhook ────────────────────────────────────
    const a = await checkout({
      userId: buyer.id,
      lines: [{ albumId: album.id }],
      billing: { billingEntityType: 'individual' },
      method: 'bank_transfer',
    })
    if (!a.ok) throw new Error(`checkout failed: ${a.messageKey}`)
    orderIds.push(a.orderId)
    cleanupNumbers.push(a.orderNumber)
    const orderA = await db.order.findUniqueOrThrow({ where: { id: a.orderId } })
    const cents = toMinorUnits(Number(orderA.total))

    // Bad signature
    const forged = transaction(a.orderNumber, cents)
    const badSig = await handlePaymobCallback(envelope(forged), 'deadbeef'.repeat(16), config)
    report(
      'forged HMAC is rejected with 401',
      badSig.httpStatus === 401 && badSig.outcome === 'bad_signature',
    )
    const tampered = transaction(a.orderNumber, cents)
    const tamperedSig = signed(tampered)
    tampered.amount_cents = cents + 100
    const tamperedResult = await handlePaymobCallback(envelope(tampered), tamperedSig, config)
    report('a body altered after signing is rejected', tamperedResult.httpStatus === 401)
    const missing = await handlePaymobCallback(envelope(forged), null, config)
    report('a callback with no HMAC is rejected', missing.httpStatus === 401)
    const trace = await db.paymentEvent.count({
      where: { transactionId: { in: [String(forged.id), String(tampered.id)] } },
    })
    report('a rejected callback leaves no row', trace === 0)

    // Amount mismatch
    const short = transaction(a.orderNumber, cents - 1)
    const shortResult = await handlePaymobCallback(envelope(short), signed(short), config)
    report(
      'amount mismatch is recorded as a failure, not a success',
      shortResult.httpStatus === 200 && shortResult.outcome === 'amount_mismatch',
    )
    const wrongCur = transaction(a.orderNumber, cents, { currency: 'EGP' })
    const wrongCurResult = await handlePaymobCallback(envelope(wrongCur), signed(wrongCur), config)
    report(
      'currency mismatch is recorded as a failure',
      wrongCurResult.outcome === 'amount_mismatch',
    )
    const alien = transaction(a.orderNumber, cents, { integration_id: 123 })
    const alienResult = await handlePaymobCallback(envelope(alien), signed(alien), config)
    report(
      'an unknown integration id is not settled',
      alienResult.outcome === 'integration_mismatch',
    )

    // Declined
    const declined = transaction(a.orderNumber, cents, { success: false })
    const declinedResult = await handlePaymobCallback(envelope(declined), signed(declined), config)
    report('a declined transaction is recorded, not settled', declinedResult.outcome === 'declined')

    const stillPending = await db.order.findUniqueOrThrow({ where: { id: a.orderId } })
    const ledgerBefore = await db.creatorLedger.count({
      where: { orderItem: { orderId: a.orderId } },
    })
    report(
      'after every failure the order is still pending with no ledger',
      stillPending.status === 'pending' && ledgerBefore === 0,
      stillPending.status,
    )

    // Success
    const good = transaction(a.orderNumber, cents)
    const goodResult = await handlePaymobCallback(envelope(good), signed(good), config)
    report(
      'a valid signed success settles the order',
      goodResult.outcome === 'settled',
      goodResult.outcome,
    )
    const paidA = await db.order.findUniqueOrThrow({
      where: { id: a.orderId },
      include: { items: true, invoice: true, paymentEvents: true },
    })
    report('order is paid', paidA.status === 'paid' && paidA.paidAt !== null)
    report(
      'gateway reference recorded',
      paidA.gatewayRef === `PAYMOB-${good.id}`,
      paidA.gatewayRef ?? '',
    )
    report('an invoice was issued', paidA.invoice !== null)
    report(
      'source reads as webhook',
      settlementSource(paidA.status, paidA.paymentEvents) === 'webhook',
    )

    // Replay
    const replay = await handlePaymobCallback(envelope(good), signed(good), config)
    const ledgerA = await db.creatorLedger.findMany({
      where: { orderItem: { orderId: a.orderId } },
    })
    report(
      'a replayed callback is acknowledged as a replay',
      replay.httpStatus === 200 && replay.outcome === 'replay',
    )
    report(
      'the replay posted no second ledger row',
      ledgerA.length === paidA.items.length,
      `${ledgerA.length}`,
    )
    const invoicesA = await db.invoice.count({ where: { orderId: a.orderId } })
    report('the replay issued no second invoice', invoicesA === 1)
    const second = transaction(a.orderNumber, cents)
    const secondResult = await handlePaymobCallback(envelope(second), signed(second), config)
    report(
      'a second success for a paid order does not settle again',
      secondResult.outcome === 'already_paid',
    )

    const libraryA = (await getLibrary(buyer.id)).find((row) => row.orderNumber === a.orderNumber)
    const itemA = paidA.items[0]

    // ── Order B: settled by hand, exactly as the admin does ────────────────
    const b = await checkout({
      userId: buyer.id,
      lines: [{ albumId: album.id }],
      billing: { billingEntityType: 'individual' },
      method: 'bank_transfer',
    })
    if (!b.ok) throw new Error(`checkout failed: ${b.messageKey}`)
    orderIds.push(b.orderId)
    cleanupNumbers.push(b.orderNumber)
    await settleOrder(b.orderId, 'MANUAL-verify')
    const paidB = await db.order.findUniqueOrThrow({
      where: { id: b.orderId },
      include: { items: true, paymentEvents: true },
    })
    const itemB = paidB.items[0]
    const ledgerB = await db.creatorLedger.findMany({ where: { orderItemId: itemB.id } })
    const libraryB = (await getLibrary(buyer.id)).find((row) => row.orderNumber === b.orderNumber)

    report(
      'manual order reads as manual',
      settlementSource(paidB.status, paidB.paymentEvents) === 'manual',
    )
    report(
      'same frozen commission either way',
      Number(itemA.commissionRate) === Number(itemB.commissionRate) &&
        Number(itemA.commissionAmount) === Number(itemB.commissionAmount) &&
        Number(itemA.creatorNetAmount) === Number(itemB.creatorNetAmount),
      `${Number(itemA.commissionRate)} / ${Number(itemB.commissionRate)}`,
    )
    report(
      'same ledger credit either way',
      ledgerA.length === 1 &&
        ledgerB.length === 1 &&
        Number(ledgerA[0].amount) === Number(ledgerB[0].amount),
    )
    const holdA = (ledgerA[0]?.availableAt?.getTime() ?? 0) - (paidA.paidAt?.getTime() ?? 0)
    const holdB = (ledgerB[0]?.availableAt?.getTime() ?? 0) - (paidB.paidAt?.getTime() ?? 0)
    report('same payout hold either way', Math.abs(holdA - holdB) < 60_000)
    report(
      'same frozen clip manifest either way',
      JSON.stringify(itemA.clipManifestSnapshot) === JSON.stringify(itemB.clipManifestSnapshot) &&
        (itemA.clipManifestSnapshot as unknown[]).length === album.clips.length,
    )
    report(
      'the library served both as paid, from the snapshot',
      libraryA?.paid === true &&
        libraryB?.paid === true &&
        libraryA.clips.length === album.clips.length &&
        libraryB.clips.length === album.clips.length,
    )
  } finally {
    // ── Clean up ──────────────────────────────────────────────────────────
    const items = await db.orderItem.findMany({
      where: { orderId: { in: orderIds } },
      select: { id: true },
    })
    const itemIds = items.map((item) => item.id)
    await db.paymentEvent.deleteMany({ where: { orderId: { in: orderIds } } })
    await db.creatorLedger.deleteMany({ where: { orderItemId: { in: itemIds } } })
    await db.entitlement.deleteMany({ where: { orderItemId: { in: itemIds } } })
    await db.licenceCertificate.deleteMany({ where: { orderItemId: { in: itemIds } } })
    await db.invoice.deleteMany({ where: { orderId: { in: orderIds } } })
    await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })
    await db.order.deleteMany({ where: { id: { in: orderIds } } })
    for (const orderNumber of cleanupNumbers) {
      await db.mailOutbox.deleteMany({
        where: {
          template: 'order.confirmed',
          payload: { path: ['orderNumber'], equals: orderNumber },
        },
      })
    }
    await db.creator.update({ where: { id: album.creatorId }, data: creatorBefore })
    await db.album.update({ where: { id: album.id }, data: { salesCount: salesBefore } })
    if (cartLineBefore && cart) {
      await db.cartItem.upsert({
        where: { cartId_albumId: { cartId: cart.id, albumId: album.id } },
        update: {},
        create: {
          cartId: cart.id,
          albumId: album.id,
          unitPrice: cartLineBefore.unitPrice,
          vatAmount: cartLineBefore.vatAmount,
        },
      })
    }
  }

  console.log(failures === 0 ? '\nAll payment checks passed.' : `\n${failures} check(s) failed.`)
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
