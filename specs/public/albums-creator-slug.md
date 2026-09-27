# Album detail (PDP)

**Route** `/albums/[creator]/[slug]` · **Access** public · **Rendering** server component, dynamic

## Purpose
The conversion page: show every clip in the album, both licence prices, and the clearance status, then hand the buyer to `/cart/add`.

## Data in
- `Album` where `slug = params.slug` AND `status='live'` AND `creator.handle = params.creator`. Full record via `include`.
- `creator` → `handle`, `displayNameAr/En`, `bioAr`, `city`, `country`.
- `licenceVersion` → `titleAr`, `bodyAr` (the licence text in force for this album).
- `taxonomy` → `AlbumTaxonomy → Taxonomy` (`kind`, `slug`, `nameAr`).
- `Album.trailerKey` — the album's own trailer: a key in the public media bucket (`trailers/<slug>.mp4`), a URL on the media CDN, or a "/"-rooted dev file. Resolved by `lib/media.ts#mediaUrl`.
- `Album.coverClipId` — picks the cover frame (the cover clip's first poster, else the first clip's).
- `clips` — **all** clips ordered by `orderIndex`, selecting `slug`, titles, `durationS` (serialised to a number for the client grid), `width`, `height`, `fps`, `codec`, `colourProfile`, `aspectRatio`, `thumbnailKeys`, `previewKey` (the clip's own watermarked preview). `masterKey` and `proxyKey` explicitly not selected.
- Every poster, preview and trailer key goes through `mediaUrl()`: "/"-rooted keys serve from `public/`; bucket keys resolve against `NEXT_PUBLIC_MEDIA_CDN_URL`, and to `null` when it is unset.
- Second query: up to 4 other live albums by the same `creatorId`, plus their cover posters.

- `buyableBundlesFor(album.id)` (`lib/bundles.ts`, DEV-62) — running bundles holding this album whose albums are all live and within Laqta's-share ceiling, with the saving.

- **Specs block** (DEV-20) opens with «طريقة الإنتاج» — «تصوير بالكاميرا» or «مُنتَج بالذكاء الاصطناعي» from `Album.origin` — and «الدقة» — `Album.resolution` (`uhd4k` → 4K, `hd1080` → 1080p, `sd720` → 720p), or, for an album with none declared, the widest clip (≥3840 → 4K, ≥1920 → 1080p, else 720p; no clips → «—»). The catalogue mixes filmed and generated albums and not all are 4K, so the page states both for this album.

- **SEO (DEV-33)** — `alternates: localeAlternates(path)`: canonical is this page in this language, hreflang names both; `og:locale` via `ogLocale()`; `generateMetadata` resolves the locale first. Checked by `verify:seo`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Creator name | Link | `/creators/{handle}` |
| Taxonomy badge | Link | `/locations/{slug}` or `/categories/{slug}` by `kind` |
| Trailer pause/play (`AutoplayVideo`, only when a trailer resolves) | Client | Pauses/resumes the muted trailer; its label follows the element's real state (`media.pause` / `media.play`). The trailer autoplays muted and looped once half of it is on screen, pauses when it leaves, and never autoplays under `prefers-reduced-motion` — the button is then the only way in. A «بلا صوت» chip states it is silent |
| Clip tile | Link (plain `<a>`) | `/footage/{clip.slug}` — hover or focus plays THAT clip's own preview in the tile |
| Licence tier radio (`LicencePicker`) | Client state only | Swaps the displayed price between `priceStandard` and `priceExtended` and rewrites the buy link's `tier` param. No server call |
| "اشترِ الألبوم" | Link | `/cart/add?album={creatorHandle}/{albumSlug}&tier={standard\|extended}` |
| "أي ترخيص أحتاج؟" popover | Client | Shows the standard vs extended explanation |
| Other-album card | Link | `/albums/{creatorHandle}/{slug}` |

## States
- **Part of a bundle** — under the price block, one line per buyable bundle: «ضمن حزمة» + title (link to `/bundles/[slug]`) «— وفّر مع الحزمة» + amount. None when the album is in no buyable bundle.
- **On offer** (DEV-60) — the licence panel shows the offer price with the regular price struck, only while the offer's dates are running (`lib/offers.priceNow`); outside them the regular price, no badge.
- **Not found / not live / wrong creator handle** — `notFound()` → 404; metadata falls back to `state.notFound`.
- **Editorial-only album** (`clearanceStatus='editorial_only'`) — the Extended tier option is not rendered at all, in the picker and in the cart line. Hidden rather than shown-and-rejected at checkout.
- **Clearance display** — `clearedForCommercial` → success badge; else `editorial_only` → warning badge; else neutral `clearancePending`.
- **Trailer** — `mediaUrl(album.trailerKey)` resolves → the 16:9 frame at the top is `AutoplayVideo` (`object-cover`, ink ground, poster = the cover frame, `aria-label` = `media.trailerAlt`). The player owns its watermark; no second overlay is drawn.
- **No trailer** — `trailerKey` is NULL, or is a bucket key with no CDN configured → the album's own cover still (`catalogue.altAlbumCover` alt) with `PreviewWatermark`. Never another album's footage or a hero segment: the seed's hero-loop stand-in trailers were removed (2026-09-24) and the dev database cleared of them. If there is no clip poster at all, a gradient wordmark stands in.
- **Trailer file fails to load** (CDN 404, network) → the player steps down to the poster with no play button, rather than a black box with a dead control.
- **`trailerUrl`** — a legacy column, unused and not read. `trailerKey` is the only trailer field.
- **No licence version** — the licence paragraph is omitted. Should not occur since DEV-06: every album gets the current licence at creation and approval, `npm run repair:licences` fills older ones, and `verify:licence` fails on any album without one.
- **Sole album by this creator** — the "other albums" section is hidden.

## Invariants
- The display-size clip count, the cover `alt` («ألبوم {album} — ٢٢ لقطة») and the licence panel («٢٢ لقطة في هذا الألبوم», `countLabel` + `catalogue.shotsIncluded`) all go through the plural helpers — Arabic number agreement, English one/other (DEV-22).
- When the free sample is public, a link «جرّب لقطات مجانية من العيّنة» → [`/sample`](sample.md) sits at the end of the buy panel.
- **«حمّل كل المعاينات (ZIP)»** in the buy panel (outline, under the licence list): every deliverable preview in the album as one ZIP, signed-in only (signed-out → sign in and return). The note states the count, watermark and 720p, and that the licence comes with purchase. Hidden when no preview is deliverable. Contract: [`../api/preview-download.md`](../api/preview-download.md).
- The page leads with the album **trailer** (`Album.trailerKey`), because a buyer judges an album by how it cuts, not by one frame. Where no trailer exists the album's own cover still stands in — an empty player reads as broken rather than as "not made yet", and someone else's footage would misrepresent the album.
- Trailers are set by the operator (`/admin/catalogue` → «التريلر») or by `npm run media:upload` from `.media/out/trailers/<slug>.mp4`; see `docs/tech/media-aws.md`.
- No public surface ever renders `proxyKey` (the buyer's clean editing copy) — previews come from `Clip.previewKey` only.
- Only `status='live'` albums are reachable; a live album must be matched by both slug and creator handle.
- The full clip list is shown — total transparency about what is bought is the pitch against a subscription.
- Extended licence is unavailable for editorial-only albums, everywhere.
- `Clip.masterKey` is never selected on a catalogue surface.
- The album cover and every clip tile carry `PreviewWatermark`; the `catalogue.previewWatermarked` badge states it.
- Both prices come from `Album.priceStandard` / `priceExtended` — nothing on this page computes a price.
- `Product`/`Offer` JSON-LD is server-rendered.

## Verified by
`verify:arabic` (via `/albums/yousef-shami/alula-golden-hour-aerials`), `audit`. The resolver rules (local, CDN, null, private-prefix refusal) are unit-tested in `tests/unit/media.test.ts`. The trailer-present state is covered by no gate — no seeded album has a trailer; it was checked by hand in a browser (desktop + 375px) on 2026-09-24.
