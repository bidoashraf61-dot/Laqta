# Admin overview

**Route** `/admin` · **Access** admin only (middleware `requiredAccess` + `(admin)/layout.tsx` re-guard + `requireAdmin()` in the page) · **Rendering** server, dynamic (uses `auth()`; no `revalidate` / `dynamic` export)

## Purpose
The operator's landing screen: how much work is queued right now, what is past its
review SLA, and the 30-day platform totals underneath.

## Data in
- `ReviewTask` — top 6 open tasks (`status in [unassigned, assigned, in_progress]`),
  ordered `slaDueAt asc, submittedAt asc`; includes `album` (id, titleAr, titleEn,
  clipCount, `creator.displayNameAr`).
- Counts, all unfiltered by date:
  - `Album.count({ status: 'live' })`
  - `Creator.count({ status: 'pending' })`
  - `Dispute.count({ status in [open, investigating] })`
  - `Payout.count({ status: 'requested' })`
  - `ReviewTask.count({ status in OPEN, slaDueAt < now })` — the overdue badge.
- `lib/analytics.summary({}, 30)` → `AlbumStat` aggregate over the last 30 days plus
  the preceding 30 for the delta (views, purchases, revenue, cartAdds).
- `lib/analytics.platformTrend('revenue', 30)` → `AlbumStat` grouped by `day`,
  gap-filled to one point per day.

## Controls
Read-only surface. Every interactive element is navigation.

| Control | Action | Effect |
| --- | --- | --- |
| «التحليلات» header button | link | → `/admin/analytics` |
| Workload tile — review | link | → `/admin/review` |
| Workload tile — creators | link | → `/admin/creators` |
| Workload tile — disputes | link | → `/admin/disputes` |
| Workload tile — payouts | link | → `/admin/payouts` |
| Queue panel «المزيد» | link | → `/admin/review` |
| Queue row | link | → `/admin/review/{taskId}` |

## States
- **Not signed in** → middleware redirects to `/sign-in?callbackUrl=/admin`; the layout
  repeats the redirect.
- **Signed in, role ≠ admin** → middleware *rewrites* to `/forbidden` (URL preserved);
  the layout would `redirect('/forbidden')`.
- **Empty queue** — the panel renders `dash.queueEmpty` ("القائمة فاضية — ما فيه شي للمراجعة")
  instead of a list.
- **No analytics history** (`trend` all zeros) — the revenue panel renders `EmptyState`
  with `dash.noData` / `dash.noDataHint` rather than a flat chart.
- **Overdue reviews > 0** — the review tile grows a destructive-tone line with the
  overdue count and `dash.overdue`.
- **Loading** — no route-level `loading.tsx`; the page is a single awaited
  `Promise.all`, so navigation blocks until data resolves.
- **Error** — no local error boundary; failures fall through to the app-level one.

## Invariants
- Read-only: nothing here mutates. No money, no entitlement.
- All trend/summary numbers come from the `AlbumStat` daily rollup, never computed
  live from `Order` or `Download`.
- The review workload tile shows `queue.length`, which is **capped at the `take: 6`
  fetch** — it is the number of rows displayed, not the true open-task count. The
  overdue figure beside it *is* a real `count()`.

## Verified by
`verify:arabic` (route listed), `audit` (route listed). Not covered by `verify:flows`.
