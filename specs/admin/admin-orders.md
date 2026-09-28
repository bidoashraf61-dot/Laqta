# Orders

**Route** `/admin/orders` · **Access** admin only · **Rendering** server, dynamic (`searchParams` + `auth()`)

## Purpose
Find an order, settle a pending bank transfer, see how every paid order got paid
(Paymob callback or by hand) and whether the gateway reported anything wrong, and
refund an individual order line against the commission rate frozen on that line.

## Data in
- `searchParams.q` — case-insensitive `contains` over `Order.orderNumber` and
  `user.email`.
- `searchParams.status` — accepted if in `statusValues('order')`
  (`pending, paid, failed, refunded, partially_refunded`).
- `Order.findMany` — `orderBy createdAt desc`, `take: 50`, includes `user`
  (email, name), `items` → `album` (titleAr, titleEn) and `creator.displayNameAr`, and
  the order's latest 20 `paymentEvents` (`outcome` only).
- `Order.gatewayRef` — `BT-<orderNumber>` for an unsettled bank transfer,
  `PAYMOB-INT-<intention id>` for a card / Apple Pay order awaiting Paymob,
  `PAYMOB-<transaction id>` once the callback settled it, `MANUAL-<admin8>` after a
  manual settle.
- **Status source** is derived, not stored: `settlementSource(status, paymentEvents)` in
  `lib/paymob-callback.ts` — `webhook` if any event has `outcome='settled'`, otherwise
  `manual`, and nothing while the order is unpaid.
- `Order.groupBy({ by: ['status'] })` — chip counts.
- Per line the page renders `licenceTier`, the **frozen** `commissionRate`,
  `grossAmount`, `refundedAmount`, and computes `remaining = grossAmount − refundedAmount`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| `SearchBox` | GET form / `?q=` | re-queries the list |
| `FilterChips` | plain `<a>` to `?status=` | re-queries the list |
| «تأكيد الدفع» (only when `order.status === 'pending'`) | `markOrderPaid(orderId)` → `lib/orders.settleOrder(orderId, 'MANUAL-<admin8>')` — the **same** function the Paymob callback calls | order → `paid`, `paidAt`, `gatewayRef`; per item a `CreatorLedger` `sale` entry with `availableAt = now + PAYOUT_HOLD_DAYS` (default 30) and the creator's `balanceHeld` / `lifetimeGmv` updated; an `Invoice`; and, in the same transaction, `notifyOrderPaid` queues the buyer's `order.confirmed` receipt (album titles, frozen subtotal / VAT / total, library link). After commit the licence certificates are rendered, attached to that row, and the outbox drains. Audits `order.settle_manual` |
| «استرجاع» disclosure on a line (only when order is `paid` or `partially_refunded`) | opens `RefundControl` | — |
| Refund form → submit | `refund({ orderItemId, amount, reason, policyBasis })` → `lib/admin.refundOrderItem` | see invariants below. Audits `order.refund` |
| «التقارير» footer link | link | → `/admin/reports` |

Refund form fields: amount (defaults to and is capped at `remaining`), policy basis
select (`technical_fault | licence_mismatch | duplicate_purchase | goodwill`), reason
textarea (required, 500 chars).

## States
- **Empty result** — `EmptyState` with `dash.noOrders`.
- **Reference / source line** (under the email line, muted, only when there is something
  to say): «المرجع: `<gatewayRef>`» (`.ltr-island`) · «تأكيد الدفع: تلقائي من بوابة الدفع»
  (`dash.settledWebhook`) or «يدوي من الإدارة» (`dash.settledManual`).
- **Gateway flags** (clay, one line per distinct outcome) — «إشعار من بوابة الدفع يحتاج
  مراجعة: …» for `amount_mismatch` (`dash.gatewayOutcome_amount_mismatch`),
  `integration_mismatch`, `reversed_at_gateway` (a void of an order that was never paid —
  nothing to reverse), `refund_needs_review` (a **partial** refund at Paymob,
  `dash.gatewayOutcome_refund_needs_review` — nothing reversed; the operator picks the
  album and uses the refund control) and `order_not_pending`. A **whole** refund or void at
  Paymob reverses the order automatically (DEV-51, `specs/api/payments-paymob.md`): the
  order shows «مسترجع» and the refund row carries the Paymob reference. `declined`, `pending`, `already_paid`, `unknown_order` are
  routine and not shown.
- **Pending card / Apple Pay order** — a muted hint `dash.gatewayCardPendingHint`: it
  settles automatically when Paymob's callback arrives; do not confirm it by hand before
  checking the Paymob dashboard. The «تأكيد التحويل» button is still present (it is the
  operator's escape hatch if a callback is lost). A second settle is a no-op through
  `settleOrder`'s early return on `paid` — but only sequentially: a manual click racing a
  callback that is mid-settlement is not locked (see Dead ends in the area README).
- **Order not `pending`** — the settle button is absent.
- **Order not `paid` / `partially_refunded`** — the refund control is absent on all its
  lines.
- **Line fully refunded** (`remaining <= 0`) — `RefundControl` renders `null`.
- **Client-side refund guards** — non-finite / `<= 0` / `> remaining` amount toasts
  `dash.payoutAmount`; empty reason toasts `dash.refundReason`; then a native confirm.
- **Server-side refund failures** — order item not found → `state.notFound`;
  computed `refundGross <= 0` → `state.error`.
- **`settleOrder` on an already-paid order** returns early and does nothing; the action
  still reports success and writes an audit row. Likewise a Paymob success arriving for
  an order already settled by hand is recorded as `already_paid` and does nothing.
- **Two settlements racing** (a double click, or a gateway webhook arriving while the
  operator settles) — the order is flipped by compare-and-set
  (`updateMany where status != 'paid'`) inside the transaction; the loser matches
  nothing and leaves, so the ledger, invoice and receipt happen once.
- **No mail provider / mail failure** — the order is still paid; the receipt row stays
  pending (or failed) in the outbox and shows on `/admin/settings`.
- **Truncation** — hard `take: 50` orders, no pagination.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- **Zero-value lines and orders** (today only free-sample claims, `paymentMethod: 'sample'`): `settleOrder` posts no `CreatorLedger` row for a line whose gross and creator net are 0 (it still counts the claim on the album's `salesCount`), and raises no tax `Invoice` for an order whose total is 0. The receipt is replaced by the `sample.claimed` message. See [`../public/sample.md`](../public/sample.md).
- **Commission is frozen.** A refund reverses commission using
  `Number(item.commissionRate)` read off the `OrderItem` — never a freshly resolved rate.
  A creator promoted after the sale must not have the new rate applied retroactively, or
  the ledger stops netting to zero (`lib/commission.reverseCommission`,
  `lib/admin.refundOrderItem`).
- **The refund that empties a line reverses exactly what is left** of its frozen
  `commissionAmount` and `creatorNetAmount` (minus earlier refund lines), not rate × gross —
  so every line nets to zero to the cent. It matters on a bundled line (DEV-62), whose
  stored rate is derived from the amounts. Earlier, partial refunds use the frozen rate.
- A bundled line shows its bundle discount in `discountAmount` and `bundleId`; the creator's
  net on it is the stand-alone net (Laqta paid the discount).
- The refund is capped at `grossAmount − refundedAmount`; VAT is reversed pro-rata
  (`vatAmount × refundGross / gross`).
- Refund, refund line, order-item update, order update and the creator `refund` ledger
  entry all happen inside one `$transaction`.
- **A full refund revokes the entitlement** (`Entitlement.revokedAt` / `revokeReason` set
  via `updateMany`); a partial refund does not. The download route re-checks revocation
  on every redemption.
- `Order.status` becomes `partially_refunded` or `refunded` depending on whether the line
  was fully reversed.
- **One paid path.** Manual settle and the Paymob callback both go through
  `lib/orders.settleOrder`; there is no second writer of `status='paid'`. The ledger
  row, 30-day hold, invoice and the queued `order.confirmed` mail are identical
  whichever rail got there (`verify:payments` asserts this).
- A Paymob amount/currency mismatch is recorded and **not** settled; the order stays
  `pending` and is flagged here.
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
second receipt), `verify:payments` (a webhook-settled order reads as `webhook`, a manual
one as `manual`; both produce the same ledger/commission). The flag and source lines
themselves are not asserted by a browser gate. Not covered by `verify:flows`.
