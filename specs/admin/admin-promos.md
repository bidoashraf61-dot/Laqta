# Promo codes

**Route** `/admin/promos` · **Access** admin only · **Rendering** server, dynamic (`auth()`)

## Purpose
Create, edit and switch promo codes on or off, with redemptions shown against the cap.

## Data in
- `PromoCode.findMany({ orderBy: [{ isActive: 'desc' }, { code: 'asc' }] })` — all codes,
  no filter, no limit.
- `now` is computed in the page to decide whether a code is inside its window.

Takes no `searchParams`; there is no search or filter on this route.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «كود جديد» (header) | opens `PromoEditor` in create mode | — |
| «تعديل» (per code) | opens `PromoEditor` in edit mode | — |
| Editor form → save | `savePromo` (`SettingsForm`) | creates or updates a `PromoCode`: `code` (upper-cased), `kind`, `value`, `maxRedemptions`, `minOrderTotal`, `startsAt`, `endsAt`, `isActive`. Audits `promo.create` / `promo.update` |
| Activate / deactivate button | `togglePromoActive(id, !isActive)` | flips `isActive`. Audits `promo.activate` / `promo.deactivate` |

There is **no delete control** — codes are only deactivated.

## States
- **No codes** — `EmptyState` with `dash.noPromos`.
- **Badge is four-valued**: active + in window + not exhausted → `dash.promoActive`
  (success); active but redemptions ≥ cap → `dash.promoLimit`; active but outside its
  window → `dash.promoWindow`; not active → `dash.promoInactive`. An exhausted code and a
  broken code look identical from the buyer's side, so the distinction is surfaced here.
- **Validation failures** (inline `Alert`):
  - `code` failing `/^[A-Z0-9][A-Z0-9_-]{2,31}$/` → `dash.promoCode`
  - `kind` not `percent | fixed` → `state.error`
  - `value` not finite, `<= 0`, or `> 90` for a percent code → `dash.promoValue`
  - `code` already used by another row → `dash.promoCode`
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- A percent code is capped at 90 — a 100%-off code would be a free catalogue — and no
  code may be zero or negative (a negative one would be a credit).
- `code` is unique in the schema and re-checked in the action before writing.
- `redemptions` is never written from this route. It is incremented by `lib/orders.checkout` when an order is **placed** with the code (DEV-63, atomic against `maxRedemptions`) — an order placed and never paid still counts. Buyers enter codes at [`/checkout`](../public/checkout.md); every field here (`kind`, `value`, dates, cap, `minOrderTotal`, `albumIds`) is enforced there.
- `PromoCode.albumIds` (restrict-to-albums) and `currency` are **not editable here** —
  the editor exposes neither, so `albumIds` stays `[]` (everything) and `currency` keeps
  its schema default.
- Nothing here mutates an order, a commission rate or an entitlement.

## Verified by
`verify:arabic`, `audit`. Not covered by `verify:flows` (the route has no filter chips).
