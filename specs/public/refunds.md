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

## Verified by
`verify:money` covers the refund arithmetic (frozen rate reversal); `verify:arabic` and `audit` cover the page.
