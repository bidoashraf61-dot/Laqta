# Payouts

**Route** `/admin/payouts` · **Access** admin only · **Rendering** server, dynamic (`searchParams` + `auth()`)

## Purpose
Work the payout queue: approve a request (freezing the destination onto the payout) and
mark it paid with a bank reference, writing the matching ledger entry.

## Data in
- `searchParams.status` — accepted if in `statusValues('payout')`
  (`requested, approved, processing, paid, failed`); unknown → no filter. Absent →
  `requested, approved, processing`.
- `Payout.findMany` — `orderBy [status asc, createdAt asc]`, `take: 100`, includes
  `creator` (displayNameAr, handle, country).
- `Payout.groupBy({ by: ['status'] })` — chip counts.
- `Payout.groupBy({ by: ['method'], where: { status in [requested, approved, processing] } })`
  with `_sum.netAmount` and `_count.method` — the per-rail summary tiles (IBAN /
  Payoneer / Wise) and the queued total.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| `FilterChips` | plain `<a>` to `?status=` | re-queries the queue |
| «اعتماد» (only when `status === 'requested'`) | `approvePayout(payoutId)` | `status='approved'`, `approvedById`, `approvedAt`, and `destinationSnapshot` written from the creator's current payout rail. Audits `payout.approve` with the destination |
| Reference input + «تحويل تم» (when `status` is `approved` or `processing`) | `markPayoutPaid(payoutId, reference)` | in one `$transaction`: `status='paid'`, `paidAt`, `reference`; plus a `CreatorLedger` `payout` entry of `−amount` with `balanceAfter` derived from the creator's latest entry. Audits `payout.paid` |

## States
- **Empty queue** — `EmptyState` with `dash.noPayoutRequests`.
- **`paid` / `failed` payout** — `PayoutControls` renders `null`; the row is read-only.
- **Empty reference** — blocked client-side with a toast (`dash.payoutRef`); the server
  action would accept it and store `null`.
- **Approve on a payout that is not `requested`** → `{ ok: false, message: state.error }`.
- **Approve / mark-paid on a missing payout** → `state.notFound`.
- **Mark paid on an already-`paid` payout** → `state.error`.
- **Rail with nothing queued** — the tile renders a zero amount and a zero count rather
  than being hidden.
- **Truncation** — hard `take: 100`, no pagination.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- **The destination is frozen at approval.** `destinationSnapshot` is built from
  `Creator.payoutMethod` and the matching fields (IBAN + bankName + beneficiaryName, or
  payoneerEmail, or wiseEmail) at the moment of approval. Bank details may change while a
  request sits in the queue; an export generated later must pay the approved account.
- Marking paid writes the payout row and the `CreatorLedger` entry **in the same
  transaction**, so the creator's balance and the payout record can never disagree about
  whether the money left.
- `balanceAfter` is computed from the creator's most recent ledger row, not recomputed
  from scratch.
- Nothing here recomputes commission; payout amounts derive from ledger entries booked at
  sale time.

## Not wired
- The page is titled `admin.payoutRuns` ("دفعات التحويل") and its doc comment talks about
  per-rail export files, but the `PayoutRun` model is **never read or written by any admin
  route**. There is no run creation, no batching, and no export generation — only
  per-payout approve and mark-paid.
- `Payout.withholdingAmount`, `invoiceKey`, `periodStart/End` and `failureReason` are
  displayed nowhere and set nowhere in this area. There is no control to move a payout to
  `processing` or `failed`.

## Verified by
`verify:arabic`, `audit`, `verify:flows` (filter-chip navigation on `/admin/payouts`).
The 30-day hold that makes a balance payable is covered by `verify:money`; the approve /
mark-paid actions themselves are not directly asserted by any gate.
