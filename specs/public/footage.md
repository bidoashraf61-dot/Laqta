# Footage search

**Route** `/footage` · **Access** public · **Rendering** server component, dynamic (reads `searchParams`, writes a log row per query)

## Purpose
The clip-level search and filter surface: a buyer finds a shot here, then buys the album that contains it.

## Data in
- `search(filters)` from `lib/search.ts` (Postgres driver). `Clip` where `album.status='live'` and `ingestStatus='ready'`, plus every active facet.
- Free text resolves twice: literal `contains` (case-insensitive) on `Clip.titleAr/titleEn/descriptionAr/descriptionEn` and `Album.titleAr/titleEn`, OR membership of any `Taxonomy` the query matched. Taxonomy matching runs `normaliseArabic` over `nameAr`, `nameEn`, `slug`, `synonymsAr`, `synonymsEn` — this is the cross-language hop ("AlUla" ↔ العلا).
- Ordering: `relevance` → `album.salesCount desc, orderIndex asc`; `newest` → `createdAt desc`; `popular` → `album.salesCount desc, createdAt desc`; `priceAsc`/`priceDesc` → `album.priceStandard`.
- Pagination: `perPage` clamped to 1..60, default 24.
- `auth()` for the session, used only to attribute the search log.
- `logSearch()` writes `SearchQueryLog` (`query`, `normalized`, `locale='ar'`, `resultCount`, `filtersJson` with `q` stripped, `userId`). Wrapped in try/catch — a logging failure never breaks the page. Only fires when `q` is non-empty.
- `Clip.masterKey` is explicitly not selected.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Header search field (`SearchEntry`) | Client push | `/footage?q=…` |
| Cleared-for-commercial checkbox | `FilterRail` → `router.push` | Sets `?cleared=1` → `album.clearedForCommercial=true` |
| Editorial-only checkbox | `router.push` | `?editorial=1` → `album.clearanceStatus='editorial_only'` |
| Resolution chips (1080p/4K) | `router.push` | `?minWidth=1920\|3840` → `Clip.width >= n`. 6K was removed — no generation model produces it, so the chip was an unverifiable spec claim. |
| Aspect chips | `router.push` | `?aspect=16:9\|9:16\|1:1\|2.39:1` |
| Frame-rate chips | `router.push` | `?fps=24\|25\|30\|50\|60` |
| Colour-profile chips | `router.push` | `?colour=D-Log\|S-Log3\|Rec.709` |
| Camera-movement chips | `router.push` | `?movement=Drone\|Gimbal\|Handheld\|Static\|Slider\|Crane` |
| Shot-size chips | `router.push` | `?shot=Wide\|Medium\|Close-up\|Aerial` |
| People checkboxes | `router.push` | `?people=1` / `?people=0` / `?faces=1` |
| Clear filters | `router.push` | Drops every param except `q` |
| Sort links | Server-rendered `<Link>` | Rewrites `?sort=…` and drops `page` |
| Pagination prev/next | Server-rendered `<Link>` | Rewrites `?page=…` |
| Clip card image/title | Link | `/footage/{clip.slug}` |
| Clip card album ribbon | Link | `/albums/{creatorHandle}/{albumSlug}` |

No server action mutates anything on this route; the only write is the search log.

## States
- **No results** — `EmptyState` with `catalogue.noResultsTitle` / `catalogue.noResultsBody`. The query is still logged (with `resultCount=0`), which is the content-acquisition signal.
- **Single page** — pagination block is not rendered when `totalPages <= 1`.
- **Filter facets are hard-coded** — the chip values in `FilterRail` are literals, not derived from the data, so a chip can exist with zero matching clips.
- **`matchedTaxonomy` is computed but unused** — `SearchResult.matchedTaxonomy` is returned by `search()` and never rendered; there is no "did you mean" UI.
- **Not wired**: `minPrice`/`maxPrice` and `tags` exist in `ClipFilters` (tags read from `?tag=`), but no control in `FilterRail` sets a price range.
- **Search engine** — Postgres today. `SearchDriver` is the boundary for a future Meilisearch driver; nothing in the route layer changes when it lands.

## Invariants
- `/locations` and `/categories` **308 to this page**. Both indexes were walls of tiles that mostly read "0" on a launch-scale catalogue — pages whose whole job was to advertise how little there is. Browsing by location or category is a FILTER and now composes with every other facet instead of being a separate journey.
- The redirects live in `next.config.mjs`, NOT as `redirect()` in a page. A render-time redirect on a statically generated route served the destination's HTML at the original URL — a 200 duplicate, which is worse for search than the page it replaced. Verified in a browser before switching: URL unchanged, status 200.
- The individual hubs (`/locations/[slug]`, `/categories/[slug]`) are NOT redirected and stay in the sitemap at 0.9. They carry ~2,590 words each and `sitemap.ts` calls them the main organic differentiator.
- The landing footage wall carries a view-all control to this page; without it the wall is a dead end at twelve tiles.
- Facets now cover: cleared/editorial, resolution, aspect, frame rate, colour profile, camera movement, shot size, **duration**, **time of day**, **season**, people, faces, plus taxonomy (location/category/tag). Benchmarked against arabsstock (resolution, FPS, length, usage, licence, country), Artlist (theme, shot type, people) and Envato (orientation, resolution, frame rate, duration, time of day).
- **Duration is buckets, not a slider.** The buckets are the jobs — a six-second social bumper versus a thirty-second establishing hold — and a two-handled range control is the least usable widget on a touch screen.
- Duration is one visible choice backed by TWO params (`dmin`/`dmax`), so it bypasses the generic `toggle` and writes both in a single history entry; going through `setParam` twice would push two entries for one click.
- Every option table carries an English label alongside the Arabic so an English surface can reuse the same vocabulary instead of inventing a second one that drifts.
- Clip thumbnails carry a real `alt` from `catalogue.altClipThumb`. Previously `alt=""`, which §A4 bans.
- Only `live` albums are searchable — a draft or in-review album in results is a 404 with extra steps.
- Only `ingestStatus='ready'` clips are searchable.
- Every clip result carries its album ribbon (album title, price, clip count, clearance). Stripping the ribbon teaches buyers they are buying one clip and breaks them at checkout.
- `Clip.masterKey` never leaves the search module.
- Every thumbnail carries `PreviewWatermark`.
- URL is the single source of truth for the result set — a filtered view must stay shareable and server-rendered.

## Verified by
`verify:search` (Arabic stemming, transliteration, filters), `verify:arabic`, `audit`.
