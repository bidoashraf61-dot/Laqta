# Purchases

**Route** `/account/purchases` · **Access** any authenticated user · **Rendering** server component, dynamic

## Purpose
Order history: one row per `Order` with its number, date, total, invoice number
and payment status.

## Data in
- `requireUser()` for the session user id.
- `db.order.findMany`
  - filter: `{ userId: user.id }`
  - order: `createdAt` desc, no limit, no pagination
  - includes `items: { select: { id } }` (fetched but never rendered) and
    `invoice: { select: { invoiceNumber } }`.
- `Order.total` and `Order.currency` are formatted with `formatMoney`;
  `createdAt` with `formatDate`.

## Controls
No filters, forms, order detail route or reorder.

| Control | Action | Effect |
| --- | --- | --- |
| Invoice number (a link) | Plain `<a target="_blank">` → `/account/invoices/[orderId]` | Opens the order's invoice PDF (DEV-28, [`../api/invoices.md`](../api/invoices.md)). `aria-label` «الفاتورة INV-…». Orders without an invoice show `—`. |

## States
- Empty: `EmptyState` with the generic «لا يوجد شيء هنا بعد» (`state.empty`) —
  not a purchase-specific message and with no CTA to `/albums`.
- Status badge: `paid` → success badge `checkout.successPaid`; **every other
  status** (`pending`, `failed`, `refunded`, `partially_refunded`) → warning badge
  `checkout.successPending`. Failed and refunded orders are therefore
  indistinguishable from pending ones on this page.
- No invoice yet (`Invoice` is only created in `settleOrder`): the cell shows `—`.
- Loading/error: no route-level `loading.tsx` or `error.tsx`.

## Invariants
- Money is displayed, never recomputed: `subtotal` / `vatAmount` / `total` are
  read off the `Order` row as stored at purchase. Commission is frozen on
  `OrderItem` at purchase (`lib/orders.ts`) and is not exposed here at all.
- Only the signed-in user's orders (`userId` filter).

## Verified by
`verify:arabic`, `audit`. `verify:money` covers the frozen commission/refund
arithmetic behind these rows but does not open this page.
