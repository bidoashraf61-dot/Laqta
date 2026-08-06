# Category index

**Route** `/categories` · **Access** public · **Rendering** server component (`TaxonomyIndex kind="category"`), dynamic

## Purpose
List every active category as a tile with a count, as the entry point to the category hubs.

## Data in
- `Taxonomy` where `kind='category'` AND `isActive=true`, ordered by `sortOrder asc`.
- Selects `slug`, `nameAr`, `nameEn`, `heroImage`, and `_count` of `albums` (`AlbumTaxonomy`) and `clipsAtLocation` (`Clip.location` relation).
- The displayed number is `_count.albums + _count.clipsAtLocation`. For a category that number is effectively the album count, since `clipsAtLocation` only populates for location rows.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Category tile | Link | `/categories/{slug}` |

Read-only.

## States
- **No active categories** — the grid renders empty; there is no `EmptyState` on this surface.
- **No hero image** — the tile renders without a background image.
- Inactive taxonomy rows (`isActive=false`) are excluded.

## Invariants
- Only active taxonomy entries are listed.
- The count shown is a raw relation count, not a count of live albums — it can overstate what the hub will show.

## Verified by
`verify:arabic`, `audit`.
