# Location index

**Route** `/locations` · **Access** public · **Rendering** server component (`TaxonomyIndex kind="location"`), dynamic

## Purpose
List every active location as a tile with a count, as the entry point to the location hubs — the main differentiator against the global libraries.

## Data in
- `Taxonomy` where `kind='location'` AND `isActive=true`, ordered by `sortOrder asc`.
- Selects `slug`, `nameAr`, `nameEn`, `heroImage`, `_count.albums`, `_count.clipsAtLocation`.
- Displayed number is `_count.albums + _count.clipsAtLocation`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Location tile | Link | `/locations/{slug}` |

Read-only. Identical component to `/categories`, differing only in `kind`.

## States
- **No active locations** — empty grid; no `EmptyState` on this surface.
- **No hero image** — tile renders without the background image.

## Invariants
- Only active taxonomy entries are listed.
- The count is a raw relation count, not a count of live albums or ready clips.

## Verified by
`verify:arabic`, `audit`.
