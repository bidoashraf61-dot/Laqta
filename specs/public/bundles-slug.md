# Bundle page

**Route** `/bundles/[slug]` (Arabic) · `/en/bundles/[slug]` (English) · **Access** public · **Rendering** server component, dynamic (`auth()` for the owned-albums note)

## Purpose
Sell a set of albums together below their separate price (DEV-62): what they cost apart,
what they cost together, the saving, and «اشترِ الحزمة», which puts them all in the cart.

## Data in
- `Bundle` by unique `slug`, with `BundleAlbum` rows in `position` order and each album's
  price fields (`OFFER_SELECT`), `isExclusive`, creator tier / commission override (for the
  ceiling), and the `AlbumCard` fields.
- Prices: `bundleLines(albums)` — each album's price **now** (`priceNow`, a running offer
  included) and its commission rate — through `priceBundle(pricing, value, lines)` and
  `overCeiling(...)` (`lib/bundle-pricing.ts`), the same functions checkout runs.
- Cover posters: one `Clip` query for the albums' `coverClipId`s.
- Signed in: `Entitlement.count` of the bundle's albums the buyer already owns (not revoked).

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «اشترِ الحزمة» (gold, full width) | plain `<a>` → [`/cart/add?bundle=<slug>`](cart-add.md) | every live album of the bundle the buyer does not already own goes into the cart; then `/cart`. Signed out → sign-in, then back to the same add |
| Album cards | `AlbumCard` links | the album page |

## States
- **Running and buyable** — header: title, description (if any), «ألبومات الحزمة: N · {clips}»;
  price block: «بشرائها منفصلة» struck through, «سعر الحزمة» in gold, «توفّر» in success
  colour, the button, «تُضاف ألبومات الحزمة إلى سلتك، ويُطبَّق سعرها تلقائياً.», and
  «ينتهي العرض {date}» when it has an end.
- **Buyer owns some** — a warning line: «تملك {count} من ألبومات هذه الحزمة. سعر الحزمة يحتاج
  كل ألبوماتها في طلب واحد، فتُضاف البقية بسعرها العادي.»
- **Ended** (`endsAt` passed) — the albums still show; the price block says «انتهى عرض هذه
  الحزمة.», no button.
- **Unavailable** — an album is no longer live or priced, or the discount now exceeds
  Laqta's share on an album (a price or rate changed since it was saved): «هذه الحزمة غير
  متاحة حالياً.», no button. Only live albums are carded.
- **Not found** — no such slug, switched off, or not started yet → 404.

## Invariants
- The page never promises a price the cart will not give: same prices, same arithmetic,
  same ceiling as `checkout()`.
- Money is the only gold on the page (the bundle price and the one primary button).
- Copy: `bundle.*` (editable at `/admin/content/copy/checkout`).

## Verified by
`verify:bundles` (the arithmetic, the ceiling, checkout). Not in `verify:arabic` / `audit`
— a bundle page needs a bundle, and the seed has none.
