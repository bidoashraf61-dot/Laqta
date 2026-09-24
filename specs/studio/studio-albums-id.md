# Album detail

**Route** `/studio/albums/[id]` · **Access** creator (own albums only) or admin (any album) · **Rendering** server, dynamic

## Purpose
Show one album's clips and its technical consistency, and — for a `draft` or
`changes_requested` album — submit it for review.

## Data in
- `Album.findFirst` where `{ id, creatorId }` for a creator, or `{ id }` for an admin. Includes:
  - `clips` ordered by `orderIndex asc` — full `Clip` rows; the page reads `titleAr/titleEn`, `width`, `height`, `fps`, `colourProfile`, `cameraMovement`, `durationS`, `identifiableFaces`.
  - `reviewTasks` ordered by `createdAt desc`, **every round** — `decision`, `decisionNote`, `checklist`, `submittedAt`, `decidedAt`. The latest round drives the status panel; earlier decided rounds feed «المراجعات السابقة».
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
- **In review** — an info `Alert`: submitted on `{date}`, and the decision arrives by email (`studio.review.inReviewBody`). No SLA date is promised to the creator.
- **Changes requested** — a warning `Alert` with the reviewer's note (`studio.review.reviewerNote`), the names of every checklist check marked `fail` (`studio.review.failedChecks`, labels from `studio.review.check.*`), and «عدّل ما طلبه المراجع، ثم أرسل الألبوم من جديد.»
- **Rejected** — status `delisted` **and** the latest review decision `reject` (a delisting without a reject decision is a takedown, not a rejection). A destructive `Alert` «لم يُقبل هذا الألبوم» with the reviewer's reason (mandatory on reject), the failed checks, and how to query the decision (reply to the decision email, or `/contact`). The status badge reads «لم يُقبل» (destructive) instead of «مسحوب».
- **Approved and live** — a success line with the approval date.
- **Earlier reviews** («المراجعات السابقة») — every decided round before the current one, newest first: decision, submitted and decided dates, and that round's note. Hidden when there is no earlier round; the current round is never repeated here.
- **Consistency warning** — mixed frame rates, colour profiles or resolutions each render a line inside one warning alert; otherwise a success alert (`studio.consistencyOk`).
- **Gate closed** — `SubmitButton` is disabled *and* lists every reason: fewer than 30 clips (`studio.minClips`), more than 70 (`studio.maxClips`) — `MIN_ALBUM_CLIPS` / `MAX_ALBUM_CLIPS` in `lib/studio.ts`, matching the public «٣٠ إلى ٧٠ لقطة» promise, missing Arabic or English title, or a clip with `identifiableFaces` and no non-rejected `model` release linked (`studio.modelReleaseMissing`).
- **Submit refused server-side** — the action re-checks ownership and status; reasons render in a destructive alert under the button.
- **Not draft/changes_requested** — the submit control is replaced by a plain neutral `Badge` naming the status (`in_review` maps to `studio.inReview`, others to `studio.<status>`).
- **Pending** — the button shows `state.loading` and is disabled.
- **No `metadata` export** — this route falls back to the root title.

## Invariants
- The creator sees the reviewer's **decision note** and the **names** of failed checks — never a check's own `note`, which is the reviewer's working text, nor `ReviewTask.notes` (internal).
- The submission gate is enforced twice: `canSubmit` for the UI, and again inside `submitForReview` before the transaction. The client-side disabled state is not the boundary.
- An album with an identifiable face and no verified-or-pending model release cannot enter review. Silence is not a release declaration.
- Submission only moves `draft`/`changes_requested` → `in_review`. It cannot publish, and it cannot re-submit an album already in review.
- Admin access is read-and-submit on any album by the same code path; the ownership filter is dropped only for `role === 'admin'`.

## Verified by
`audit` covers `/studio/albums` but **not** this parameterised route; `verify:arabic` does not list it either. Effectively **not covered** by an automated gate.
