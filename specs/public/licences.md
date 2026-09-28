# Licences

**Route** `/licences` · **Access** public · **Rendering** server component, dynamic (one `DocumentVersion` read per render)

## Purpose
Explain what the one licence covers, and the few things it does not — the buyer's largest pre-purchase anxiety.

## Data in
- `loadDocument('licences')` (`lib/editable-documents.ts`, DEV-64a): the newest `DocumentVersion` the owner published from [`/admin/content/licences`](../admin/admin-content-key.md), else the `LICENCES` sections from `content/legal.ts`.
- The effective date is that version's `publishedAt`; with nothing published it is the shared `EFFECTIVE_FROM` (`2026-08-01`) from `content/legal.ts`.
- **Note:** this page does not read `LicenceVersion` from the database. The per-album licence text shown on the album PDP comes from `Album.licenceVersion.bodyAr`; this page is separately authored prose. The two can drift.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| "تواصل معنا" (document footer) | Link | `/contact` |

Read-only. Linked from the landing page's licensing band (`landing.licenseCta`).

## States
- No empty, error or loading state. A database error, or a stored version that no longer passes the publish rules, renders the `content/legal.ts` text — copy never breaks the page.
- The effective date is the live version's publish date, or the shared `EFFECTIVE_FROM` for the original text.
- The code default is flagged in-code as pending review by Saudi counsel.

## Invariants
- «ما يمنعه الترخيص» includes **publishing a watermarked preview**: a downloaded preview is for testing in the edit; the licence covers only files delivered after purchase (added 2026-09-24 with preview downloads — **pending the owner's counsel**).
- The grants described here must match what `LicencePicker` states and what `checkout()` freezes as `licenceVersionId` on the `OrderItem`.
- There is exactly one licence. No surface may imply a tier, an upgrade, or a view cap.
- Effective date must always render.
- **«اللقطات المولّدة بالذكاء الاصطناعي» / "AI-generated footage"** (DEV-26, 2026-09-28): same licence for AI albums; model and filming permits do not apply to them (no real person, no real site) and an accuracy review replaces them; one extra limit — an AI-generated clip may not be presented as real footage of an actual event, person or place. Flagged for counsel.

## Verified by
`verify:arabic`, `audit`, `verify:documents` (load, publish, restore, fall-back), `verify:licence` (scans the published version).

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
