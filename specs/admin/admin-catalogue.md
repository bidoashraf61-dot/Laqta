# Catalogue

**Route** `/admin/catalogue` · **Access** admin only · **Rendering** server, dynamic (`searchParams` + `auth()`)

## Purpose
Everything that has been through review, with the two escalations that skip the queue —
pause (reversible) and delist (final) — plus feature toggling and a read-only view of the
price bands.

## Data in
- `searchParams.q` — case-insensitive `contains` over `titleAr`, `titleEn`,
  `creator.displayNameAr`.
- `searchParams.status` — accepted if in `statusValues('album')`
  (`draft, in_review, changes_requested, live, paused, delisted`); otherwise the default
  filter `status in [live, paused, delisted]` applies. Note: filtering explicitly by
  `draft` / `in_review` **is** possible via the chips even though the default hides them.
- `Album.findMany` — `orderBy [isFeatured desc, publishedAt desc]`, `take: 100`,
  selecting id, slug, titles, status, clipCount, priceStandard, currency, isFeatured,
  salesCount, clearedForCommercial, `creator` (handle, displayNameAr).
- `Album.groupBy({ by: ['status'] })` — chip counts.
- `PriceBand.findMany({ orderBy: { priceStandard: 'asc' } })` — the bands panel
  (labelAr, minClips, maxClips, priceStandard, currency, extendedMultiplier).

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| `SearchBox` | GET form / `?q=` | re-queries the table |
| `FilterChips` | plain `<a>` to `?status=` | re-queries the table |
| Album title | link | → `/albums/{creator.handle}/{album.slug}` |
| «إيقاف» (only when `status === 'live'`) | `setAlbumStatus(id,'paused')` | `Album.status='paused'`. Audits `album.paused` |
| «استئناف» (only when `status === 'paused'`) | `setAlbumStatus(id,'live')` | `Album.status='live'`. Audits `album.live` |
| «تمييز» (hidden when delisted) | `toggleAlbumFeatured(id, !isFeatured)` | sets `isFeatured` and `featureRank` (`0` when featured, `null` when not); revalidates `/admin/merchandising` and `/` |
| «شطب» (hidden when delisted) | `setAlbumStatus(id,'delisted')`, native confirm | `Album.status='delisted'`, `delistedAt=now`. Audits `album.delisted` |
| Price bands table | — | **read-only**; there is no editor for `PriceBand` anywhere in the admin area |

## States
- **Empty result** — `EmptyState` with `state.empty` / `dash.catalogueHint`.
- **Delisted album** — every action button is hidden; the row is terminal from this
  surface. There is no un-delist control.
- **Cleared for commercial** — a small success-tone line under the title.
- **Featured** — a filled gold star beside the status badge.
- **Pending** — `ActionButton` spinner + disabled, then toast + `router.refresh()`.
- **Truncation** — hard `take: 100`, no pagination.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- Pausing or delisting an album **cannot break a completed purchase**: entitlement is
  served from `OrderItem.clipManifestSnapshot`, never re-derived from the album.
- Price bands are shown but not editable — changing a band would reprice live albums; the
  page states this in `dash.priceBandsHint`.
- Every mutation writes an `AuditLog` row.

## Verified by
`verify:arabic`, `audit`, `verify:flows` (filter-chip navigation on `/admin/catalogue`).
The entitlement snapshot rule is covered by `verify:entitlement`.
