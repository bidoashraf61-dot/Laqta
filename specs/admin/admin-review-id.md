# Review task

**Route** `/admin/review/[id]` · **Access** admin only · **Rendering** server, dynamic (`params` + `auth()`)

## Purpose
Where one album is actually reviewed: the automated reports, the clearance paperwork,
the clip contact sheet, and the nine-check checklist that gates approval.

## Data in
- `ReviewTask.findUnique({ where: { id } })` with `album` →
  `creator` (handle, displayNameAr, country, status) and
  `clips` (`orderBy orderIndex asc`) → `releaseLinks.release`
  (id, type, fileKey, fileName, fileUploadedAt, authority, referenceNumber,
  verification, validTo).
- `lib/admin.findDuplicates(albumId)` — reads `Clip.perceptualHash` for this album, then
  compares it with every hashed `Clip` in **other** albums and lists those within
  `DUPLICATE_DISTANCE` (6) differing bits (`lib/phash.ts#isSameShot`) — a re-encode or
  light grade still matches — with their album slug/title and creator handle. The hash is
  computed at ingest (DEV-18). Matches are surfaced, never auto-rejected.
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
| «اعتماد» / «رفض» per release (DEV-19) | `decideRelease(releaseId, 'verified' \| 'rejected', reason)` (`ReleaseDecision`) | Verify is disabled without a scan (`hasDocument`) and refused server-side with «ما يُعتمد تصريح بلا نسخة من المستند.»; reject opens an inline «سبب الرفض — يقرؤه صانع المحتوى» field and is refused without a reason. Writes `verification`, `verifiedById`, `verifiedAt`, and `rejectionReason` (cleared on verify); `AuditLog release.verify` / `release.reject` with the previous state (and reason); revalidates the review pages and `/studio/releases`. Toast «اعتُمد التصريح.» / «رُفض التصريح، ويظهر السبب لصانع المحتوى.» Each release row shows its type in Arabic, the subject name, the scan link, the `StatusBadge` (release domain), and — when rejected — «سبب الرفض: …» |
| Per-check state chips (pass / fail / not_applicable) × 9 checks | local `setState` in `ReviewChecklist` | client-only until a decision is submitted; nothing is persisted per check |
| «ملاحظة للصانع» textarea | local state | becomes `ReviewTask.decisionNote` |
| «تفاصيل الألبوم» section (above the checklist) | `components/studio/album-details-form.tsx` with `adminSaveAlbumDetails(albumId)` | The creator's details (DEV-08), **editable here in any status** so the reviewer corrects a wrong category or location instead of bouncing the album. Same validation as the studio (`lib/album-details`); audits `album.details.admin`; revalidates `/admin/review`. See [`../studio/studio-albums-id.md`](../studio/studio-albums-id.md#album-details-dev-08) for the fields |
| Price block — **album with a creator recommendation** (DEV-08/09b) | read-only «سعر الصانع: {price} USD», the creator's reason under «سبب الصانع», hint ««اعتماد» ينشر الألبوم بهذا السعر. تبغى سعراً آخر؟ اكتبه تحت وأرسله مع «طلب تعديل» وملاحظتك.»; then «سعرك المقترح (يُرسل مع طلب التعديل)» (optional number, USD, 49–249) | **Approving the album approves the creator's price** (owner, 2026-09-27). A typed proposal disables «اعتماد» and shows «فيه سعر مقترح مكتوب، فالاعتماد معطّل. أرسله مع «طلب تعديل»، أو امسحه لتعتمد بسعر الصانع.»; it is sent with «طلب تعديل» |
| Price block — **album with no recommendation** (saved before the calculator) | «سعر الألبوم» (number, USD, `dir=ltr`, step 0.01, min 49, max 249), pre-filled with the album's own price, else the band price for `clipCount`; hint «مطلوب للاعتماد: من 49 إلى 249 دولار. تحدّده أنت، لا الصانع.» + band line | Required to approve; ignored for request-changes and reject |
| «اعتماد» (approve) | `submitReview` → `lib/admin.decideReview` | The price is `Album.recommendedPrice` when set (a typed price is ignored), else the typed price; refused with «اكتب سعر الألبوم بين {min} و{max} دولار قبل الاعتماد.» unless `parseAlbumPrice` accepts it (the configured range, default 49–249, whole cents). Then `ReviewTask.status='approved'`, `decision='approve'`, checklist + `decidedAt` written; `Album.status='live'`, `publishedAt=now`, `licenceVersionId` = the current licence, `priceStandard` = the operator's price, `currency='USD'`, `tier` = the band for the clip count (a record, not a price source), `clearedForCommercial` and `clearanceStatus` set from the checklist. Audits `album.review.approve` (detail includes `price`). Emails the creator `album.approved` (link to the live album page). Redirects to `/admin` |
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
- The header's clip count is `countOf('clip', n)` (DEV-22).
- **A counter-price travels with the feedback** (DEV-09b). «طلب تعديل» with a proposal writes `ReviewTask.proposedPrice` (refused outside 49–249: «السعر المقترح بين {min} و{max} دولار.»), audits it, and the `album.changes` email adds «واقترحنا سعراً للألبوم: {price}…». The creator's details form pre-fills the proposal and accepts it even outside the calculator range; there is no separate price-acceptance step.
- **The operator sets every album's price, here, inside $49–$249** (decision D4). A creator never chooses a price or band; albums reach review unpriced (`priceStandard = 0`) and the header shows no price until one is set.
- **Approval refuses without a current licence** (`admin.cannotApprove`, detail «No licence is marked current.») — an album goes live carrying the licence it is sold under (DEV-06).
- **The checklist is in Arabic** (DEV-17). Each check's name, reason and prompts come from
  `reviewCheck.<key>.label` / `.why` / `.p1…pN` in `messages/ar.json`; `lib/review-checklist.ts`
  holds only the key, the English log name, `blocking` and the prompt count. Order: technical,
  duplicate, metadata, releases, coherence, quality, **aiAccuracy**, cultural, thirdPartyIp.
- **«دقة الذكاء الاصطناعي» (`aiAccuracy`, DEV-17)** — for generated albums: no warped
  buildings or bent straight lines; no garbled Arabic on signs and shopfronts; dress right
  (thobe, shemagh, abaya as really worn); no morphing objects, faces or hands; no flicker or
  shimmer between frames. A filmed album is marked «لا ينطبق».
- `releases`, `aiAccuracy` and `cultural` are **blocking** checks: approval is refused while
  any is `fail`, and refused while any check is still `pending`. Enforced in
  `lib/review-checklist.canApprove`, re-run server-side. The refusal reads in Arabic —
  «كل فحص لازم يُحسم قبل الاعتماد.» or «فحص إلزامي راسب: {labels}.» with the failing
  checks' Arabic names — both in the alert under the checklist and in the server's
  `admin.cannotApprove` detail. A task opened before DEV-17 has no `aiAccuracy` entry; it
  reads as `pending` and must be decided.
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
`verify:pricing` (a proposal above 249 refused; a proposal stored and carried by the changes email; the creator can accept it outside the range but not a different out-of-range price; approval sells at the recommendation, not a typed price; approval refused without a price, below 49 and above 249; an in-range price lands with the band tier, live, USD, audited; checkout refuses an unpriced live album). `verify:flows` has an admin open a fixture release's scan through the document route
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
