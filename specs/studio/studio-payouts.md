# Payouts

**Route** `/studio/payouts` · **Access** creator or admin (`requireCreator`; no `creatorId` → `/sell`) · **Rendering** server, dynamic

## Purpose
Request a transfer of the available balance, and show the history of past requests
with the reason any new request is currently blocked.

## Data in
- `getEarnings(creatorId)` — `available`, `held`, `lifetime` (see the earnings spec).
- `Creator.findUnique` selecting `payoutMethod, iban, payoneerEmail, wiseEmail` — used to decide whether the chosen rail is reachable.
- `Payout.findMany` where `creatorId`, `orderBy createdAt desc`, `take 50` — date, method, `amount`, `netAmount`, `currency`, `status`.
- Derived: `openRequest` = the first payout with status `requested|approved|processing`; `railReady` = the field matching `payoutMethod` is non-empty; `eligible = available >= MIN_PAYOUT_SAR && !openRequest && railReady`.

## Controls
| Control | Action | Effect |
|---|---|---|
| «طلب تحويل» (rendered only when `eligible`) | `requestPayout()` — `ActionButton` | Creates a `Payout` for the whole available balance with `status: 'requested'`, `method` = the creator's current rail, `withholdingAmount = available × Creator.withholdingRate`, `netAmount = amount − withholding`; writes `AuditLog` `payout.request`; revalidates `/studio/payouts` and `/studio/earnings` |
| «إعدادات التحويل» link (shown when the rail is incomplete) | Link → `/studio/settings` | Navigation only |

The history table is read-only; a creator cannot cancel a request.

## States
- **Rail incomplete** — warning alert plus the settings link; the request button is not rendered.
- **Open request** — info alert (`dash.payoutRequested`); button not rendered.
- **Below minimum** — info alert: `dash.nothingAvailable` when `available <= 0`, otherwise `dash.belowMinimum` with the threshold. Button not rendered.
- **Eligible** — only then does the button exist; pending state disables it and shows a spinner, success raises a toast and `router.refresh()`.
- **Server-side refusal** — `requestPayout` re-checks everything and can still return `state.forbidden` (no creator), `state.notFound` (creator row gone), `dash.payoutRequested` (open request) or `dash.belowMinimum`, raised as an error toast.
- **No payouts yet** — `EmptyState` in the history panel.
- **No creator profile** → `redirect('/sell')`.

## Invariants
- **One open request at a time.** A `requested` payout has not moved money and does not reduce `available`, so a second request would double-spend the same balance.
- The destination is **not** frozen here. `Payout.destinationSnapshot` is written at admin approval, so bank details may legitimately change while a request is queued.
- The requested amount is always the full computed `available`, derived from `CreatorLedger.availableAt` (30-day hold) minus payouts already `approved|processing|paid`. It is never typed by the creator.
- Commission on the underlying sales stays frozen at purchase; a payout moves money, it never re-splits it.
- `MIN_PAYOUT_SAR = 500` is the threshold, compared against a balance the rest of the system denominates in **USD** — the constant's name is stale, the value is not converted.

## Verified by
`verify:money` covers the ledger/hold arithmetic this page reads; `verify:arabic` and `audit` cover the page. The request action itself is not exercised by `verify:flows`.
