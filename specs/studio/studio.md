# Studio overview

**Route** `/studio` · **Access** creator or admin (`requireCreator`; admin with no `creatorId` is redirected to `/sell`) · **Rendering** server, dynamic (session + live queries)

## Purpose
Tell the creator, in that order, whether anything needs their attention and whether
the catalogue is paying.

## Data in
- `Creator` — `findUnique` by session `creatorId`, selects `displayNameAr` only (the greeting).
- `getEarnings(creatorId)` (`lib/studio.ts`) — `CreatorLedger` rows for the creator, `orderBy createdAt desc`, `take 100`, plus `Payout` sum for statuses `paid|processing|approved`. Only `available` is used on this page.
- `summary({ creatorId }, 30)` (`lib/analytics.ts`) — `AlbumStat` aggregate over the last 30 days plus the preceding 30 for the deltas: `views`, `purchases`, `revenue`, `cartAdds`.
- `creatorTrend(creatorId, 'views', 30)` — `AlbumStat` grouped by `day`, gap days filled with zero.
- `topAlbums({ creatorId }, 'revenue', 30, 5)` — `AlbumStat` grouped by `albumId` ordered by summed revenue, then `Album` lookup for titles.
- `getDemandSignals(5)` — `SearchQueryLog` grouped by `normalized` where `resultCount = 0`, ordered by count desc. **Platform-wide, not creator-scoped.**
- Attention block: `Album` where `{ creatorId, status: 'changes_requested' }` (`take 5`), `Album.count` where `status: 'in_review'`, `Release.count` where `verification: 'pending'`.

## Controls
| Control | Action | Effect |
|---|---|---|
| «التحليلات» header button | Link → `/studio/analytics` | Navigation only |
| Changes-requested row | Link → `/studio/albums/{id}` | Navigation only |
| «مستندات بانتظار التحقق» row | Link → `/studio/releases` | Navigation only |
| «المزيد» on Top albums | Link → `/studio/albums` | Navigation only |

Read-only otherwise: no server action is invoked from this page.

## States
- **Nothing to do** — the attention panel renders `dash.allClear` rather than being hidden; the panel loses its `warning` accent.
- **No stats yet** — if every point in the 30-day view trend is 0 the chart is replaced by `EmptyState` (`dash.noData` / `dash.noDataHint`). Top albums and demand each fall back to their own one-line empty text independently.
- **No creator profile** — `user.creatorId == null` (an admin, or a user whose creator record was never created) → `redirect('/sell')`.
- **Not creator/admin** — the `(studio)` layout redirects to `/forbidden`; unauthenticated → `/sign-in?callbackUrl=/studio`. `requireCreator()` additionally throws `FORBIDDEN`/`UNAUTHENTICATED` if reached directly.
- **Loading** — no route-level `loading.tsx`; the page is a single awaited `Promise.all`, so navigation blocks until all seven queries resolve.

## Invariants
- Balance is displayed, never stored: `available` and `held` are derived from `CreatorLedger.availableAt` at read time (30-day hold), minus payouts already `approved|processing|paid`. Nothing on this page writes a balance.
- Commission is frozen at purchase; the revenue tile is gross `AlbumStat.revenue`, not a recomputed split.
- The demand panel shows other people's search strings (`SearchQueryLog.query`) — user text, rendered through `UserText`, never treated as markup.

## Verified by
`verify:arabic` (route in the Arabic sweep), `audit` (desktop + phone in real Chrome), `verify:flows` (mobile nav drawer opens on `/studio`), `verify:auth` (role matrix for `/studio`).
