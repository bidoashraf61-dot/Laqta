# Album detail (PDP)

**Route** `/albums/[creator]/[slug]` · **Access** public · **Rendering** server component, dynamic

## Purpose
The conversion page: show every clip in the album, both licence prices, and the clearance status, then hand the buyer to `/cart/add`.

## Data in
- `Album` where `slug = params.slug` AND `status='live'` AND `creator.handle = params.creator`. Full record via `include`.
- `creator` → `handle`, `displayNameAr/En`, `bioAr`, `city`, `country`.
- `licenceVersion` → `titleAr`, `bodyAr` (the licence text in force for this album).
- `taxonomy` → `AlbumTaxonomy → Taxonomy` (`kind`, `slug`, `nameAr`).
- `clips` — **all** clips ordered by `orderIndex`, selecting `slug`, titles, `durationS`, `width`, `height`, `fps`, `codec`, `colourProfile`, `aspectRatio`, `thumbnailKeys`. `masterKey` explicitly not selected.
- Second query: up to 4 other live albums by the same `creatorId`, plus their cover posters.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Creator name | Link | `/creators/{handle}` |
| Taxonomy badge | Link | `/locations/{slug}` or `/categories/{slug}` by `kind` |
| Clip tile | Link | `/footage/{clip.slug}` |
| Licence tier radio (`LicencePicker`) | Client state only | Swaps the displayed price between `priceStandard` and `priceExtended` and rewrites the buy link's `tier` param. No server call |
| "اشترِ الألبوم" | Link | `/cart/add?album={creatorHandle}/{albumSlug}&tier={standard\|extended}` |
| "أي ترخيص أحتاج؟" popover | Client | Shows the standard vs extended explanation |
| Other-album card | Link | `/albums/{creatorHandle}/{slug}` |

## States
- **Not found / not live / wrong creator handle** — `notFound()` → 404; metadata falls back to `state.notFound`.
- **Editorial-only album** (`clearanceStatus='editorial_only'`) — the Extended tier option is not rendered at all, in the picker and in the cart line. Hidden rather than shown-and-rejected at checkout.
- **Clearance display** — `clearedForCommercial` → success badge; else `editorial_only` → warning badge; else neutral `clearancePending`.
- **No trailer** — `Album.trailerUrl` exists in the schema but is not read here. The "trailer slot" is the first clip's poster; the auto-cut trailer pipeline does not exist. If there is no clip poster at all, a gradient wordmark stands in.
- **No licence version** — the licence paragraph is omitted.
- **Sole album by this creator** — the "other albums" section is hidden.

## Invariants
- The page leads with the album **trailer** (`Album.trailerKey`), because a buyer judges an album by how it cuts, not by one frame. Where no trailer exists the cover still stands in — an empty player reads as broken rather than as "not made yet".
- Only `status='live'` albums are reachable; a live album must be matched by both slug and creator handle.
- The full clip list is shown — total transparency about what is bought is the pitch against a subscription.
- Extended licence is unavailable for editorial-only albums, everywhere.
- `Clip.masterKey` is never selected on a catalogue surface.
- The album cover and every clip tile carry `PreviewWatermark`; the `catalogue.previewWatermarked` badge states it.
- Both prices come from `Album.priceStandard` / `priceExtended` — nothing on this page computes a price.
- `Product`/`Offer` JSON-LD is server-rendered.

## Verified by
`verify:arabic` (via `/albums/yousef-shami/alula-golden-hour-aerials`), `audit`.
