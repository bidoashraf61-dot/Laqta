# Studio analytics

**Route** `/studio/analytics` · **Access** creator or admin (`requireCreator`; no `creatorId` → `/sell`) · **Rendering** server, dynamic (reads `searchParams`)

## Purpose
Show one creator's catalogue performance over a 7/30/90-day window, with a
views → cart → purchases funnel that says where the drop happens.

## Data in
- `summary({ creatorId }, days)` — `AlbumStat` aggregate for the window plus the preceding window of equal length; yields `views`, `purchases`, `revenue`, `cartAdds`, `conversion` (`purchases/views × 100`) and percent deltas.
- `creatorTrend(creatorId, 'views' | 'revenue' | 'purchases', days)` — three separate `AlbumStat` `groupBy day` queries, zero-filled per day.
- `topAlbums({ creatorId }, 'revenue', days, 10)` — `AlbumStat` grouped by `albumId` ordered by summed revenue, then `Album` (`id, slug, titleAr, titleEn, creator.handle`).
- `days` comes from `?days=`, allow-listed to `7 | 30 | 90`; anything else falls back to `30`.

## Controls
| Control | Action | Effect |
|---|---|---|
| Range picker `٧ / ٣٠ / ٩٠ يوم` | Plain `<a>` to the same path with `?days=N` | Full navigation; every query re-runs at the new window. Selected chip carries `aria-current="true"` |
| Album title in the table | Link → `/studio/albums/{id}` | Navigation only |

No server actions. The surface is read-only.

## States
- **Empty** — if every point of the views trend is 0, the whole body is replaced by a single `EmptyState` (`dash.noData`); tiles, charts, funnel and table are not rendered at all.
- **Populated but no top albums** — table panel shows `dash.noData` inline.
- **Zero views with non-zero purchases** — `conversion` is defined as 0 rather than dividing by zero.
- **Delta against an empty previous window** — `pct()` returns 0 rather than infinity.
- **No creator profile** → `redirect('/sell')`. Role failures handled by the `(studio)` layout.
- **Loading** — no `loading.tsx`; the five queries are awaited together before first paint.

## Invariants
- Every chart reads the `AlbumStat` daily rollup. Time series are never computed live from `Order` or `Download`.
- `?days` is allow-listed — an arbitrary window is refused, not clamped, to keep the query indexed.
- Revenue shown is gross ex-VAT booked revenue (`AlbumStat.revenue`), not creator net; the frozen commission on `OrderItem` is what determines net, and it is not recomputed here.

## Verified by
`verify:arabic`, `audit`. `verify:flows` exercises the identical `RangePicker` on `/admin/analytics` only — the creator range picker is not directly asserted.
