# Licences

**Route** `/licences` · **Access** public · **Rendering** server component, effectively static (no DB access)

## Purpose
Explain what the standard licence covers and what requires the extended licence — the buyer's largest pre-purchase anxiety.

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
- The standard/extended split described here must match what `LicencePicker` offers and what `checkout()` freezes as `licenceVersionId` on the `OrderItem`.
- Editorial-only albums cannot be licensed as extended — that rule is enforced in `LicencePicker` and `CartLine` and must be reflected in this text.
- Effective date must always render.

## Verified by
`verify:arabic`, `audit`.

## Invariant added with the bilingual launch

The two tiers are the product (`LicenceTier` in `prisma/schema.prisma`).
Standard covers ordinary commercial use up to five hundred thousand views per
channel; extended costs 3× and lifts the ceiling, adding resale products. **No
surface may claim an uncapped standard licence** — the landing did, for a while,
in both languages, while this page said otherwise.
