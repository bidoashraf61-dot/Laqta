# Review queue

**Route** `/admin/review` · **Access** admin only · **Rendering** server, dynamic (`searchParams` + `auth()`)

## Purpose
The list of albums awaiting a review decision, ordered by how close each is to
breaching the 3-business-day SLA.

## Data in
- `searchParams.status`, validated against the union of open
  (`unassigned, assigned, in_progress`) and decided
  (`approved, changes_requested, rejected`) statuses. Unknown value → no status filter
  (everything). Absent → open tasks only.
- `ReviewTask.findMany` — `orderBy [slaDueAt asc, submittedAt asc]`, `take: 100`,
  includes `reviewer.name` and `album` (id, titleAr, titleEn, clipCount, priceStandard,
  currency, `creator.displayNameAr`).
- `ReviewTask.groupBy({ by: ['status'] })` — the counts on the filter chips.

## Controls
Read-only apart from filtering; the decision itself lives on `/admin/review/[id]`.

| Control | Action | Effect |
| --- | --- | --- |
| `FilterChips` (all + 6 statuses) | plain `<a>` to `?status=…` | full navigation; server re-queries |
| Album title in a row | plain `<a>` | full navigation → `/admin/review/{task.id}` |

## States
- **Empty result** — `EmptyState` with `dash.queueEmpty` / `dash.queueHint`.
- **Overdue row** — a row is overdue only when `slaDueAt < now` **and** its status is
  still open; the due date renders as a destructive `Badge` instead of muted text.
- **No `slaDueAt`** — the cell renders an em dash.
- **Unassigned task** — no reviewer name is shown beside the status badge.
- **Decided tasks** stay reachable via the status chips rather than disappearing.
- **Truncation** — hard `take: 100`; there is no pagination, so a queue deeper than 100
  silently shows only the 100 nearest the SLA.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- Ordering is by SLA, not submission time — that is the queue's stated promise.
- The row link is a plain `<a>`, never `next/link`: the client router
  intermittently declined to commit this navigation (about one click in two
  under load), which silently blocked the operator's core action. See
  "Client-router navigations that never commit" in CLAUDE.md.
- Read-only: no `ReviewTask` or `Album` state changes from this route.

## Verified by
`verify:arabic`, `audit`, and `verify:flows` (filter-chip navigation is exercised on
`/admin/review`).
