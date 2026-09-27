# Collection detail

**Route** `/collections/[slug]` · **Access** public · **Rendering** server component, dynamic

## Purpose
Show the albums in one published collection as poster cards.

## Data in
- `Collection` where `slug = params.slug` AND `isPublished=true`, including `CollectionAlbum` ordered by `sortOrder asc` with the joined `Album` (`slug`, `status`, titles, `priceStandard`, `currency`, `clipCount`, `totalRuntimeS`, `clearedForCommercial`, `coverClipId`, `creator.handle`, `creator.displayNameAr`).
- Albums are filtered to `status='live'` **in application code**, not in the query.
- Second query resolves cover posters from `Clip.thumbnailKeys[0]`.

- **SEO (DEV-33)** — `alternates: localeAlternates(path)`: canonical is this page in this language, hreflang names both; `og:locale` via `ogLocale()`; `generateMetadata` resolves the locale first. Checked by `verify:seo`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Album card | Link | `/albums/{creatorHandle}/{slug}` |

Read-only.

## States
- **Unknown slug or unpublished** — `notFound()` → 404; metadata returns `state.notFound`.
- **All member albums non-live** — `EmptyState` with `state.empty`, even though `/collections` advertised a non-zero album count for this collection.
- **No `descriptionAr`** — description paragraph omitted.
- `Collection.heroMedia` is not rendered on this page (only on the index tile).

## Invariants
- A collection with no live albums is **`noindex, follow`**. Dropping it from the sitemap is not enough on its own: a page merely absent from the sitemap can still be found and indexed through an internal link. `follow` stays on so the crawler still walks through to what it links.
- Only live albums are shown, regardless of what the collection contains.
- Every card shows a price and carries `PreviewWatermark` on its cover.

## Verified by
`verify:arabic` (via `/collections/saudi-heritage`), `audit`.
