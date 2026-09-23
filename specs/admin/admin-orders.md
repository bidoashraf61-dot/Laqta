# Orders

**Route** `/admin/orders` · **Access** admin only · **Rendering** server, dynamic (`searchParams` + `auth()`)

## Purpose
Find an order, settle a pending bank transfer, and refund an individual order line
against the commission rate frozen on that line.

## Data in
- `searchParams.q` — case-insensitive `contains` over `Order.orderNumber` and
  `user.email`.
- `searchParams.status` — accepted if in `statusValues('order')`
  (`pending, paid, failed, refunded, partially_refunded`).
- `Order.findMany` — `orderBy createdAt desc`, `take: 50`, includes `user`
  (email, name) and `items` → `album` (titleAr, titleEn) and `creator.displayNameAr`.
- `Order.groupBy({ by: ['status'] })` — chip counts.
- Per line the page renders `licenceTier`, the **frozen** `commissionRate`,
  `grossAmount`, `refundedAmount`, and computes `remaining = grossAmount − refundedAmount`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| `SearchBox` | GET form / `?q=` | re-queries the list |
| `FilterChips` | plain `<a>` to `?status=` | re-queries the list |
| «تأكيد الدفع» (only when `order.status === 'pending'`) | `markOrderPaid(orderId)` → `lib/orders.settleOrder(orderId, 'MANUAL-<admin8>')` | order → `paid`, `paidAt`, `gatewayRef`; per item a `CreatorLedger` `sale` entry with `availableAt = now + PAYOUT_HOLD_DAYS` (default 30) and the creator's `balanceHeld` / `lifetimeGmv` updated; an `Invoice`; and, in the same transaction, `notifyOrderPaid` queues the buyer's `order.confirmed` receipt (album titles, frozen subtotal / VAT / total, library link). After commit the licence certificates are rendered, attached to that row, and the outbox drains. Audits `order.settle_manual` |
| «استرجاع» disclosure on a line (only when order is `paid` or `partially_refunded`) | opens `RefundControl` | — |
| Refund form → submit | `refund({ orderItemId, amount, reason, policyBasis })` → `lib/admin.refundOrderItem` | see invariants below. Audits `order.refund` |
| «التقارير» footer link | link | → `/admin/reports` |

Refund form fields: amount (defaults to and is capped at `remaining`), policy basis
select (`technical_fault | licence_mismatch | duplicate_purchase | goodwill`), reason
textarea (required, 500 chars).

## States
- **Empty result** — `EmptyState` with `dash.noOrders`.
- **Order not `pending`** — the settle button is absent.
- **Order not `paid` / `partially_refunded`** — the refund control is absent on all its
  lines.
- **Line fully refunded** (`remaining <= 0`) — `RefundControl` renders `null`.
- **Client-side refund guards** — non-finite / `<= 0` / `> remaining` amount toasts
  `dash.payoutAmount`; empty reason toasts `dash.refundReason`; then a native confirm.
- **Server-side refund failures** — order item not found → `state.notFound`;
  computed `refundGross <= 0` → `state.error`.
- **`settleOrder` on an already-paid order** returns early and does nothing; the action
  still reports success and writes an audit row.
- **Two settlements racing** (a double click, or a gateway webhook arriving while the
  operator settles) — the order is flipped by compare-and-set
  (`updateMany where status != 'paid'`) inside the transaction; the loser matches
  nothing and leaves, so the ledger, invoice and receipt happen once.
- **No mail provider / mail failure** — the order is still paid; the receipt row stays
  pending (or failed) in the outbox and shows on `/admin/settings`.
- **Truncation** — hard `take: 50` orders, no pagination.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- **Commission is frozen.** A refund reverses commission using
  `Number(item.commissionRate)` read off the `OrderItem` — never a freshly resolved rate.
  A creator promoted after the sale must not have the new rate applied retroactively, or
  the ledger stops netting to zero (`lib/commission.reverseCommission`,
  `lib/admin.refundOrderItem`).
- The refund is capped at `grossAmount − refundedAmount`; VAT is reversed pro-rata
  (`vatAmount × refundGross / gross`).
- Refund, refund line, order-item update, order update and the creator `refund` ledger
  entry all happen inside one `$transaction`.
- **A full refund revokes the entitlement** (`Entitlement.revokedAt` / `revokeReason` set
  via `updateMany`); a partial refund does not. The download route re-checks revocation
  on every redemption.
- `Order.status` becomes `partially_refunded` or `refunded` depending on whether the line
  was fully reversed.
- Note: the `policyBasis` values offered by the UI (`technical_fault`, `licence_mismatch`,
  `duplicate_purchase`, `goodwill`) do **not** match the set documented on the
  `Refund.policyBasis` field in `prisma/schema.prisma`
  (`no_download_within_7d | technical_defect | discretionary | chargeback`). The column is
  a free-form `String`, so both write successfully.

## Verified by
`verify:arabic`, `audit`, `verify:money` (the refund path via `refundOrderItem`: frozen
rate, ledger netting to zero, entitlement revoked on a full refund),
`verify:entitlement` (snapshot immutability), `verify:mail` (two concurrent
`settleOrder` calls → one receipt and one invoice; `notifyOrderPaid` afterwards → no
second receipt). Not covered by `verify:flows`.
