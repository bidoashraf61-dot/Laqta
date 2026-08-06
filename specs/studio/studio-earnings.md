# Earnings

**Route** `/studio/earnings` · **Access** creator or admin (`requireCreator`; no `creatorId` → `/sell`) · **Rendering** server, dynamic

## Purpose
Show the creator's ledger and answer one question: how much is payable now, how
much is still held, and on what date each held sale releases.

## Data in
- `getEarnings(creatorId)` (`lib/studio.ts`):
  - `CreatorLedger.findMany` where `creatorId`, `orderBy createdAt desc`, `take 100`, including `orderItem.album.titleAr`.
  - `Payout.aggregate` summing `amount` where `status ∈ {paid, processing, approved}`.
  - Derives `available` = sum of `sale` rows whose `availableAt <= now`, minus payouts already taken, floored at 0; `held` = sum of `sale` rows with no `availableAt` or a future one; `lifetime` = sum of all `sale` rows.
- `creatorTrend(creatorId, 'revenue', 30)` — `AlbumStat` daily revenue for the bar chart and the fourth tile.

## Controls
| Control | Action | Effect |
|---|---|---|
| «المدفوعات» header button | Link → `/studio/payouts` | Navigation only |

Read-only. No server action is called from this surface.

## States
- **Empty ledger** — the ledger panel shows `EmptyState` with the hold explanation; the tiles still render (all zero).
- **No revenue history** — if every point of the 30-day revenue trend is 0 the chart panel is omitted entirely.
- **Per-row release state** — a `sale` row past `availableAt` gets a success badge (`studio.available`); a future one gets a warning badge showing the release **date**; any non-sale row (`payout`, `refund`, `adjustment`, `withholding`) shows `—`.
- **Truncation** — only the newest 100 ledger rows are listed, with no pagination or "show more". The tiles are computed from the same 100 rows, so a creator with more than 100 entries sees totals derived from a window, not from the whole ledger.
- **No creator profile** → `redirect('/sell')`.

## Invariants
- **Frozen commission.** Ledger amounts were written at purchase from `OrderItem.commissionRate`/`commissionAmount`; a refund reverses at that same frozen rate (`reverseCommission`). This page never recomputes a split.
- The 30-day hold is a property of the rows (`CreatorLedger.availableAt`), never a stored counter — `Creator.balanceHeld` / `balanceAvail` exist in the schema but are not what this page reads.
- `available` subtracts payouts in `approved|processing|paid` only; a payout still `requested` is not deducted, which is why `requestPayout` refuses a second open request.
- Amounts render in each row's own `currency`; sums use the default (`USD`).

## Verified by
`verify:money` (hold enforcement and refund-at-frozen-rate assert against `getEarnings`), plus `verify:arabic` and `audit` for the page itself.
