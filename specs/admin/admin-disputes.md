# Disputes

**Route** `/admin/disputes` · **Access** admin only · **Rendering** server, dynamic (`searchParams` + `auth()`)

## Purpose
Work DMCA notices, IP claims, takedown requests and content complaints: read the sworn
statement in full, disable the complained-of album if credible, then close the dispute
with a written resolution.

## Data in
- `searchParams.status` — accepted only if in `statusValues('dispute')`
  (`open, investigating, content_disabled, resolved, rejected`); unknown → no filter.
  Absent → `open, investigating, content_disabled`.
- `Dispute.findMany` — `orderBy [status asc, createdAt desc]`, `take: 100`, includes
  `assignee.name` and `album` (titleAr, titleEn, slug, `creator.handle`).
- `Dispute.groupBy({ by: ['status'] })` — chip counts.
- Rendered per dispute: `type`, `claimantName`, `claimantOrg`, `statement` (full, not
  truncated), `affectedClipIds.length`, `counterNotice`, `resolution`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| `FilterChips` | plain `<a>` to `?status=` | re-queries the list |
| Album title | link | → `/albums/{creator.handle}/{album.slug}` |
| «قيد التحقيق» (shown when `status === 'open'`) | `setDisputeStatus(id,'investigating')` | status → investigating, `assigneeId` = acting admin |
| «تعطيل المحتوى» (shown unless already disabled) | `setDisputeStatus(id,'content_disabled')`, destructive + native confirm | status → content_disabled, `contentDisabledAt=now`, and the linked album goes `live → paused` |
| «استعادة المحتوى» (shown when `content_disabled`) | `setDisputeStatus(id,'investigating')` | status back to investigating, `contentDisabledAt=null`. **Does not un-pause the album** — only `rejected` does that |
| «إغلاق الشكوى» disclosure | local state | opens the resolution textarea (max 1000 chars) |
| «مغلقة» (resolved) | `setDisputeStatus(id,'resolved', resolution)` | status → resolved, `resolvedAt=now`, `resolution` stored. Album left as-is |
| «مرفوضة» (rejected) | `setDisputeStatus(id,'rejected', resolution)` | status → rejected, `resolvedAt=now`; a `paused` album is put back to `live` |

## States
- **Empty result** — `EmptyState` with `dash.noDisputes`.
- **Closed dispute** (`resolved` / `rejected`) — `DisputeControls` renders `null`; the row
  becomes read-only.
- **No linked album** (`albumId` null) — no album link, and the status change touches no
  catalogue row.
- **Missing resolution text** — closing is refused client-side with a toast; the server
  action itself does not require one (`resolution?.trim() || undefined`).
- **Dispute not found server-side** → `{ ok: false, message: state.notFound }`, surfaced
  as an error toast.
- **Pending** — buttons disabled during the transition.
- **Truncation** — hard `take: 100`, no pagination.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- Disabling content **pauses**, never delists. A counter-notice is common and a delisted
  album with sold entitlements is far harder to undo.
- Album state changes are scoped with `updateMany` guards (`status: 'live'` → paused;
  `status: 'paused'` → live on rejection) so a manually delisted album is not resurrected.
- Buyer entitlements are unaffected by any dispute action — they are served from the
  order snapshot.
- Every status change sets `assigneeId` to the acting admin and writes an `AuditLog`
  row (`dispute.{status}`).

## Verified by
`verify:arabic`, `audit`, `verify:flows` (filter-chip navigation on `/admin/disputes`).
