# Collection index

**Route** `/collections` · **Access** public · **Rendering** server component, dynamic

## Purpose
List the editorially curated album collections published from `/admin/merchandising`.

## Data in
- `Collection` where `isPublished=true`, ordered `isFeatured desc, sortOrder asc`.
- Selects `slug`, `titleAr`, `titleEn`, `descriptionAr`, `heroMedia`, `_count.albums` (via `CollectionAlbum`).

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Collection tile | Link | `/collections/{slug}` |

Read-only.

## States
- **No published collections** — `EmptyState` with `state.empty`.
- **No `heroMedia`** — the tile renders without a background image.
- **No `descriptionAr`** — the description paragraph is omitted.
- The album count shown is the count of `CollectionAlbum` rows, **not** the count of live albums — a collection containing only drafted albums still advertises a non-zero number and then renders empty on its own page.

## Invariants
- Only `isPublished=true` collections are listed.

## Verified by
`verify:arabic`, `audit`.
