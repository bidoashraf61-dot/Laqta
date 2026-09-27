# Add to cart

**Route** `/cart/add` · **Access** public entry, requires authentication to complete · **Rendering** server component, dynamic; renders nothing (always redirects)

## Purpose
A GET landing that adds one album to the signed-in buyer's cart and bounces to `/cart`, so the PDP buy button can be a plain link that works before hydration.

## Data in
- `searchParams`: `bundle` (a bundle slug — DEV-62), or `album` (as `"{creatorHandle}/{albumSlug}"`) and `tier` (`standard` | `extended`, defaulting to `standard`).
- `auth()` for the session.
- `addToCart()` reads `Album` where `slug` AND `status='live'` AND `creator.handle` matches, selecting `id`, `priceStandard`, `priceExtended`.
- Upserts `Cart` by `userId` and `CartItem` by `(cartId, albumId)`, storing `licenceTier`, `unitPrice` from the album, `vatAmount` from `vatOn()`.

- With `bundle`: `addBundleToCart(slug)` reads the bundle (running only, `bundleRunningWhere`) with its albums, refuses it (`bundle.unavailable`) if any album is not live or priced, skips albums the buyer already owns (`Entitlement`, not revoked), and upserts the rest with their price now.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| (the route itself) | Server action `addToCart(album, tier)` in `app/(public)/cart/actions.ts` | Creates or updates the `CartItem`, then `revalidatePath('/cart')` |

No UI. This page never renders — every path ends in a `redirect()`.

## States
- **Missing both `album` and `bundle`** — `redirect('/albums')`.
- **Bundle added** — `redirect('/cart')`; **bundle refused** (not running, an album gone) — `redirect('/bundles/<slug>')`, which explains why.
- **Signed out** — `redirect('/sign-in?callbackUrl=/cart/add?album=…&tier=…')`, so the add replays after sign-in and nothing is lost.
- **Album not found or not live** — `addToCart` returns `cart.unavailable` and the route redirects to `/albums`; the reason is not surfaced to the buyer.
- **Success** — `redirect('/cart')`.
- **Tier not validated** — an arbitrary `?tier=` value is cast to `LicenceTier` without parsing; anything that is not `'extended'` is priced as standard, and the raw string is written to `CartItem.licenceTier` (a Postgres enum, so an invalid value throws rather than being rejected cleanly).
- **Editorial-only albums** — the extended-tier block is enforced in the UI (`LicencePicker`, `CartLine`), not here; this route will accept `tier=extended` for an editorial-only album.

## Invariants
- Adding to cart never freezes anything. The frozen commission and the `clipManifestSnapshot` are created only in `checkout()` (`lib/orders.ts`).
- Re-adding the same album updates the existing line rather than duplicating it.
- Only `status='live'` albums can enter a cart.

## Verified by
Not covered — no gate visits `/cart/add`.
