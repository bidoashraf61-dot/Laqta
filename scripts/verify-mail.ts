#!/usr/bin/env node
/**
 * The mail rail.
 *
 * Mail is the one surface with no page to look at. A broken template does not
 * throw a 500 anyone sees — it produces a message that is wrong, or Arabic for
 * an English reader, in an inbox nobody on the team owns. So the checks that
 * would otherwise be "open it and look" have to be a gate.
 *
 * Four parts:
 *   1. Templates — pure functions of (locale, payload), rendered in-process in
 *      both languages, HTML and text. No browser, no server.
 *   2. Copy rules — no refund copy, no filmed-on-location claims (the catalogue
 *      is AI-generated), no first/largest claims. Owner decisions, enforced.
 *   3. The Resend adapter — `fetch` is intercepted, so the request shape is
 *      checked without a network or a key.
 *   4. Idempotency against the database — a receipt is queued once however
 *      many times the order is settled, and so is a transfer notice.
 *
 * This gate never sends real mail: the provider variables are blanked before
 * anything can drain, and every fixture address is on the reserved `.test` TLD.
 */

// Blank, not delete: Prisma loads .env lazily and dotenv never overrides a key
// that already exists, even an empty one. A deployment's real Resend key in
// .env must not turn this gate's fixtures into real messages.
const REAL_ENV = {
  MAIL_PROVIDER: process.env.MAIL_PROVIDER,
  MAIL_API_KEY: process.env.MAIL_API_KEY,
  MAIL_FROM: process.env.MAIL_FROM,
  MAIL_REPLY_TO: process.env.MAIL_REPLY_TO,
}
for (const key of Object.keys(REAL_ENV)) process.env[key] = ''

import { readFileSync } from 'node:fs'
import { TEMPLATES, renderTemplate } from '../emails/registry'
import { sendMail, RESEND_ENDPOINT } from '../lib/mail'
import type { Locale } from '../lib/locale'
import { SAMPLE_PAYLOAD as PAYLOAD } from '../emails/sample-payload'
import { MAIL_BANS, SITE_BANS } from '../lib/copy-claims'
import { SiteOriginMissingError, siteOrigin } from '../lib/site'

const ar = JSON.parse(readFileSync('messages/ar.json', 'utf8'))
const en = JSON.parse(readFileSync('messages/en.json', 'utf8'))

let failures = 0
const fail = (message: string) => {
  console.error(`  FAIL  ${message}`)
  failures++
}
const pass = (message: string) => console.log(`  pass  ${message}`)


const ARABIC = /[؀-ۿ]/
const LATIN_WORD = /\b[A-Za-z]{4,}\b/
const GOLD = /#7A6127/gi

/**
 * Banned copy. Checked against every rendered message and every `email.*`
 * value in both dictionaries, so a key added later is covered too.
 */
const BANNED: Array<{ rule: string; pattern: RegExp }> = [
  // Owner decision: refunds are never mentioned, in any language.
  { rule: 'refund copy', pattern: SITE_BANS[0][0] },
  // Shared with the copy editor (lib/copy-claims.ts), which refuses the same
  // wording when the owner publishes an email edit (DEV-64b).
  ...MAIL_BANS.map(([pattern, rule]) => ({ rule, pattern })),
  { rule: 'first/largest claim', pattern: SITE_BANS[1][0] },
]

/* ───────────────────────── 1. Templates ───────────────────────── */

console.log('\nEvery template renders, in both languages, HTML and text')

for (const template of TEMPLATES) {
  let ok = true
  for (const locale of ['ar', 'en'] as Locale[]) {
    let rendered
    try {
      rendered = renderTemplate(template, locale, PAYLOAD)
    } catch (error) {
      fail(`${template} [${locale}] threw: ${(error as Error).message}`)
      ok = false
      continue
    }

    const before = failures
    if (!rendered.subject?.trim()) fail(`${template} [${locale}] has an empty subject`)
    if (!rendered.text?.trim()) fail(`${template} [${locale}] has an empty text part`)
    if (!rendered.html?.trim()) fail(`${template} [${locale}] has an empty HTML part`)

    const text = `${rendered.subject}\n${rendered.text}`

    // An unresolved placeholder is the classic template bug: it ships looking
    // like a typo rather than failing.
    const leftover = `${text}\n${rendered.html}`.match(/\{[a-zA-Z]+\}/g)
    if (leftover) fail(`${template} [${locale}] left ${leftover.join(', ')} unresolved`)

    // A missing key falls back to the key path, which reads as gibberish.
    if (/\b(email|brand|dash)\.[a-zA-Z]+\b/.test(text.replace(/\S+@\S+/g, ''))) {
      fail(`${template} [${locale}] rendered a dot-path — a key is missing`)
    }

    // Direction and language are declared, or Gmail lays Arabic out LTR.
    const dir = locale === 'ar' ? 'rtl' : 'ltr'
    if (!rendered.html.includes(`<html lang="${locale}" dir="${dir}">`)) {
      fail(`${template} [${locale}] HTML does not declare lang="${locale}" dir="${dir}"`)
    }

    // Untrusted input is escaped, and nothing executable reaches an inbox.
    if (/<script/i.test(rendered.html)) fail(`${template} [${locale}] HTML contains a raw <script>`)

    // One Voice: gold appears at most once — the single primary action.
    const gold = rendered.html.match(GOLD)?.length ?? 0
    if (gold > 1) fail(`${template} [${locale}] uses gold ${gold} times (One Voice Rule: at most once)`)

    if (locale === 'ar' && !ARABIC.test(text)) fail(`${template} [ar] contains no Arabic`)
    if (locale === 'en') {
      // URLs, addresses and the payload's Latin values are legitimate; the
      // template's own prose must be English.
      const prose = text.replace(/https?:\/\/\S+/g, '').replace(/[•—\-]/g, '')
      if (ARABIC.test(prose)) fail(`${template} [en] leaked Arabic into an English message`)
      if (!LATIN_WORD.test(prose)) fail(`${template} [en] contains no English`)
    }

    for (const { rule, pattern } of BANNED) {
      if (pattern.test(text)) fail(`${template} [${locale}] contains ${rule}: ${text.match(pattern)?.[0]}`)
    }
    if (failures > before) ok = false
  }
  if (ok) pass(template)
}

// The contact message's Reply-To is the visitor, so answering is one click.
{
  const rendered = renderTemplate('contact.message', 'ar', PAYLOAD)
  if (rendered.replyTo !== PAYLOAD.email) fail('contact.message does not reply to the visitor')
  else pass('contact.message replies to the visitor')
  if (!rendered.html.includes('&lt;script&gt;')) fail('contact.message did not escape the visitor’s markup')
  else pass('untrusted contact text is escaped in HTML')
}

// Rows queued before the HTML templates carried one pre-bulleted string.
{
  const legacy = renderTemplate('order.confirmed', 'en', {
    name: 'A',
    orderNumber: 'LQ-1',
    albums: '• AlUla Aerials\n• Riyadh Nights',
    libraryUrl: 'https://laqta.sa/account/library',
  })
  if (!legacy.text.includes('• Riyadh Nights') || legacy.text.includes('• •')) {
    fail('order.confirmed does not render a legacy queued row')
  } else pass('order.confirmed still renders rows queued in the old shape')
}

console.log('\nCopy rules hold across every email string')

for (const [name, dict] of [
  ['ar', ar],
  ['en', en],
] as const) {
  const values = Object.values(dict.email ?? {}) as string[]
  let clean = true
  for (const value of values) {
    for (const { rule, pattern } of BANNED) {
      if (pattern.test(value)) {
        fail(`messages/${name}.json email.* contains ${rule}: "${value.match(pattern)?.[0]}"`)
        clean = false
      }
    }
  }
  if (clean) pass(`${values.length} ${name} strings: no refund, filmed or first/largest copy`)
}

console.log('\nCopy lives in messages/*.json, not in the template')

for (const file of ['emails/registry.ts', 'emails/layout.ts', 'lib/notifications.ts', 'lib/password-reset.ts']) {
  const source = readFileSync(file, 'utf8')
  // A quoted Arabic string means a sentence was written inline, which puts it
  // beyond verify:arabic and every editorial pass.
  if (/['"`][^'"`\n]*[؀-ۿ]/.test(source)) fail(`${file} contains an inline Arabic string`)
  else pass(`${file}: no sentence is hard-coded`)
}

console.log('\nBoth dictionaries carry the same email keys')

const arKeys = Object.keys(ar.email ?? {}).sort()
const enKeys = Object.keys(en.email ?? {}).sort()
if (!arKeys.length) fail('messages/ar.json has no email section')
const missingEn = arKeys.filter((key) => !enKeys.includes(key))
const missingAr = enKeys.filter((key) => !arKeys.includes(key))
if (missingEn.length) fail(`missing from en.json: ${missingEn.join(', ')}`)
if (missingAr.length) fail(`missing from ar.json: ${missingAr.join(', ')}`)
if (!missingEn.length && !missingAr.length) pass(`${arKeys.length} keys, both languages`)

console.log('\nEvery link has one origin, and production refuses to guess it (DEV-40)')
{
  const env = (vars: Record<string, string>) => ({ NODE_ENV: 'development', ...vars }) as unknown as NodeJS.ProcessEnv
  const check = (ok: boolean, message: string) => (ok ? pass(message) : fail(message))
  check(siteOrigin(env({ SITE_ORIGIN: 'https://laqta.sa/' })) === 'https://laqta.sa', 'SITE_ORIGIN is used, trailing slash dropped')
  check(siteOrigin(env({ AUTH_URL: 'https://laqta.sa' })) === 'https://laqta.sa', 'AUTH_URL alone is enough')
  check(
    siteOrigin(env({ SITE_ORIGIN: 'https://laqta.sa', AUTH_URL: 'https://auth.example.test' })) === 'https://laqta.sa',
    'SITE_ORIGIN wins over AUTH_URL (and the mismatch is warned about)',
  )
  check(siteOrigin(env({})) === 'http://localhost:3000', 'development without either falls back to localhost')
  let threw: unknown = null
  try {
    siteOrigin({ NODE_ENV: 'production' } as unknown as NodeJS.ProcessEnv)
  } catch (error) {
    threw = error
  }
  check(threw instanceof SiteOriginMissingError, 'production without SITE_ORIGIN or AUTH_URL throws instead of linking to localhost')
  check(siteOrigin(env({ SITE_ORIGIN: '  ' , AUTH_URL: 'https://laqta.sa' })) === 'https://laqta.sa', 'a blank SITE_ORIGIN counts as unset')
}

console.log('\nEvery template a caller enqueues actually exists')

const callers = ['lib/orders.ts', 'lib/admin.ts', 'lib/studio.ts', 'lib/notifications.ts', 'lib/password-reset.ts']
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')
/*
 * Only `template:` assignments and the template names the notifications
 * module chooses between. An earlier version matched any dotted string and
 * flagged `action: 'order.refund'` — an audit action, not a message. A gate
 * that cries wolf gets switched off.
 */
let named = 0
for (const match of callers.matchAll(/template(?::|\s*=)\s*([^\n]+(?:\n\s+[?:][^\n]+)*)/g)) {
  for (const quoted of match[1].matchAll(/'([a-z]+\.[a-zA-Z]+)'/g)) {
    named++
    if (!(TEMPLATES as readonly string[]).includes(quoted[1])) {
      fail(`a caller enqueues unknown template '${quoted[1]}'`)
    }
  }
}
if (!named) fail('no caller enqueues anything — the rail is not wired')
else pass(`${named} template reference(s) at enqueue sites, all real`)

/* ───────────────────────── 3. Resend adapter ───────────────────────── */

async function adapter() {
  console.log('\nThe Resend adapter sends the request Resend documents')

  const realFetch = globalThis.fetch
  const calls: Array<{ url: string; init: RequestInit }> = []
  let respond = () => new Response(JSON.stringify({ id: 'email_123' }), { status: 200 })
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return respond()
  }) as typeof fetch

  try {
    // Unconfigured: the honest local driver, and no request at all.
    const quiet = await sendMail('buyer@example.test', 'S', 'T')
    if (quiet !== false || calls.length) fail('unconfigured sendMail did not fall back to the local driver')
    else pass('without MAIL_* set, nothing is requested and delivery reports false')

    process.env.MAIL_PROVIDER = 'resend'
    process.env.MAIL_API_KEY = 're_test_key'
    process.env.MAIL_FROM = 'لقطة <orders@laqta.test>'
    process.env.MAIL_REPLY_TO = 'hello@laqta.test'

    const delivered = await sendMail(
      'buyer@example.test',
      'Subject',
      'Text part',
      [{ filename: 'LIC-1.pdf', content: Buffer.from('%PDF-1.4 test') }],
      { html: '<p>HTML part</p>', idempotencyKey: 'outbox:abc' },
    )
    const call = calls[0]
    const headers = (call?.init.headers ?? {}) as Record<string, string>
    const body = call ? JSON.parse(String(call.init.body)) : {}

    const checks: Array<[string, boolean]> = [
      ['returns true on 2xx', delivered === true],
      ['POSTs to https://api.resend.com/emails', call?.url === RESEND_ENDPOINT && call?.init.method === 'POST'],
      ['authorises with the key as a Bearer token', headers.Authorization === 'Bearer re_test_key'],
      ['sends JSON', headers['Content-Type'] === 'application/json'],
      ['passes the Idempotency-Key', headers['Idempotency-Key'] === 'outbox:abc'],
      ['from is MAIL_FROM, verbatim', body.from === 'لقطة <orders@laqta.test>'],
      ['to is an array', Array.isArray(body.to) && body.to[0] === 'buyer@example.test'],
      ['carries subject, text and html', body.subject === 'Subject' && body.text === 'Text part' && body.html === '<p>HTML part</p>'],
      ['reply_to defaults to MAIL_REPLY_TO', body.reply_to === 'hello@laqta.test'],
      [
        'attachments are base64 with a filename',
        body.attachments?.[0]?.filename === 'LIC-1.pdf' &&
          Buffer.from(body.attachments[0].content, 'base64').toString() === '%PDF-1.4 test',
      ],
    ]
    for (const [name, ok] of checks) (ok ? pass : fail)(name)

    // A per-message Reply-To (the contact form) wins over the default.
    calls.length = 0
    await sendMail('op@example.test', 'S', 'T', [], { replyTo: 'visitor@example.test' })
    const replyBody = JSON.parse(String(calls[0]?.init.body ?? '{}'))
    if (replyBody.reply_to !== 'visitor@example.test') fail('per-message replyTo does not override MAIL_REPLY_TO')
    else pass('per-message replyTo overrides MAIL_REPLY_TO')
    if ('attachments' in replyBody) fail('an empty attachment list is still sent')

    // A rejection throws with the status, so the outbox can record and park it.
    respond = () =>
      new Response(JSON.stringify({ name: 'validation_error', message: 'Invalid `to` field.' }), { status: 422 })
    try {
      await sendMail('bad', 'S', 'T')
      fail('a 422 from Resend did not throw')
    } catch (error) {
      const message = (error as Error).message
      if (!/^resend 422: validation_error: Invalid `to` field\./.test(message)) fail(`unexpected error text: ${message}`)
      else pass('a Resend rejection throws with its status and reason')
    }

    // Never hard-code a key.
    const source = readFileSync('lib/mail.ts', 'utf8')
    if (/re_[A-Za-z0-9]{8,}/.test(source)) fail('lib/mail.ts contains something that looks like a Resend key')
    else pass('no key in source')
  } finally {
    globalThis.fetch = realFetch
    // Blank again BEFORE anything below can queue and drain.
    for (const key of Object.keys(REAL_ENV)) process.env[key] = ''
  }
}

/* ───────────────────────── 4. Idempotency ───────────────────────── */

async function idempotency() {
  console.log('\nA receipt is queued once, however many times an order is settled')

  const { db } = await import('../lib/db')
  const { settleOrder } = await import('../lib/orders')
  const { notifyOrderPaid, notifyOrderPlaced, notifyContactMessage } = await import('../lib/notifications')

  const stamp = Date.now()
  const email = `verify-mail-${stamp}@laqta.test`
  const operator = `operator-${stamp}@laqta.test`
  process.env.MAIL_OPERATOR_TO = operator

  const user = await db.user.create({ data: { email, name: 'Verify Mail', locale: 'en' } })
  const orders: string[] = []

  try {
    const make = async (suffix: string) => {
      const order = await db.order.create({
        data: {
          orderNumber: `LQ-VERIFY-${stamp}-${suffix}`,
          userId: user.id,
          status: 'pending',
          subtotal: 100,
          vatRate: 0.15,
          vatAmount: 15,
          total: 115,
          paymentMethod: 'bank_transfer',
          gatewayRef: `BT-LQ-VERIFY-${stamp}-${suffix}`,
        },
      })
      orders.push(order.id)
      return order
    }

    const rows = (template: string, orderNumber: string) =>
      db.mailOutbox.count({ where: { template, payload: { path: ['orderNumber'], equals: orderNumber } } })

    // The transfer notice.
    const placed = await make('A')
    await notifyOrderPlaced(placed.id)
    await notifyOrderPlaced(placed.id)
    const placedRows = await rows('order.placed', placed.orderNumber)
    if (placedRows !== 1) fail(`notifyOrderPlaced twice queued ${placedRows} rows, expected 1`)
    else pass('notifyOrderPlaced twice → one transfer notice')
    const placedRow = await db.mailOutbox.findFirst({ where: { template: 'order.placed', toEmail: email } })
    if (placedRow?.locale !== 'en') fail(`transfer notice locale is ${placedRow?.locale}, expected the buyer's en`)
    else pass("the notice is frozen in the buyer's stored language")

    // Two settlements racing — an operator's double click, a retried webhook.
    const raced = await make('B')
    await Promise.all([settleOrder(raced.id, 'TEST-1'), settleOrder(raced.id, 'TEST-2')])
    const receipts = await rows('order.confirmed', raced.orderNumber)
    const invoices = await db.invoice.count({ where: { orderId: raced.id } })
    if (receipts !== 1) fail(`two concurrent settleOrder calls queued ${receipts} receipts, expected 1`)
    else pass('two concurrent settleOrder calls → one receipt')
    if (invoices !== 1) fail(`two concurrent settleOrder calls issued ${invoices} invoices, expected 1`)
    else pass('…and one invoice: the settlement itself ran once')

    // Called again afterwards, as a webhook would.
    const first = await db.mailOutbox.findFirst({
      where: { template: 'order.confirmed', payload: { path: ['orderNumber'], equals: raced.orderNumber } },
      select: { id: true },
    })
    const again = await notifyOrderPaid(raced.id)
    if (again !== first?.id || (await rows('order.confirmed', raced.orderNumber)) !== 1) {
      fail('notifyOrderPaid after settlement queued a second receipt')
    } else pass('notifyOrderPaid after settlement returns the existing receipt')

    // Never for an unpaid order.
    const unpaid = await make('C')
    if ((await notifyOrderPaid(unpaid.id)) !== null || (await rows('order.confirmed', unpaid.orderNumber))) {
      fail('notifyOrderPaid queued a receipt for an unpaid order')
    } else pass('no receipt for an order that is not paid')

    // The contact form's signature, as the form calls it.
    await notifyContactMessage({
      name: 'Visitor',
      email: 'visitor@example.test',
      subject: 'Hello',
      message: 'A question about licensing.',
      locale: 'en',
    })
    const contact = await db.mailOutbox.findFirst({ where: { template: 'contact.message', toEmail: operator } })
    if (!contact) fail('notifyContactMessage queued nothing for MAIL_OPERATOR_TO')
    else pass('notifyContactMessage queues one message to MAIL_OPERATOR_TO')

    // ── DEV-30 / DEV-57 ──────────────────────────────────────────────────
    const { notifyContactReceived, notifyPaymentStatus } = await import('../lib/notifications')
    const { sendTransferReminders, sendOperatorDigest } = await import('../lib/jobs')

    await notifyContactReceived({ name: 'Visitor', email, message: 'Hi', locale: 'en' })
    const ack = await db.mailOutbox.findFirst({ where: { template: 'contact.received', toEmail: email } })
    if (ack?.locale !== 'en') fail('the contact acknowledgement was not queued in the sender\'s language')
    else pass('the sender gets an acknowledgement, in their language')

    const card = await make('D')
    await notifyPaymentStatus(card.id, 'failed')
    await notifyPaymentStatus(card.id, 'failed')
    if ((await rows('order.paymentFailed', card.orderNumber)) !== 1) fail('a declined card did not queue exactly one email')
    else pass('a declined card → one «ما تمّ الدفع» email, however often the gateway says so')

    const stale = await make('E')
    await db.order.update({ where: { id: stale.id }, data: { createdAt: new Date(Date.now() - 4 * 86_400_000) } })
    await sendTransferReminders()
    await sendTransferReminders()
    if ((await rows('order.transferReminder', stale.orderNumber)) !== 1) fail('the transfer reminder was not queued exactly once')
    else pass('a bank transfer unpaid after three days gets one reminder, however often the job runs')
    if ((await rows('order.transferReminder', placed.orderNumber)) !== 0) fail('a fresh order was reminded')
    else pass('…and a fresh one gets none')

    const day = new Date('2099-01-01T05:00:00Z')
    await sendOperatorDigest(day)
    await sendOperatorDigest(day)
    const digests = await db.mailOutbox.count({ where: { template: 'operator.digest', toEmail: operator } })
    if (digests !== 1) fail(`the digest ran twice on one day and queued ${digests}`)
    else pass('the operator digest is queued once a day, to MAIL_OPERATOR_TO')

    // ── DEV-45: the waitlist ─────────────────────────────────────────────
    const waitlist = await import('../lib/waitlist')
    const wl = `verify-wl-${stamp}@laqta.test`
    const wlOut = `verify-wl-out-${stamp}@laqta.test`
    try {
      await waitlist.joinWaitlist({ email: wl.toUpperCase(), locale: 'en', source: 'landing' })
      await waitlist.joinWaitlist({ email: wl, locale: 'en', source: 'sample' })
      const rowsFor = await db.waitlistEntry.findMany({ where: { email: wl } })
      if (rowsFor.length !== 1 || rowsFor[0].locale !== 'en' || rowsFor[0].consentText !== waitlist.WAITLIST_CONSENT_VERSION) {
        fail('joining the waitlist twice did not leave one row with its language and consent')
      } else pass('joining twice → one waitlist row, with language and the consent version')

      await waitlist.joinWaitlist({ email: wlOut, locale: 'ar', source: 'landing' })
      const out = await db.waitlistEntry.findUniqueOrThrow({ where: { email: wlOut } })
      await waitlist.unsubscribeByToken(out.unsubscribeToken)
      const gone = await db.waitlistEntry.findUniqueOrThrow({ where: { email: wlOut } })
      if (!gone.unsubscribedAt) fail('the unsubscribe token did not unsubscribe')
      else pass('the unsubscribe link takes the address off the list (kept, marked)')

      await waitlist.notifyWaitlistOfLaunch()
      await waitlist.notifyWaitlistOfLaunch()
      const notices = await db.mailOutbox.count({ where: { template: 'launch.notice', toEmail: wl } })
      const leaked = await db.mailOutbox.count({ where: { template: 'launch.notice', toEmail: wlOut } })
      const notice = await db.mailOutbox.findFirst({ where: { template: 'launch.notice', toEmail: wl } })
      if (notices !== 1 || leaked !== 0) fail(`launch notice: ${notices} to the member, ${leaked} to the unsubscribed`)
      else pass('the launch notice goes once to each member, never to someone who left')
      if (notice?.locale !== 'en' || !String((notice?.payload as { unsubscribeUrl?: string })?.unsubscribeUrl).includes('/en/waitlist/unsubscribe?token=')) {
        fail('the launch notice is not in the member\'s language with their unsubscribe link')
      } else pass('…in their language, carrying their unsubscribe link')

      const csv = await waitlist.waitlistCsv()
      if (!csv.startsWith('email,language,source') || !csv.includes(wl)) fail('the CSV export is missing its header or a member')
      else pass('the CSV export lists the members')
    } finally {
      await db.mailOutbox.deleteMany({ where: { toEmail: { in: [wl, wlOut] } } })
      await db.waitlistEntry.deleteMany({ where: { email: { in: [wl, wlOut] } } })
    }
  } finally {
    await db.mailOutbox.deleteMany({ where: { toEmail: { in: [email, operator] } } })
    await db.invoice.deleteMany({ where: { orderId: { in: orders } } })
    await db.order.deleteMany({ where: { id: { in: orders } } })
    await db.user.delete({ where: { id: user.id } })
    await db.$disconnect()
  }
}

async function main() {
  await adapter()
  try {
    await idempotency()
  } catch (error) {
    fail(`idempotency checks could not run (is the database up? npm run db:start): ${(error as Error).message}`)
  }

  if (failures) {
    console.error(`\n${failures} mail check(s) failed.\n`)
    process.exit(1)
  }
  console.log('\nEvery message renders in both languages, the adapter speaks Resend, and nothing sends twice.\n')
  process.exit(0)
}

void main()
