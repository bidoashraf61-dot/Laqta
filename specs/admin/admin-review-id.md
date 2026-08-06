# Review task

**Route** `/admin/review/[id]` · **Access** admin only · **Rendering** server, dynamic (`params` + `auth()`)

## Purpose
Where one album is actually reviewed: the automated reports, the clearance paperwork,
the clip contact sheet, and the eight-check checklist that gates approval.

## Data in
- `ReviewTask.findUnique({ where: { id } })` with `album` →
  `creator` (handle, displayNameAr, country, status) and
  `clips` (`orderBy orderIndex asc`) → `releaseLinks.release`
  (type, authority, referenceNumber, verification, validTo).
- `lib/admin.findDuplicates(albumId)` — reads `Clip.perceptualHash` for this album, then
  finds `Clip` rows in **other** albums sharing a hash, with their album slug/title and
  creator handle. Perceptual-hash equality, not checksum; matches are surfaced, never
  auto-rejected.
- `lib/studio.analyseConsistency(clips)` — pure function over fps / colourProfile /
  width×height; flags `mixedFrameRate`, `mixedProfile`, `mixedResolution`.
- `lib/review-checklist.normaliseChecklist(task.checklist)` — the stored JSON, backfilled
  to the canonical 8 keys so old rows stay readable.
- Releases are de-duplicated in the page by `${type}-${referenceNumber}`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| `BackLink` | link | → `/admin/review` |
| Per-check state chips (pass / fail / not_applicable) × 8 checks | local `setState` in `ReviewChecklist` | client-only until a decision is submitted; nothing is persisted per check |
| «ملاحظة للصانع» textarea | local state | becomes `ReviewTask.decisionNote` |
| «اعتماد» (approve) | `submitReview` → `lib/admin.decideReview` | `ReviewTask.status='approved'`, `decision='approve'`, checklist + `decidedAt` written; `Album.status='live'`, `publishedAt=now`, `clearedForCommercial` and `clearanceStatus` set from the checklist. Audits `album.review.approve`. Redirects to `/admin` |
| «طلب تعديلات» (request changes) | `submitReview` | `ReviewTask.status='changes_requested'`; `Album.status='changes_requested'` (reopened for editing). Requires a note |
| «رفض» (reject) | `submitReview` | `ReviewTask.status='rejected'`; `Album.status='delisted'`. Requires a note |

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
- **Clip with no thumbnail key** — the tile renders an empty muted box; `Clip.thumbnailKeys[0]`
  is used verbatim as an `<img src>`.
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

## Verified by
**The route** is not covered: `/admin/review/[id]` is absent from
`scripts/verify-arabic.ts`, `scripts/audit-portal.ts` and `scripts/verify-flows.ts`, so
nothing loads this page automatically.

**The gate behind it** is covered by `npm run test:unit`
(`tests/unit/review-checklist.test.ts`): the blocking-check table, `normaliseChecklist`
rejecting an unknown state, every `canApprove` refusal, `checklistProgress` and
`clearedForCommercial`.
