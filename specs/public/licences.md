# Licences

**Route** `/licences` · **Access** public · **Rendering** server component, effectively static (no DB access)

## Purpose
Explain what the one licence covers, and the few things it does not — the buyer's largest pre-purchase anxiety.

## Data in
- None. Renders the `LICENCES` sections and `EFFECTIVE_FROM` from `content/legal.ts`.
- **Note:** this page does not read `LicenceVersion` from the database. The per-album licence text shown on the album PDP comes from `Album.licenceVersion.bodyAr`; this page is separately authored prose. The two can drift.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| "تواصل معنا" (document footer) | Link | `/contact` |

Read-only. Linked from the landing page's licensing band (`landing.licenseCta`).

## States
- No empty, error or loading state — content is a compile-time constant.
- Effective date is the shared `EFFECTIVE_FROM` constant.
- Flagged in-code as pending review by Saudi counsel.

## Invariants
- The grants described here must match what `LicencePicker` states and what `checkout()` freezes as `licenceVersionId` on the `OrderItem`.
- There is exactly one licence. No surface may imply a tier, an upgrade, or a view cap.
- Effective date must always render.

## Verified by
`verify:arabic`, `audit`.

## One licence — the collapse

There were two tiers (`LicenceTier`): standard, capped at five hundred thousand
views per channel, and extended at 3× the price for an uncapped grant. The enum,
the second price column (`Album.priceExtended`), the pricing band's
`extendedMultiplier`, the tier on `CartItem` / `OrderItem` / `Entitlement`, and
the tier selector are all **gone**.

One licence — **full commercial, genuinely uncapped**, seeded as
`commercial-v1`. The tier was the single most common thing a buyer got wrong:
guess low and they are out of licence, which is a legal problem; guess high and
they overpay, which is a refund. Collapsing removes the question rather than
explaining it better.

`Entitlement` is now unique on `(userId, albumId)` — one grant per buyer per
album, because there is nothing left to distinguish two grants of the same
album. `licenceVersionId` is still frozen onto every `OrderItem`: the text can
be revised, and a buyer owns the wording in force when they paid.

The prohibition that survives is the one every stock library keeps: you may use
the footage in anything you make, but you may not resell the footage itself.
