import { notifyPayoutPaid } from '@/lib/notifications'
import { Prisma, type PayoutMethod } from '@prisma/client'
import { db } from '@/lib/db'

/**
 * Payout posting, batching and export.
 *
 * ── The state machine ───────────────────────────────────────────────────────
 *
 *   requested ──approve──▶ approved ──(run)──▶ processing ──run paid──▶ paid
 *                             │  ▲                  │
 *                             │  └────exclude───────┘
 *                             └──────single mark-paid──────────────▶ paid
 *
 * - `requested` is never batched: its destination is not frozen until an
 *   admin approves it, and an export must pay the approved account.
 * - A run takes every `approved` payout that is in no run and has a frozen
 *   `destinationSnapshot`, and moves it to `processing` under the run.
 * - `processing` inside a draft run belongs to the run. The per-payout
 *   mark-paid refuses it, so the files a bank already received can never
 *   disagree with the ledger.
 * - Excluding a line (the bank bounced it, the IBAN was wrong) moves it back to
 *   `approved` with no run — it is in the queue again, destination unchanged.
 *
 * ── One accounting path ─────────────────────────────────────────────────────
 * `postPayoutPaid` is the ONLY code that turns a payout into money that left:
 * the per-payout action and the whole-run action both call it inside their own
 * transaction. It posts exactly one `payout` ledger row of −amount, and it is a
 * no-op on a payout that is already paid, so a double submit posts nothing.
 *
 * Amounts are read from the payout rows. Nothing here looks at a sale.
 */

type Tx = Prisma.TransactionClient

export const RAILS = ['iban', 'payoneer', 'wise'] as const satisfies readonly PayoutMethod[]
export type Rail = (typeof RAILS)[number]

export function isRail(value: string): value is Rail {
  return (RAILS as readonly string[]).includes(value)
}

// ── Posting ──────────────────────────────────────────────────────────────────

/**
 * Mark one payout paid and post its ledger row. Must run inside a transaction.
 *
 * The status flip is a guarded `updateMany`: it only matches a payout that is
 * still payable (and, for a run, still in that run), and the row lock it takes
 * makes a concurrent second submit match nothing. Returns false when nothing
 * was paid — the caller treats that as a no-op, never as a reason to post.
 */
export async function postPayoutPaid(
  tx: Tx,
  payoutId: string,
  reference: string | null,
  scope: { runId: string } | { runId: null },
): Promise<boolean> {
  const flipped = await tx.payout.updateMany({
    where:
      scope.runId === null
        ? { id: payoutId, runId: null, status: { in: ['approved', 'processing'] } }
        : { id: payoutId, runId: scope.runId, status: 'processing' },
    data: { status: 'paid', paidAt: new Date(), reference: reference || null },
  })
  if (flipped.count === 0) return false

  const payout = await tx.payout.findUniqueOrThrow({
    where: { id: payoutId },
    select: { creatorId: true, amount: true },
  })

  const previous = await tx.creatorLedger.findFirst({
    where: { creatorId: payout.creatorId },
    orderBy: { createdAt: 'desc' },
    select: { balanceAfter: true },
  })

  await tx.creatorLedger.create({
    data: {
      creatorId: payout.creatorId,
      entryType: 'payout',
      amount: -Number(payout.amount),
      balanceAfter: Number(previous?.balanceAfter ?? 0) - Number(payout.amount),
      payoutId,
      memo: reference || null,
    },
  })
  // «حوّلنا أرباحك» (DEV-30) — queued with the ledger row, both paths.
  await notifyPayoutPaid(payoutId, tx)
  return true
}

/** The per-payout path: one payout that is in no run. */
export async function markPayoutPaid(payoutId: string, reference: string) {
  return db.$transaction((tx) => postPayoutPaid(tx, payoutId, reference, { runId: null }))
}

// ── Runs ─────────────────────────────────────────────────────────────────────

/** What a run may take: approved, destination frozen, in no run. */
export const RUN_ELIGIBLE: Prisma.PayoutWhereInput = {
  status: 'approved',
  runId: null,
  NOT: { destinationSnapshot: { equals: Prisma.AnyNull } },
}

function runLabel(now: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `PR-${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
}

/** Totals come from the rows actually in the run, summed as decimals. */
async function refreshRunTotals(tx: Tx, runId: string) {
  const rows = await tx.payout.findMany({ where: { runId }, select: { netAmount: true } })
  const cents = rows.reduce((sum, row) => sum + toCents(row.netAmount), 0)
  await tx.payoutRun.update({
    where: { id: runId },
    data: { payoutCount: rows.length, totalAmount: fromCents(cents) },
  })
  return rows.length
}

/**
 * Batch every eligible payout into a new draft run. Returns null when there is
 * nothing to batch. Two admins pressing at once cannot share a payout: the
 * claim is a guarded `updateMany` on `runId: null`.
 */
export async function createPayoutRun(adminId: string) {
  return db.$transaction(async (tx) => {
    const eligible = await tx.payout.findMany({
      where: RUN_ELIGIBLE,
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    if (eligible.length === 0) return null

    const now = new Date()
    const run = await tx.payoutRun.create({
      data: {
        label: runLabel(now),
        status: 'draft',
        periodStart: eligible[0].createdAt,
        periodEnd: eligible[eligible.length - 1].createdAt,
        approvedById: adminId,
        approvedAt: now,
      },
    })

    await tx.payout.updateMany({
      where: { ...RUN_ELIGIBLE, id: { in: eligible.map((row) => row.id) } },
      data: { runId: run.id, status: 'processing', failureReason: null },
    })

    const count = await refreshRunTotals(tx, run.id)
    if (count === 0) {
      await tx.payoutRun.delete({ where: { id: run.id } })
      return null
    }
    return { id: run.id, label: run.label, count }
  })
}

/**
 * Take one line out of a draft run and put it back in the queue as approved.
 * The run row is touched first so the draft check and the exclusion hold the
 * same lock as mark-run-paid.
 */
export async function excludeFromRun(runId: string, payoutId: string, reason: string) {
  return db.$transaction(async (tx) => {
    const locked = await tx.payoutRun.updateMany({
      where: { id: runId, status: 'draft' },
      data: { updatedAt: new Date() },
    })
    if (locked.count === 0) return { ok: false as const, reason: 'not-draft' as const }

    const moved = await tx.payout.updateMany({
      where: { id: payoutId, runId, status: 'processing' },
      data: { runId: null, status: 'approved', failureReason: reason.trim() || null },
    })
    if (moved.count === 0) return { ok: false as const, reason: 'not-in-run' as const }

    const left = await refreshRunTotals(tx, runId)
    if (left === 0) await tx.payoutRun.update({ where: { id: runId }, data: { status: 'void' } })
    return { ok: true as const, left }
  })
}

/**
 * Close a draft run as paid with the operator's reference, in one transaction.
 *
 * Idempotent: the run flips `draft → paid` with a guarded `updateMany`, so a
 * second submit (double click, retry, a second tab) matches nothing and posts
 * nothing. Every line goes through `postPayoutPaid` — the same function the
 * per-payout action uses.
 */
export async function markRunPaid(runId: string, reference: string, adminId: string) {
  const ref = reference.trim()
  if (!ref) return { ok: false as const, reason: 'no-reference' as const }

  return db.$transaction(async (tx) => {
    const flipped = await tx.payoutRun.updateMany({
      where: { id: runId, status: 'draft', payoutCount: { gt: 0 } },
      data: { status: 'paid', reference: ref, paidAt: new Date(), paidById: adminId },
    })
    if (flipped.count === 0) {
      const run = await tx.payoutRun.findUnique({ where: { id: runId }, select: { status: true } })
      if (run?.status === 'paid') return { ok: true as const, alreadyPaid: true, paid: 0 }
      return { ok: false as const, reason: run ? ('not-draft' as const) : ('not-found' as const) }
    }

    const lines = await tx.payout.findMany({
      where: { runId, status: 'processing' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
    let paid = 0
    for (const line of lines) {
      if (await postPayoutPaid(tx, line.id, ref, { runId })) paid += 1
    }
    return { ok: true as const, alreadyPaid: false, paid }
  })
}

// ── Export ───────────────────────────────────────────────────────────────────

type Snapshot = {
  method?: string
  iban?: string | null
  bankName?: string | null
  beneficiary?: string | null
  email?: string | null
}

export type ExportFile = { filename: string; body: string; rows: number; totalCents: number }

function toCents(value: Prisma.Decimal | number | string) {
  // Decimal(14,2) → integer cents without a float round trip.
  const [whole, frac = ''] = String(value).split('.')
  const sign = whole.startsWith('-') ? -1 : 1
  return sign * (Math.abs(Number(whole)) * 100 + Number((frac + '00').slice(0, 2)))
}

function fromCents(cents: number) {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

/**
 * One CSV cell. Quotes when needed, and strips a leading formula trigger from
 * free text a creator typed (a name) so the file cannot execute in a
 * spreadsheet. IBANs, emails and amounts never start with one.
 */
function cell(value: string, freeText = false) {
  let text = value.replace(/[\r\n]+/g, ' ').trim()
  if (freeText) text = text.replace(/^[=+\-@\t]+/, '')
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Short, ASCII, fits every rail's reference field (Wise: ≤ 18 on most routes). */
export function lineReference(payoutId: string) {
  return `LAQTA-${payoutId.slice(-10).toUpperCase()}`
}

/**
 * The per-rail file for a run. Only the columns the rail needs — no creator
 * id, no country, no gross amount, no withholding.
 *
 * - iban:     beneficiary_name, iban, amount, currency, reference (header row)
 * - wise:     Wise batch "email recipients" template columns (header row)
 * - payoneer: Payoneer batch payment — A email, B amount, C currency,
 *             D description; no header row, as Payoneer reads column positions
 *
 * The amount is `Payout.netAmount` — what reaches the creator.
 */
export async function buildRunExport(runId: string, rail: Rail): Promise<ExportFile | null> {
  const run = await db.payoutRun.findUnique({
    where: { id: runId },
    select: {
      label: true,
      status: true,
      payouts: {
        where: { method: rail, status: { in: ['processing', 'paid'] } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          netAmount: true,
          currency: true,
          destinationSnapshot: true,
          creator: { select: { beneficiaryName: true, displayNameEn: true } },
        },
      },
    },
  })
  if (!run || run.status === 'void') return null

  let totalCents = 0
  const lines: string[] = []

  if (rail === 'iban') lines.push('beneficiary_name,iban,amount,currency,reference')
  if (rail === 'wise')
    lines.push('name,recipientEmail,paymentReference,receiverType,amountCurrency,amount,sourceCurrency,targetCurrency')

  for (const payout of run.payouts) {
    const snap = (payout.destinationSnapshot ?? {}) as Snapshot
    const cents = toCents(payout.netAmount)
    totalCents += cents
    const amount = fromCents(cents)
    const currency = payout.currency.toUpperCase()
    const reference = lineReference(payout.id)
    // Older approvals froze no name for email rails; fall back to the profile.
    const name =
      snap.beneficiary || payout.creator.beneficiaryName || payout.creator.displayNameEn || ''

    if (rail === 'iban') {
      const iban = (snap.iban ?? '').replace(/\s+/g, '').toUpperCase()
      lines.push([cell(name, true), cell(iban), amount, currency, reference].join(','))
    } else if (rail === 'wise') {
      lines.push(
        [cell(name, true), cell(snap.email ?? ''), reference, 'PRIVATE', 'target', amount, currency, currency].join(','),
      )
    } else {
      lines.push([cell(snap.email ?? ''), amount, currency, reference].join(','))
    }
  }

  return {
    filename: `laqta-${run.label}-${rail}.csv`,
    body: `${lines.join('\r\n')}\r\n`,
    rows: run.payouts.length,
    totalCents,
  }
}

export { toCents, fromCents }
