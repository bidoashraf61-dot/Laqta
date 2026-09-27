/**
 * Payout runs: batching, per-rail export, and paying a run as a whole.
 *
 *   npm run verify:payouts        (DB on :5433)
 *
 * The danger in batching is a second accounting path: a run that pays money
 * the ledger never hears about, pays it twice, or pays an account that was not
 * the one approved. This proves:
 *
 *   - a run takes only approved payouts with a frozen destination, in no run
 *   - each rail's file has exactly its documented columns, and the amounts are
 *     the payout rows' netAmount, summing to the run total
 *   - paying a run posts the same ledger row per payout as the single
 *     mark-paid (−amount, memo = reference, balanceAfter = previous − amount)
 *   - a second submit, sequential or concurrent, posts nothing
 *   - an excluded line returns to the queue as approved, out of the files
 *
 * It creates its own payouts on the seeded creators and removes everything it
 * wrote afterwards. Approved payouts already in the queue are parked for the
 * duration so a run cannot sweep them up, and restored.
 */

import { db } from '@/lib/db'
import {
  buildRunExport,
  createPayoutRun,
  excludeFromRun,
  markPayoutPaid,
  markRunPaid,
  toCents,
} from '@/lib/payouts'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

function csvRows(body: string) {
  return body.split('\r\n').filter(Boolean).map((line) => line.split(','))
}

async function ledgerFor(payoutId: string) {
  return db.creatorLedger.findMany({ where: { payoutId }, orderBy: { createdAt: 'asc' } })
}

async function main() {
  console.log('Payout runs\n')

  const admin = await db.user.findFirstOrThrow({ where: { role: 'admin' }, select: { id: true } })
  const ibanCreator = await db.creator.findFirstOrThrow({
    where: { payoutMethod: 'iban', iban: { not: null } },
    select: { id: true, iban: true, beneficiaryName: true },
  })
  const emailCreator = await db.creator.findFirstOrThrow({
    where: { id: { not: ibanCreator.id } },
    select: { id: true },
  })

  // Park anything already eligible so the run sees only this test's rows.
  const parked = await db.payout.findMany({ where: { status: 'approved', runId: null }, select: { id: true } })
  const parkedIds = parked.map((row) => row.id)
  if (parkedIds.length) await db.payout.updateMany({ where: { id: { in: parkedIds } }, data: { status: 'requested' } })

  const createdPayouts: string[] = []
  const createdRuns: string[] = []
  const make = async (data: {
    creatorId: string
    method: 'iban' | 'payoneer' | 'wise'
    status: 'requested' | 'approved' | 'paid'
    amount: string
    netAmount: string
    destinationSnapshot?: object
  }) => {
    const row = await db.payout.create({
      data: { ...data, currency: 'USD', withholdingAmount: (Number(data.amount) - Number(data.netAmount)).toFixed(2) },
    })
    createdPayouts.push(row.id)
    return row
  }

  try {
    const ibanSnap = { method: 'iban', iban: 'SA03 8000 0000 6080 1016 7519', bankName: 'Test Bank', beneficiary: '=Nada, "Al-Otaibi"' }
    const A = await make({ creatorId: ibanCreator.id, method: 'iban', status: 'approved', amount: '100.00', netAmount: '90.00', destinationSnapshot: ibanSnap })
    const B = await make({ creatorId: emailCreator.id, method: 'wise', status: 'approved', amount: '250.50', netAmount: '250.50', destinationSnapshot: { method: 'wise', email: 'wise.test@example.com', beneficiary: 'Yousef Al-Shami' } })
    const C = await make({ creatorId: emailCreator.id, method: 'payoneer', status: 'approved', amount: '75.25', netAmount: '75.25', destinationSnapshot: { method: 'payoneer', email: 'payoneer.test@example.com', beneficiary: 'Yousef Al-Shami' } })
    const D = await make({ creatorId: emailCreator.id, method: 'wise', status: 'requested', amount: '10.00', netAmount: '10.00' })
    const E = await make({ creatorId: emailCreator.id, method: 'wise', status: 'approved', amount: '11.00', netAmount: '11.00' })
    const F = await make({ creatorId: emailCreator.id, method: 'wise', status: 'paid', amount: '12.00', netAmount: '12.00', destinationSnapshot: { method: 'wise', email: 'x@example.com' } })

    // ── Eligibility ──────────────────────────────────────────────────────
    const run = await createPayoutRun(admin.id)
    if (!run) throw new Error('no run created')
    createdRuns.push(run.id)
    const inRun = await db.payout.findMany({ where: { runId: run.id }, select: { id: true, status: true } })
    const ids = new Set(inRun.map((row) => row.id))
    check('run takes the three approved payouts with a frozen destination', ids.size === 3 && ids.has(A.id) && ids.has(B.id) && ids.has(C.id), `${ids.size}`)
    check('requested, destination-less and paid payouts stay out', !ids.has(D.id) && !ids.has(E.id) && !ids.has(F.id))
    check('batched payouts move to processing', inRun.every((row) => row.status === 'processing'))
    const runRow = await db.payoutRun.findUniqueOrThrow({ where: { id: run.id } })
    check('run total is the sum of netAmount', toCents(runRow.totalAmount) === 9000 + 25050 + 7525 && runRow.payoutCount === 3, `${runRow.totalAmount}`)

    const again = await createPayoutRun(admin.id)
    if (again) createdRuns.push(again.id)
    check('a second run finds nothing left to batch', again === null)

    // ── Files ────────────────────────────────────────────────────────────
    const iban = await buildRunExport(run.id, 'iban')
    const ibanRows = csvRows(iban?.body ?? '')
    check('bank file header', ibanRows[0]?.join(',') === 'beneficiary_name,iban,amount,currency,reference', ibanRows[0]?.join(','))
    const ibanLine = (iban?.body ?? '').split('\r\n')[1] ?? ''
    check(
      'bank line: frozen name (formula stripped, quoted), compact IBAN, net amount',
      ibanLine === `"Nada, ""Al-Otaibi""",SA0380000000608010167519,90.00,USD,LAQTA-${A.id.slice(-10).toUpperCase()}`,
      ibanLine,
    )

    const wise = await buildRunExport(run.id, 'wise')
    const wiseRows = csvRows(wise?.body ?? '')
    check(
      'wise file header is the batch email-recipient template',
      wiseRows[0]?.join(',') === 'name,recipientEmail,paymentReference,receiverType,amountCurrency,amount,sourceCurrency,targetCurrency',
    )
    check(
      'wise line carries name, email, reference, amount, currencies',
      wiseRows[1]?.join(',') === `Yousef Al-Shami,wise.test@example.com,LAQTA-${B.id.slice(-10).toUpperCase()},PRIVATE,target,250.50,USD,USD`,
      wiseRows[1]?.join(','),
    )

    const payoneer = await buildRunExport(run.id, 'payoneer')
    const payoneerRows = csvRows(payoneer?.body ?? '')
    check(
      'payoneer file: no header, email/amount/currency/description',
      payoneerRows.length === 1 && payoneerRows[0].join(',') === `payoneer.test@example.com,75.25,USD,LAQTA-${C.id.slice(-10).toUpperCase()}`,
      payoneerRows[0]?.join(','),
    )
    const fileCents = (iban?.totalCents ?? 0) + (wise?.totalCents ?? 0) + (payoneer?.totalCents ?? 0)
    check('the three files sum to the run total', fileCents === toCents(runRow.totalAmount), `${fileCents}`)
    const allText = [iban, wise, payoneer].map((file) => file?.body ?? '').join('')
    check(
      'files carry nothing beyond the rail (no gross, no creator id, no bank name)',
      !allText.includes('100.00') && !allText.includes(ibanCreator.id) && !allText.includes('Test Bank'),
    )

    // ── Single mark-paid refuses a line that belongs to a run ────────────
    check('single mark-paid refuses a payout inside a run', (await markPayoutPaid(A.id, 'SOLO')) === false)
    check('…and posts no ledger row for it', (await ledgerFor(A.id)).length === 0)

    // ── Exclude ──────────────────────────────────────────────────────────
    const excluded = await excludeFromRun(run.id, C.id, 'IBAN bounced')
    const cAfter = await db.payout.findUniqueOrThrow({ where: { id: C.id } })
    check('excluded line returns to the queue as approved, in no run', excluded.ok && cAfter.status === 'approved' && cAfter.runId === null)
    check('excluded line keeps its frozen destination and the reason', cAfter.destinationSnapshot !== null && cAfter.failureReason === 'IBAN bounced')
    const runAfterExclude = await db.payoutRun.findUniqueOrThrow({ where: { id: run.id } })
    check('run total and count drop by the excluded line', runAfterExclude.payoutCount === 2 && toCents(runAfterExclude.totalAmount) === 9000 + 25050)
    check('excluded line leaves the payoneer file', (await buildRunExport(run.id, 'payoneer'))?.rows === 0)

    // ── The reference ledger row: single mark-paid on a standalone payout ─
    const G = await make({ creatorId: ibanCreator.id, method: 'iban', status: 'approved', amount: '40.00', netAmount: '36.00', destinationSnapshot: ibanSnap })
    // G is created after the run, so it is standalone.
    const beforeG = await db.creatorLedger.findFirst({ where: { creatorId: ibanCreator.id }, orderBy: { createdAt: 'desc' } })
    check('single mark-paid pays a standalone approved payout', (await markPayoutPaid(G.id, 'SOLO-REF')) === true)
    const gLedger = await ledgerFor(G.id)
    const single = gLedger[0]
    check(
      'single mark-paid posts one payout row of −amount',
      gLedger.length === 1 && single.entryType === 'payout' && toCents(single.amount) === -4000 && single.memo === 'SOLO-REF',
    )
    check(
      'single mark-paid balanceAfter = previous − amount',
      toCents(single.balanceAfter) === toCents(beforeG?.balanceAfter ?? 0) - 4000,
    )
    check('single mark-paid twice is a no-op', (await markPayoutPaid(G.id, 'SOLO-REF')) === false && (await ledgerFor(G.id)).length === 1)
    // DEV-30: «حوّلنا أرباحك», once per payout, with the net amount.
    const paidMail = await db.mailOutbox.findMany({ where: { template: 'payout.paid', payload: { path: ['payoutId'], equals: G.id } } })
    check('paying a payout queues one «حوّلنا أرباحك» email', paidMail.length === 1, String(paidMail.length))
    await db.mailOutbox.deleteMany({ where: { id: { in: paidMail.map((row) => row.id) } } })

    // ── Pay the run ──────────────────────────────────────────────────────
    const beforeA = await db.creatorLedger.findFirst({ where: { creatorId: ibanCreator.id }, orderBy: { createdAt: 'desc' } })
    const beforeB = await db.creatorLedger.findFirst({ where: { creatorId: emailCreator.id }, orderBy: { createdAt: 'desc' } })
    const refused = await markRunPaid(run.id, '   ', admin.id)
    check('a run cannot be paid without a reference', !refused.ok)

    const paid = await markRunPaid(run.id, 'BATCH-2026-09-24', admin.id)
    check('mark-run-paid pays both remaining lines', paid.ok && !paid.alreadyPaid && paid.paid === 2, JSON.stringify(paid))
    const aLedger = await ledgerFor(A.id)
    const bLedger = await ledgerFor(B.id)
    const same = (row: (typeof aLedger)[number] | undefined, amountCents: number, before: typeof beforeA) =>
      !!row &&
      row.entryType === single.entryType &&
      toCents(row.amount) === -amountCents &&
      row.memo === 'BATCH-2026-09-24' &&
      row.currency === single.currency &&
      toCents(row.balanceAfter) === toCents(before?.balanceAfter ?? 0) - amountCents
    check('run posts the same ledger row as single mark-paid (A: −gross, not net)', aLedger.length === 1 && same(aLedger[0], 10000, beforeA))
    check('run posts the same ledger row as single mark-paid (B)', bLedger.length === 1 && same(bLedger[0], 25050, beforeB))
    const aRow = await db.payout.findUniqueOrThrow({ where: { id: A.id } })
    check('paid lines carry the run reference and a paidAt', aRow.status === 'paid' && aRow.reference === 'BATCH-2026-09-24' && !!aRow.paidAt)
    const closed = await db.payoutRun.findUniqueOrThrow({ where: { id: run.id } })
    check('run is closed as paid with reference and payer', closed.status === 'paid' && closed.reference === 'BATCH-2026-09-24' && closed.paidById === admin.id)

    const twice = await markRunPaid(run.id, 'BATCH-2026-09-24', admin.id)
    check('second submit is a no-op', twice.ok && twice.alreadyPaid === true)
    check('…and posts no ledger rows', (await ledgerFor(A.id)).length === 1 && (await ledgerFor(B.id)).length === 1)
    check('a paid run refuses exclusion', !(await excludeFromRun(run.id, A.id, 'late')).ok)

    // ── Concurrent double submit ─────────────────────────────────────────
    const run2 = await createPayoutRun(admin.id)
    if (run2) createdRuns.push(run2.id)
    check('the excluded line is picked up by the next run', !!run2 && run2.count === 1)
    if (run2) {
      const results = await Promise.allSettled([
        markRunPaid(run2.id, 'BATCH-2', admin.id),
        markRunPaid(run2.id, 'BATCH-2', admin.id),
      ])
      const cLedger = await ledgerFor(C.id)
      check('two concurrent submits post exactly one ledger row', cLedger.length === 1, `${cLedger.length} rows, ${results.map((r) => r.status).join('/')}`)
    }
  } finally {
    await db.creatorLedger.deleteMany({ where: { payoutId: { in: createdPayouts } } })
    await db.payout.deleteMany({ where: { id: { in: createdPayouts } } })
    await db.payoutRun.deleteMany({ where: { id: { in: createdRuns } } })
    if (parkedIds.length) await db.payout.updateMany({ where: { id: { in: parkedIds } }, data: { status: 'approved' } })
  }

  console.log(failures === 0 ? '\nAll payout-run checks passed.' : `\n${failures} check(s) failed.`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
