# Album detail

**Route** `/studio/albums/[id]` · **Access** creator (own albums only) or admin (any album) · **Rendering** server, dynamic

## Purpose
Show one album's clips and its technical consistency, and — for a `draft` or
`changes_requested` album — submit it for review.

## Data in
- `Album.findFirst` where `{ id, creatorId }` for a creator, or `{ id }` for an admin. Includes:
  - `clips` ordered by `orderIndex asc` — full `Clip` rows; the page reads `titleAr/titleEn`, `width`, `height`, `fps`, `colourProfile`, `cameraMovement`, `durationS`, `identifiableFaces`.
  - `reviewTasks` ordered by `createdAt desc`, `take 1` — only `decisionNote` is displayed.
- `analyseConsistency(album.clips)` (`lib/studio.ts`) — distinct sets of frame rate, colour profile and `width×height`.
- `canSubmit(album.id)` (`lib/studio.ts`) — re-reads the album with its clips and their `releaseLinks`.

## Controls
| Control | Action | Effect |
|---|---|---|
| «الألبومات» back link | Link → `/studio/albums` | Navigation only |
| «إرسال للمراجعة» (`SubmitButton`, only when status is `draft` or `changes_requested`) | `submitAlbum(albumId)` → `submitForReview` | In one transaction: `Album.status = 'in_review'` and a `ReviewTask` (`status: 'unassigned'`, empty checklist, `slaDueAt` = submission + 3 business days). Writes `AuditLog` `album.submit`, revalidates the album and the list, toasts, refreshes |

There is **no** clip upload, clip edit, clip reorder, cover picker, title/price edit or
delete on this page. The clip list is read-only, and clips must arrive by some other
path (seed/ingest) — no studio UI creates a `Clip`.

## States
- **Not found / not owned** — `notFound()` (404). A creator with `creatorId == null` matches nothing and also gets 404 here (this route does **not** redirect to `/sell`).
- **Changes requested** — a warning `Alert` with the reviewer's `decisionNote`, shown only when both the status is `changes_requested` and a note exists.
- **Consistency warning** — mixed frame rates, colour profiles or resolutions each render a line inside one warning alert; otherwise a success alert (`studio.consistencyOk`).
- **Gate closed** — `SubmitButton` is disabled *and* lists every reason: fewer than 8 clips (`studio.minClips`), missing Arabic or English title, or a clip with `identifiableFaces` and no non-rejected `model` release linked (`studio.modelReleaseMissing`).
- **Submit refused server-side** — the action re-checks ownership and status; reasons render in a destructive alert under the button.
- **Not draft/changes_requested** — the submit control is replaced by a plain neutral `Badge` naming the status (`in_review` maps to `studio.inReview`, others to `studio.<status>`).
- **Pending** — the button shows `state.loading` and is disabled.
- **No `metadata` export** — this route falls back to the root title.

## Invariants
- The submission gate is enforced twice: `canSubmit` for the UI, and again inside `submitForReview` before the transaction. The client-side disabled state is not the boundary.
- An album with an identifiable face and no verified-or-pending model release cannot enter review. Silence is not a release declaration.
- Submission only moves `draft`/`changes_requested` → `in_review`. It cannot publish, and it cannot re-submit an album already in review.
- Admin access is read-and-submit on any album by the same code path; the ownership filter is dropped only for `role === 'admin'`.

## Verified by
`audit` covers `/studio/albums` but **not** this parameterised route; `verify:arabic` does not list it either. Effectively **not covered** by an automated gate.
