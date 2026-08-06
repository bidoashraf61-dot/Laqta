# Platform analytics

**Route** `/admin/analytics` · **Access** admin only · **Rendering** server, dynamic (`searchParams` + `auth()`)

## Purpose
Platform-wide version of the creator analytics view: totals, trends, funnel and the
category split of the library over a 7 / 30 / 90-day window.

## Data in
- `searchParams.days`, coerced by `resolveDays` to one of `7 | 30 | 90`; anything else
  falls back to `30`.
- `lib/analytics.summary({}, days)` — `AlbumStat` aggregate for the window and the
  equal-length window before it (views, purchases, revenue, cartAdds, deltas,
  conversion = purchases / views).
- `lib/analytics.platformTrend('views' | 'revenue' | 'purchases', days)` — three
  `AlbumStat` group-by-`day` series, gap-filled.
- `lib/analytics.topAlbums({}, 'revenue', days, 10)` — `AlbumStat` grouped by `albumId`
  ordered by summed revenue, then `Album` lookup for slug/titles/creator handle.
- `Taxonomy` — `kind: 'category', isActive: true`, `orderBy sortOrder asc`, `take: 8`,
  with `_count.albums`. Rows with zero albums are dropped client-side of the query.

## Controls
Read-only surface apart from the range picker.

| Control | Action | Effect |
| --- | --- | --- |
| `RangePicker` (7 / 30 / 90) | plain `<a>` to `?days=N` | full navigation; the server re-queries at the new window |
| Top-album title | link | → `/albums/{creator.handle}/{album.slug}` (public album page) |

## States
- **No history** — if every point of the `views` series is zero the whole body is
  replaced by one `EmptyState` (`dash.noData` / `dash.noDataHint`); the stat tiles,
  charts, funnel and table are not rendered at all.
- **No categories with albums** — the category panel renders `dash.noData` text instead
  of the donut.
- **`topAlbums` row whose album was deleted** — `row.album` is undefined and the row is
  skipped (renders `null`).
- **Invalid `?days=`** — silently treated as 30, no error.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- Every number is read from the `AlbumStat` rollup. No recomputation from `Order`.
- `revenue` on `AlbumStat` is booked ex-VAT; nothing here re-derives commission or
  creator net.
- Read-only: no mutation reachable from this route.

## Verified by
`verify:arabic`, `audit`. Not covered by `verify:flows`.
