# Review task

**Route** `/admin/review/[id]` · **Access** admin only · **Rendering** server, dynamic (`params` + `auth()`)

## Purpose
Where one album is actually reviewed: the automated reports, the clearance paperwork,
the clip contact sheet, and the eight-check checklist that gates approval.

## Data in
- `ReviewTask.findUnique({ where: { id } })` with `album` →
  `creator` (handle, displayNameAr, country, status) and
  `clips` (`orderBy orderIndex asc`) → `releaseLinks.release`
  (id, type, fileKey, fileName, fileUploadedAt, authority, referenceNumber,
  verification, validTo).
- `lib/admin.findDuplicates(albumId)` — reads `Clip.perceptualHash` for this album, then
  finds `Clip` rows in **other** albums sharing a hash, with their album slug/title and
  creator handle. Perceptual-hash equality, not checksum; matches are surfaced, never
  auto-rejected.
- `lib/studio.analyseConsistency(clips)` — pure function over fps / colourProfile /
  width×height; flags `mixedFrameRate`, `mixedProfile`, `mixedResolution`.
- `lib/review-checklist.normaliseChecklist(task.checklist)` — the stored JSON, backfilled
  to the canonical 8 keys so old rows stay readable.
- Releases are de-duplicated in the page by `Release.id` (it used to be
  `${type}-${referenceNumber}`, which merged two permits with no reference number
  into one row and hid the second document).
- `lib/uploads.ts#hasDocument(release)` — whether a scan is attached.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| `BackLink` | link | → `/admin/review` |
| «عرض المستند» per release (plain `<a target="_blank">`, with the file name) | `GET /api/studio/releases/[id]/document` ([spec](../api/release-document.md)) | Re-checks the admin role, writes `AuditLog release.document_view`, then a 302 to a 60-second signed S3 URL, or the file streamed `private, no-store` on the local driver. «بلا مستند» when none is attached |
| Per-check state chips (pass / fail / not_applicable) × 8 checks | local `setState` in `ReviewChecklist` | client-only until a decision is submitted; nothing is persisted per check |
| «ملاحظة للصانع» textarea | local state | becomes `ReviewTask.decisionNote` |
| «اعتماد» (approve) | `submitReview` → `lib/admin.decideReview` | `ReviewTask.status='approved'`, `decision='approve'`, checklist + `decidedAt` written; `Album.status='live'`, `publishedAt=now`, `licenceVersionId` = the current licence, `clearedForCommercial` and `clearanceStatus` set from the checklist. Audits `album.review.approve`. Emails the creator `album.approved` (link to the live album page). Redirects to `/admin` |
| «طلب تعديلات» (request changes) | `submitReview` | `ReviewTask.status='changes_requested'`; `Album.status='changes_requested'` (reopened for editing). Requires a note. Emails the creator `album.changes` quoting the note, linking `/studio/albums/[id]` |
| «رفض» (reject) | `submitReview` | `ReviewTask.status='rejected'`; `Album.status='delisted'`. Requires a note. Emails the creator `album.rejected` quoting the reason and inviting a reply, linking `/studio/albums` |

The decision emails are queued by `lib/notifications.notifyAlbumDecision(albumId)`
after the decision transaction commits, in the creator's stored `User.locale`, with
the album title in that language (Arabic fallback). Rejection used to be silent; it
is now told, because a delisting with no message reads as a status chip with no
reason. See `specs/mail.md`.

Disclosure: the approve button is disabled while `canApprove(checklist)` fails, and the
same gate is re-run on the server inside `decideReview` — the client gate is UX, not the
authorisation boundary.

## States
- **Task not found** → `notFound()` (404).
- **Duplicates found** — a warning `Alert` listing each local clip and the albums /
  creators it matches. Never blocks by itself.
- **Consistency warnings** — a second warning `Alert` for mixed frame rate, colour
  profile or resolution.
- **No releases on file** — the clearance section renders `state.empty`.
- **Release without a scan** — «بلا مستند» in place of the link; the reviewer can see
  the paperwork is missing before passing the `releases` check.
- **Clip with no thumbnail key** — the tile renders an empty muted box; the poster is
  `mediaUrl(Clip.thumbnailKeys[0])`. Clips uploaded in the studio get their poster from
  the ingest job, and an album can only reach review once every clip is `ready`
  (`canSubmit`), so a reviewed upload always has one.
- **Clip with `identifiableFaces`** — a warning badge on the tile.
- **Approve blocked** — a warning `Alert` states the reason from `canApprove`: either
  "every check must be decided" or which blocking check is failing.
- **Server rejection** — `decideReview` returns `{ ok: false }` and the reason renders in
  a destructive `Alert`; cases: task missing (`state.notFound`), approve gate failed
  (`admin.cannotApprove` + detail), non-approve decision with an empty note
  (`admin.decisionNote`).
- **Pending** — all three decision buttons are disabled during the transition.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- **Approval refuses without a current licence** (`admin.cannotApprove`, detail «No licence is marked current.») — an album goes live carrying the licence it is sold under (DEV-06).
- `releases` and `cultural` are **blocking** checks: approval is refused while either is
  `fail`, and refused while any check is still `pending`. Enforced in
  `lib/review-checklist.canApprove`, re-run server-side.
- **The checklist fails closed.** `normaliseChecklist` is the trust boundary — it is fed
  straight from the client by `submitReview` and also parses a stored JSON column, so it
  validates `state` against the four known values and falls back to `pending` on anything
  else (and keeps `note`/`checkedAt`/`checkedBy` only when they are strings). This is
  load-bearing: `checklistProgress` counts anything that is not exactly `pending` as
  decided and only an exact `fail` as blocking, so a crafted
  `{ releases: { state: 'anything' } }` would otherwise read as "decided, not failing"
  and let an album publish with its model-release check never actually passed.
- A `request_changes` or `reject` decision without a note is refused.
- `clearedForCommercial` is derived, never set by hand:
  `releases === 'pass' && thirdPartyIp !== 'fail'`. It drives the buyer-facing
  "cleared for commercial use" filter.
- The task update and the album update happen in one `$transaction` — a review decision
  cannot half-apply.
- No money and no entitlement is touched here.
- A mail problem never fails a decision: `notifyAlbumDecision` runs after the
  transaction, catches its own errors, and is keyed on the review task — re-running it
  for the same decision queues nothing; a later decision on a resubmission is a new
  task and a new message. With no provider configured the row stays pending on
  `/admin/settings`.

## Invariants
- A release scan is only ever reached through the authenticated document route — the
  page renders no storage key and no public URL.

## Verified by
`verify:flows` has an admin open a fixture release's scan through the document route
(200 locally / 302 on S3); the page itself is still not loaded by a gate.

**The route** is not covered: `/admin/review/[id]` is absent from
`scripts/verify-arabic.ts`, `scripts/audit-portal.ts` and `scripts/verify-flows.ts`, so
nothing loads this page automatically.

**The gate behind it** is covered by `npm run test:unit`
(`tests/unit/review-checklist.test.ts`): the blocking-check table, `normaliseChecklist`
rejecting an unknown state, every `canApprove` refusal, `checklistProgress` and
`clearedForCommercial`.

**The decision emails** are covered by `npm run verify:mail`: `album.approved`,
`album.changes` and `album.rejected` render in both languages with no banned copy.
The hook itself (`decideReview` → `notifyAlbumDecision`) is not exercised against the
database by any gate.
