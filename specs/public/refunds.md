# Refunds

**Route** `/refunds` · **Access** public · **Rendering** server component, effectively static (no DB access)

## Purpose
State when a refund is available for a digital download and how it is processed.

## Data in
- None. Renders the `REFUNDS` sections and `EFFECTIVE_FROM` from `content/legal.ts`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| "تواصل معنا" (document footer) | Link | `/contact` |

Read-only. There is no refund-request form here; refunds are raised through support and processed from `/admin` (`Refund`, `RefundLine`, `Dispute` models).

## States
- No empty, error or loading state — content is a compile-time constant.
- Effective date is the shared `EFFECTIVE_FROM` constant.
- Flagged in-code as pending review by Saudi counsel.

## Invariants
- The refund window described here is what the 30-day payout hold in `settleOrder()` exists to protect: creator funds are not payable until the refund window on the sale has closed (`PAYOUT_HOLD_DAYS`, default 30).
- **Frozen commission** — a refund reverses against the `commissionRate` stored on the `OrderItem` at purchase, never a recomputed rate. This document must not describe any behaviour that requires recomputation.
- Effective date must always render.
- **⚠️ Open conflict, owner decision pending (2026-09-23).** This page says a
  refund is fault-based and requested **within fourteen days** of purchase.
  `brand.seo.refunds` (this page's own search description) and the content
  brief say **seven days, and only if no file was downloaded**. The two cannot
  both be the policy. The content polish left this page's wording and meaning
  alone — a refund window is a legal term, not copy — and only corrected the
  grammar and the stale "same licence" phrase in `REFUNDS[1].list[2]`. Whichever
  rule the owner confirms, this page, `brand.seo.refunds` and both languages
  change together.

## Verified by
`verify:money` covers the refund arithmetic (frozen rate reversal); `verify:arabic` and `audit` cover the page.
