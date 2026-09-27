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
- **On offer** (DEV-60) — a card shows the offer price, the regular struck and «{n}% خصم» + the label only while the offer runs (`lib/offers.priceNow`); a scheduled or ended offer shows the regular price.
- **Empty** — `EmptyState` with `state.empty`.
- **Album count** — rendered in the subheading via `formatNumber(albums.length)`, i.e. the number of live albums returned, not a total.
- **No cover clip / unresolvable key** — `AlbumCard.CoverImage` falls back to a themed gradient with the wordmark rather than a broken image.
- **Unbounded** — no pagination; the page grows linearly with the catalogue.

## Invariants
- When the free sample is public, a banner above the grid reads «جرّب قبل ما تشتري: {clips} مجاناً من ألبومات لقطة.» with «شوف العيّنة» → [`/sample`](sample.md). Hidden otherwise.
- Header: `PageTitle` (Serif Display Bold) over the subtitle set in `<Prose>` (Serif Text), the site-wide head composition — not a muted Sans line.
- Album cards render as a flat, cover-led **5:7 poster** (`components/catalogue/album-card.tsx`), not a 16:9 thumbnail. It was a faux-3D "pack" (hinged spine/lid) but read as fake with no real cover art — it is now a clean poster that drops straight into a real cover image when one is uploaded. The offer is «تشتري مرة واحدة وتملكها للأبد»; a thumbnail is the grammar of something you stream, a poster of something you own. Each album's accent colour is derived from its slug, so it is the same on every surface. The card is a container with a **stretched** album anchor plus a **sibling** creator-name anchor (→ `/creators/{handle}`) lifted above it — never nested links. The `.pack-*` CSS in globals.css is now unused.
- Album cover images carry a real `alt` built from `catalogue.altAlbumCover` («ألبوم {album} — {count} لقطة سعودية»). `docs/content/website-content.md` §A4 bans an empty alt; these shipped as `alt=""`.
- Only `status='live'` albums appear.
- Every card shows a price — the albums-only positioning collapses without it.
- Every cover carries `PreviewWatermark`.

## Verified by
`verify:arabic`, `audit`.
