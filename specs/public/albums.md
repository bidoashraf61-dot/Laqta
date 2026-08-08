# Album index

**Route** `/albums` · **Access** public · **Rendering** server component, dynamic (reads `searchParams`)

## Purpose
The full shelf of live albums as poster cards, each showing its price.

## Data in
- `Album` where `status='live'`, no pagination and no take limit — the whole live catalogue in one query.
- Ordering by `?sort`: `new` → `publishedAt desc`; `priceAsc` → `priceStandard asc`; anything else (default) → `isFeatured desc, salesCount desc`.
- Selects `slug`, titles, `priceStandard`, `currency`, `clipCount`, `totalRuntimeS`, `clearedForCommercial`, `coverClipId`, `creator.handle`, `creator.displayNameAr`.
- Second query resolves cover posters: `Clip.thumbnailKeys[0]` for the collected `coverClipId`s.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Album card | Link | `/albums/{creatorHandle}/{slug}` |

Read-only. **There is no sort UI on this page** — the `?sort` parameter is honoured by the query but no control renders it; it only works if typed into the URL or arrived at from an external link.

## States
- **Empty** — `EmptyState` with `state.empty`.
- **Album count** — rendered in the subheading via `formatNumber(albums.length)`, i.e. the number of live albums returned, not a total.
- **No cover clip / unresolvable key** — `AlbumCard.CoverImage` falls back to a themed gradient with the wordmark rather than a broken image.
- **Unbounded** — no pagination; the page grows linearly with the catalogue.

## Invariants
- Album cards render as a **pack** — a 5:7 boxed product with a hinged spine and lid (`.pack-*` in globals.css), not a 16:9 thumbnail. The offer is «تشتري مرة واحدة وتملكها للأبد»; a thumbnail is the grammar of something you stream, a box of something you own. Each album's pack colour is derived from its slug, so it is the same colour on every surface.
- Album cover images carry a real `alt` built from `catalogue.altAlbumCover` («ألبوم {album} — {count} لقطة سعودية»). `docs/website-content.md` §A4 bans an empty alt; these shipped as `alt=""`.
- Only `status='live'` albums appear.
- Every card shows a price — the albums-only positioning collapses without it.
- Every cover carries `PreviewWatermark`.

## Verified by
`verify:arabic`, `audit`.
