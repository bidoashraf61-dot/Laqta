# Sell your footage

**Route** `/sell` · **Access** public · **Rendering** server component, dynamic (two count queries)

## Purpose
Recruit creators: lead with their revenue share, then answer the two objections that stop a signup — "do I lose my rights" and "will you change the rate later".

## Data in
- `Clip.count()` where `album.status='live'`.
- `Creator.count()` where `status='approved'`.
- Constants from `lib/commission.ts`: `TIER_RATES` (standard/silver/gold platform rate; the page shows `1 - rate` as the creator share), `TIER_THRESHOLDS_SAR`, `EXCLUSIVE_BONUS_POINTS` (0.05).
- All copy from `messages/ar.json` under `sell.*`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| "قدّم طلبك" (×2, hero and closing band) | Link | `/sign-up?role=creator` |
| "تصفّح أولاً" | Link | `/albums` |
| Content-policy link | Link | `/content-policy` |

Read-only — no form, no server action on this page. The application itself happens at `/sign-up`.

## States
- **Empty catalogue** — the counts render as `0`; there is no conditional hiding of the trust line.
- **Tier threshold display** — `standard` (threshold 0) shows the tier label instead of a threshold figure.
- **Currency mismatch (bug)** — thresholds come from `TIER_THRESHOLDS_SAR` (SAR figures) but are rendered with `formatMoney(tier.threshold)`, and `formatMoney` defaults to `'USD'`. The tier thresholds are therefore labelled in the wrong currency since the move to USD pricing.
- **Also the creator-funnel entry point** — `/studio` redirects here when a signed-in user has no creator profile, so this page is reached mid-funnel as well as cold.

## Invariants
- Creator-facing copy asks for **rights, not a production method**: «مادة سعودية
  تملك حقوقها كاملة، مع الإفصاح عن طريقة إنتاجها». It previously required footage
  *shot* inside the Kingdom, which excluded the route the product actually
  accepts, and then named the generated route explicitly, which put the
  production method in acquisition marketing. Ownership is the condition that
  matters; disclosure is enforced by the content policy at review.
- The stated commission model must match `lib/commission.ts`; the page reads the constants rather than hard-coding percentages.
- The "frozen rate" promise on this page is the same invariant enforced in `lib/orders.ts` — commission is resolved once at purchase and a later tier promotion never applies retroactively.
- No individual creator's earnings are shown.

## Verified by
`verify:arabic`, `audit`. The commission arithmetic behind the numbers is covered by `verify:money`.
