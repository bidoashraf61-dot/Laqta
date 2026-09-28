# Invoice

**Route** `/account/invoices/[orderId]` · **Access** the buyer who owns the order · **Rendering** route handler, dynamic

## Purpose
Serve the invoice document for an order (DEV-28). Every paid order already had an
`Invoice` row and number (`settleOrder`), and the site promises an invoice with every
purchase, but until 2026-09-28 no document existed.

## Data in
- `auth()` session — `session.user.id`.
- `Order` → owner, `invoice` (number, `pdfKey`), the buyer's locale.
- `lib/invoice.ts#generateInvoice` builds it from what the order FROZE: the
  `billingEntitySnapshot` (legal name, VAT number, CR, address), `poNumber`, each line's
  `grossAmount` and album title, `subtotal`, discounts, `vatRate`, `vatAmount`, `total`,
  `refundedAmount`. The seller block is `licensorLine()` + `CONTACT_ADDRESS_*` +
  `CONTACT_CR_NUMBER` (content/contact.ts).

## Controls
None — a GET that returns a PDF (`inline`, `private, no-store`). Linked from the invoice
number on [`/account/purchases`](../account/account-purchases.md), opened in a new tab.

## States
- **Signed out** — 401 (middleware sends a browser to sign-in first).
- **Not the owner, unknown id, or no invoice** (unpaid, or a free order) — `404`, identically.
- **Refunded / partially refunded** — still served, with a «المسترجع» line: it is the
  record of the sale the refund reverses.
- **`pdfKey` empty** — generated on demand, then stored. **Render fails** — `503`.

## Invariants
- Titled «فاتورة» / "Invoice", **never «فاتورة ضريبية»**: a Saudi tax invoice is a
  regulated document (ZATCA, VAT registration, QR code) and whether Laqta issues one is
  the accountant's open question (BIZ-03, D7). Site copy says «فاتورة» everywhere for the
  same reason.
- Nothing is recomputed — every amount is read off the order as stored at purchase.
- Never public: outside `public/`, ownership re-checked, excluded from the page CSP
  like the certificate route (`next.config.mjs`).

## Verified by
Rendered for a seeded paid order and inspected (Arabic and English). `verify:money`
covers the amounts it prints; `audit` covers `/account/purchases`.
