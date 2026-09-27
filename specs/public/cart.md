# Cart

**Route** `/cart` · **Access** authenticated (any role) · **Rendering** server component, dynamic

## Purpose
Review the albums about to be bought, change licence tier in place, and go to checkout.

## Data in
- `auth()` for the session.
- `getCart(userId)` in `app/(public)/cart/actions.ts` — `Cart` by unique `userId`, including `CartItem` with the joined `Album` (`id`, `slug`, titles, `currency`, `clipCount`, `clearanceStatus`, `creator.handle`, `creator.displayNameAr`).
- Totals are summed in application code from the stored `CartItem.unitPrice` and `CartItem.vatAmount`; nothing is recomputed from the album at render time.
- Display currency is taken from the **first** item's album currency, defaulting to `'SAR'`.
- **Bundles (DEV-62)** — `getCart` also reads the cart's albums (`BUNDLE_ALBUM_SELECT`) and runs `resolveBundles(bundleLines(albums))`, exactly as checkout will. It returns `bundles` (`slug`, titles, `discount`, `albumIds`) and `bundleDiscount`; `subtotal` and `vatAmount` are after the bundle (VAT per line on `unitPrice − share`).

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Standard tier chip (`CartLine`) | Server action `setTier(albumId, 'standard')` | Rewrites `CartItem.licenceTier`, `unitPrice` from `Album.priceStandard`, `vatAmount` via `vatOn()`; `revalidatePath('/cart')` + `router.refresh()` |
| Extended tier chip | Server action `setTier(albumId, 'extended')` | Same, from `Album.priceExtended`. Hidden entirely when `clearanceStatus='editorial_only'` |
| Remove (trash icon) | Server action `removeFromCart(albumId)` | `CartItem.deleteMany` for this cart+album; `revalidatePath('/cart')` |
| "متابعة التسوق" (empty state) | Link | `/albums` |
| "إتمام الشراء" | Link | `/checkout` |
| «توفير الحزمة» + bundle title (in the totals card, per applied bundle) | Link | `/bundles/[slug]`; the saving shows as −amount in success colour above the subtotal |

## States
- **Price added** (DEV-60) — `addToCart` stores the price NOW (`priceNow`, offer included) as `unitPrice` for display; `checkout()` prices every album again when the order is placed, so an offer that ends in between is not charged.
- **Signed out** — `redirect('/sign-in?callbackUrl=/cart')` before any data is read.
- **Empty cart** — `EmptyState` with `cart.empty` / `cart.emptyHint` and a link to `/albums`; the totals card and checkout button are not rendered.
- **Pending mutation** — tier chips and the remove button are disabled while the transition runs.
- **Unauthenticated server action call** — `setTier`/`removeFromCart` return `{ ok: false, messageKey: 'auth.signIn' }`; the UI does not surface this message (it just refreshes).
- **Album no longer live** — `setTier` looks the album up by id without a `status` filter, so a delisted album's tier can still be changed here; the block happens later at `checkout()`, which requires `status='live'`.
- **Mixed currencies** — the totals are formatted with the first item's currency even if items differ; there is no currency-mixing guard.
- Cart lives in Postgres, not a cookie, so it follows the buyer between devices.
- **A bundle applies** — every album of a running bundle is in the cart: one «توفير الحزمة» row per bundle; the line prices stay as stored, the totals are after the saving. Remove one of its albums and the row disappears.

## Invariants
- Empty-state copy follows the Saudi register in `docs/content/brand-voice-ar.md` — «سلتك فاضية», never «فارغة»; «ما فيه», never «لا يوجد».
- One `CartItem` per (cart, album) — enforced by the `@@unique([cartId, albumId])` constraint and the upsert in `addToCart`.
- Prices displayed here are stored cart values; the authoritative freeze happens later, in `lib/orders.ts` at checkout. Nothing on this page may be treated as the frozen price.
- Editorial-only albums can never carry an Extended licence.
- VAT is derived by `vatOn()` from `VAT_RATE`, never typed in.

## Verified by
`verify:arabic`, `audit`. The tier/remove mutations themselves are not covered by `verify:flows` (which drives `/studio` and `/admin` only).
