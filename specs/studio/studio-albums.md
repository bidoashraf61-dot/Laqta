# Album manager

**Route** `/studio/albums` · **Access** creator or admin (`requireCreator`; no `creatorId` → `/sell`) · **Rendering** server, dynamic (reads `searchParams`)

## Purpose
The creator's working list of their own albums — state, size, price, traffic — plus
the one control that needs no review round trip: pause and resume.

## Data in
- `Album.findMany` where `creatorId` = session creator, `orderBy updatedAt desc`, **no pagination**; selects `id, titleAr, titleEn, status, clipCount, priceStandard, currency, updatedAt`.
  - `?status=` is applied only if it is a member of `statusValues('album')` (`draft`, `in_review`, `changes_requested`, `live`, `paused`, `delisted`); otherwise ignored.
  - `?q=` matches `titleAr` OR `titleEn`, `contains`, `mode: 'insensitive'` (plain SQL contains — not the Arabic-folding search of `lib/search.ts`).
- `Album.groupBy(['status'])` for the creator — the counts on the filter chips (unfiltered by `q`).
- `AlbumStat.groupBy(['albumId'])` for the creator, summing `views` and `purchases` — **all-time**, no day filter.

## Controls
| Control | Action | Effect |
|---|---|---|
| «ألبوم جديد» (header + empty state) | Link → `/studio/albums/new` | Navigation only |
| Search box | GET form / debounced `router.replace` writing `?q=` | Re-queries the list server-side; other params ride along as hidden fields |
| Status filter chips | Plain `<a>` to `?status=…` (or cleared) | Re-queries; `page` param dropped |
| Row title | Link → `/studio/albums/{id}` | Navigation only |
| «إيقاف مؤقت» (status `live`) | `setAlbumVisibility(id, 'paused')` — `ActionButton` | Album leaves the catalogue immediately; `AuditLog` `album.pause`; toast + `router.refresh()` |
| «استئناف» (status `paused`) | `setAlbumVisibility(id, 'live')` | Album returns to the catalogue; `AuditLog` `album.resume` |
| «فتح الألبوم» (any other status) | Link → `/studio/albums/{id}` | Navigation only |

## States
- **Empty (no albums at all, or filters match nothing)** — `EmptyState` with a «ألبوم جديد» button; the toolbar stays visible so a filter can be cleared.
- **Pending** — `ActionButton` disables itself and swaps the icon for a spinner while the action is in flight.
- **Action error** — the action returns `{ ok:false, message }` and the client raises an error toast; the row is unchanged. Refused when the album is not owned (`studio.albumMissing`) or is not currently `live`/`paused` (`state.error`).
- **Admin viewing this page** — an admin *with* a creator profile sees only their own albums (the query is always scoped by `creatorId`); an admin without one is redirected to `/sell`.
- **No `loading.tsx`** — the three queries resolve before first paint; the toolbar's own transition is the only progressive feedback.

## Invariants
- A `delisted` album whose latest `ReviewTask.decision` is `reject` shows a destructive «لم يُقبل» badge instead of the generic status, so a rejection is visible from the list; the row links to the album, where the reason is.
- `setAlbumVisibility` re-resolves the creator from the session and scopes by `creatorId` (admins bypass the scope) — rendering the page is not the authorisation boundary.
- Visibility moves only between `live` and `paused`. Anything re-entering the catalogue from another state must pass through review; this control cannot publish.
- Price is displayed, never editable here. It is the price the operator set at approval; an unpriced album (`priceStandard = 0`, every album before approval) shows «يُحدَّد السعر عند الاعتماد» in muted text instead of an amount (DEV-09).
- Pausing an album does not touch anything already sold: entitlement is served from `OrderItem.clipManifestSnapshot`, so a buyer's library is unaffected.

## Verified by
`verify:flows` (search narrows the list and writes `q=`; the status chips navigate and mark themselves current; no console errors), `verify:arabic`, `audit`.
