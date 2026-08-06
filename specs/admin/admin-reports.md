# Reports

**Route** `/admin/reports` · **Access** admin only · **Rendering** server, dynamic (`auth()`)

## Purpose
Two things, despite the generic route name: the zero-result search report (the
content-acquisition roadmap) and the tail of the platform audit trail.

## Data in
- `lib/admin.zeroResultReport(50)` — `SearchQueryLog.groupBy(['normalized'])` where
  `resultCount = 0`, counted and ordered by count descending, `take: 50`, with
  `_max.createdAt` as "last seen"; then a second `findMany` (`distinct: ['normalized']`)
  to recover one raw `query` per normalised form so the report shows the buyer's own
  words.
- `AuditLog.findMany` — `orderBy createdAt desc`, `take: 50`, includes
  `actor` (name, email).

Takes no `searchParams`; there is no range picker, filter or search on this route.

## Controls
**Read-only.** There are no interactive elements on this page — no links, no forms, no
export.

## States
- **No zero-result rows** — `EmptyState` with `state.empty` / `studio.demandHint`; the
  audit panel still renders below it.
- **No audit rows** — the audit panel renders `state.empty` text instead of the table.
- **Audit entry with no actor** — the actor cell shows an em dash (system-originated or
  deleted user).
- **`entityId` display** — truncated to the first 8 characters.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.
- **Truncation** — 50 queries and 50 audit rows, fixed; there is no way to page further
  back in the audit trail from any surface.

## Invariants
- Read-only. Nothing on this route mutates anything.
- The audit trail is display-only here — it is written by the server actions in
  `app/(admin)/admin/actions.ts` and `lib/admin.ts` via `recordAudit`, and can never be
  edited or deleted through the UI.
- The column headers reuse unrelated message keys (`search.submit`, `admin.searches`,
  `library.purchasedOn`) rather than report-specific ones.

## Verified by
`verify:arabic`, `audit`. Not covered by `verify:flows`.
