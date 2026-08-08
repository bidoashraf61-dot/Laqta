# Landing

**Route** `/` · **Access** public (signed-out and signed-in) · **Rendering** server component, dynamic (two DB reads per request, no caching directives)

## Purpose
Sell the albums-only model to a first-time buyer: a scroll-scrubbed hero film, a wall of real frames from across the catalogue, and the album shelf — with every frame routing to a purchasable album.

## Data in
- `getFeaturedAlbums(6)` (`lib/catalogue.ts`) — `Album` where `status='live'`, ordered `isFeatured desc, featureRank asc, salesCount desc, publishedAt desc`, take 6. Cover posters resolved in one follow-up `Clip.thumbnailKeys[0]` query by `coverClipId`.
- `getFootageWall(12)` — `Clip` where `album.status='live'`, ordered `album.salesCount desc, orderIndex asc`, take 48 (`take*4`), then re-woven round-robin per album down to 12 tiles. Each tile carries its album's `slug`, `titleAr/En`, `priceStandard`, `currency`, `clipCount`, `clearedForCommercial`, `creator.handle`.
- No stats query. `getCatalogueStats()` exists in `lib/catalogue.ts` but this page does not call it — nothing on the landing counts clips, albums or creators out loud.
- `Clip.masterKey` is never selected.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Footage-wall tile (`components/landing/footage-wall.tsx`) | Link | Navigates to `/albums/{creatorHandle}/{albumSlug}` — never to a clip page or a clip checkout |
| Album card in "The Collection" | Link | `/albums/{creatorHandle}/{slug}` |
| Licensing CTA | Link | `/licences` |
| Creator CTA (`CreatorCta`) | Link | `/sell` |
| Waiting-list form (`EmailCapture`) | Server action `captureEmail` in `app/(public)/actions.ts` | Upserts a `CmsEntry` of `kind='landing_copy'`, `slug='waitlist:{email}'`, `status='draft'`; idempotent by email |
| Hero film | Client scroll scrub, no navigation | `currentTime` tracked to wrapper scroll progress; read-only |

## States
- **Empty catalogue** — `FootageWall` returns `null` (section disappears entirely) when there are no tiles; `TheCollection` renders `EmptyState` with `state.empty`.
- **Waiting list, invalid email** — `landing.notifyInvalid` alert; the address is never reported as already-registered (deliberate anti-enumeration).
- **Waiting list, storage failure** — generic `auth.somethingWentWrong`, not an "invalid email" message.
- **Waiting list, success** — form is replaced by the `landing.notifyThanks` success alert.
- **Pending** — submit button shows `state.loading` while the transition runs.
- **Reduced motion** — the hero does not scrub; poster and server-rendered `<h1>` stand.
- **Mobile** — hero loads `/hero/vid/hero-web-m.mp4` (720p) instead of `hero-web.mp4`.
- **Hero video missing** — `public/hero/vid/` is gitignored; on a fresh checkout the `<video>` has no source and only the poster/copy render.
- **Testimonial is a placeholder** — `landing.testimonialQuote/Name/Role` in `messages/ar.json` are not a real customer quote; flagged in-code as must-replace before launch.

## Invariants
- The testimonial is the LAST content section, after the creator pitch rather than inside the album band. Its copy is still a placeholder — a fabricated testimonial is a trust and legal risk, so it must be swapped for a real attributable quote before launch.
- `RequestFootage` turns the catalogue's dead end into its strongest feature: on a shot library "we don't have that" is permanent, here it is a production job. No account required to submit.
- FAQ blocks emit `FAQPage` JSON-LD generated from the SAME dictionary keys the component renders (`components/catalogue/faq-schema.tsx`). Google treats a mismatch between marked-up and visible answers as spam, so the schema must never be hand-written alongside the copy. Kashida is stripped from the marked-up strings.
- Footage tiles play a muted loop on hover. The `<video>` is created on FIRST hover, not at mount — twelve tiles is twelve decoders, and Safari caps simultaneous decoders per page. Play is triggered from an effect, never the event handler: on first hover React has not committed the element yet, so a handler-side `play()` hits a null ref and the tile silently stays a still.
- A tile with no `previewKey` stays a poster. `previewKey` is NULL unless the stored proxy is a real URL (`/`-rooted) — an object-storage key would render a black rectangle where a photograph was.
- Hover is never the only route: the whole tile is a link and an explicit «افتح الألبوم» control is shown, because hover does not exist on touch. Under `prefers-reduced-motion` the loop never starts.
- **Special offers render nothing when no album is on offer.** `getOfferAlbums()` filters `compareAtPrice != null`; an "offers" heading over an empty grid advertises that there are none.
- The struck-through number is the stored `compareAtPrice`, never a recomputed percentage — a percentage can drift from what was actually charged. `priceStandard` is always what the buyer pays.
- The saving is stated in words as well as shown by the strike (`landing.offersHint`), because assistive tech announces `<s>` inconsistently.
- Light/dark is a **user preference**, applied to `html.dark` by an inline pre-paint script (`lib/theme.ts`) so the page never flashes the wrong theme. Default is `system`; only an explicit pick is persisted, so "follow my OS" survives as an absence rather than a stored guess. The olive and dusty band scopes are theme-stable by design.
- Resolution claims: **1080p ships today, 4K is the ceiling.** 6K was removed everywhere — no generation model produces it, so it was an unverifiable spec claim on a page a buyer checks.
- The collection band renders album **packs** (5:7 boxed products), not 16:9 cards — see specs/public/albums.md.
- **No page on this site may claim the footage was filmed in the Kingdom or that permits were cleared.** The catalogue is AI-generated (`docs/website-content.md` §0). `landing.heroBody`, `landing.solution1Body` and `landing.collectionBody` all carried that claim and were corrected; the landing FAQ's permits guarantee was replaced with the AI disclosure (`landing.faq4Q/A`).
- The AI disclosure appears in the footer of every route via `brand.aiNotice`, so no page can be reached that does not carry it.
- A clip is bait; the album is the product. Every tile on the wall links to an album and shows that album's price. No surface on this page may offer a single clip for sale.
- Every preview frame is watermarked via `PreviewWatermark`; no un-marked preview may ship.
- Album cards always show a price (`AlbumCard` treats the price as non-optional) — a price-less card reads as a subscription catalogue.
- Tiles honour the clip's real aspect ratio (`9:16`, `1:1`, `4:5`, `2.39:1`); forcing 16:9 is banned by the design system.
- One Voice Rule: gold appears only on the price chip, and on the wall only for the hovered tile.
- Fully server-rendered — nothing on the page may require client JS to become visible.

## Verified by
`verify:hero` (the film mounts, scrubs both ways, stays bounded), `verify:arabic`, `audit`.
