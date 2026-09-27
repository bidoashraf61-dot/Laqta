# Album detail

**Route** `/studio/albums/[id]` · **Access** creator (own albums only) or admin (any album) · **Rendering** server, dynamic

## Purpose
Build an album: fill in its **details and recommended price** (DEV-08), upload its
clips, name and order them, pick the cover, see each clip's specs and processing state and
the album's technical consistency, and — for a `draft` or `changes_requested` album —
submit it for review.

## Data in
- `Album.findFirst` where `{ id, creatorId }` for a creator, or `{ id }` for an admin. Includes:
  - `clips` ordered by `orderIndex asc` — full `Clip` rows; the page reads `titleAr/titleEn`, `ingestStatus`, `ingestError`, `width`, `height`, `fps`, `codec`, `colourProfile`, `cameraMovement`, `durationS`, `sizeBytes`, `thumbnailKeys[0]` (through `mediaUrl`), `originalFilename`, `identifiableFaces`.
  - `coverClipId`.
  - `reviewTasks` ordered by `createdAt desc`, **every round** — `decision`, `decisionNote`, `checklist`, `submittedAt`, `decidedAt`. The latest round drives the status panel; earlier decided rounds feed «المراجعات السابقة».
- `analyseConsistency(readyClips)` (`lib/studio.ts`) — distinct sets of frame rate, colour profile and `width×height`, over clips with `ingestStatus = ready` only (an upload in flight is 0×0 at 0 fps and would fake a "mixed" warning).
- `storageDriver()` (`lib/storage.ts`) — `local` shows the development-storage notice; `maxClipBytes()` (`UPLOAD_MAX_CLIP_BYTES`, default 20 GiB).
- Side effect: if any clip is `uploaded` (queued but not being encoded — e.g. the server restarted), rendering calls `ingestSoon()` (`lib/ingest.ts`) so the queue drains.
- `canSubmit(album.id)` (`lib/studio.ts`) — re-reads the album with its clips and their `releaseLinks`.
- `loadAlbumDetails(album.id)` (`lib/album-details.ts`) — the album's origin/style, resolution, quality, recommended price and note, orientation, permits statement, and its `AlbumTaxonomy` links; every ACTIVE `Taxonomy` row of kinds category, location, theme and tag (names localised server-side); the `PriceBand`s for the calculator; `clipCount`.

## Album details (DEV-08)
Section «تفاصيل الألبوم» (`#details`), above the consistency panel, rendered by
`components/studio/album-details-form.tsx`. Editable while `draft` / `changes_requested`;
otherwise the same fields render disabled under «الألبوم قيد المراجعة أو منشور، فالتفاصيل
للعرض فقط.» with no save button. Hint: «هذي التفاصيل يبحث بها المشتري ويراجعها فريق لقطة.
لازم تحفظها قبل ما ترسل الألبوم للمراجعة.»

| Field | Control | Stored as |
|---|---|---|
| «نوع اللقطات» * | 4 radio cards: «ذكاء اصطناعي: مشاهد واقعية» / «…رسوم ثلاثية الأبعاد» / «…رسوم ثنائية الأبعاد» / «تصوير حقيقي بالكاميرا» | `origin` (`generated`/`captured`) + `footageStyle` (`live_action`/`animated_3d`/`animated_2d`; filmed = live_action) |
| «الدقة» * | 3 radio cards 720p / 1080p / 4K | `resolution` (`sd720`/`hd1080`/`uhd4k`) |
| «جودة الألبوم» * | 3 radio cards «قياسية» / «جيدة» / «استثنائية», hint «تقييمك أنت، ويراجعه فريق لقطة. ويدخل في حساب السعر.» | `qualityLevel` |
| «اتجاه اللقطات» * | radio «أفقي ١٦:٩» / «عمودي ٩:١٦ (ألبوم عمودي مخصص)» — no `mixed` (D6) | `orientation` |
| «التصنيف» * | native select of active categories | one `AlbumTaxonomy` (category) |
| «المواقع» * | checkbox pills, 1–10, hint «كل مدينة أو منطقة تظهر في الألبوم، حتى ١٠.» | `AlbumTaxonomy` (location) |
| «وقت اليوم» | pills: the `tag` rows `sunrise, golden-hour, blue-hour, sunset, night` (`TIME_OF_DAY_TAGS`) | `AlbumTaxonomy` (tag) |
| «المناسبة» | pills of active themes, ≤3 | `AlbumTaxonomy` (theme) |
| «أسلوب اللقطات» | pills: the other tags; tags total ≤12 | `AlbumTaxonomy` (tag) |
| «حاسبة السعر» | live, client-side (`lib/price-calculator.suggestPrice`): «السعر المقترح: $X», «اقترح سعراً ضمن: $low – $high», and the basis line (`clipCount`; below 30 it says it is priced at the minimum and updates as clips arrive). «اختر نوع اللقطات والدقة والجودة ليظهر السعر المقترح.» until the three are chosen | — |
| «سعرك المقترح» * | number input (USD, `min`/`max` = the range) | `recommendedPrice` |
| «لماذا هذا السعر؟ (اختياري)» | textarea ≤500 | `recommendedNote` |
| «التصاريح» * | radio «لا يحتاج تصاريح: …» / «التصاريح المطلوبة مرفوعة في صفحة التصاريح.» | `permitsDeclaration` (`none_needed`/`attached`) |
| «حفظ التفاصيل» | `saveAlbumDetailsAction(albumId)` → `lib/album-details.saveAlbumDetails` | Re-checks editability (`editableAlbum`); parses; refuses a recommendation outside `suggestPrice(clipCount, …)`'s range («سعرك المقترح خارج النطاق…»); resolves slugs against ACTIVE taxonomy of the right kind only (a forged category/location is refused); writes the columns + `detailsCompletedAt=now` and replaces the album's category/location/theme/tag links in one transaction; audits `album.details`. Success «حُفظت تفاصيل الألبوم.» |

Under the calculator: «لقطة تعتمد سعرك أو تقترح سعراً آخر، ولا يُنشر الألبوم بسعر مختلف
قبل موافقتك.» When the last review round asked for changes **with a proposed price**
(DEV-09b), the calculator shows «لقطة اقترحت {price}. خانة سعرك فيها هذا السعر: احفظ
التفاصيل لتقبله، أو اقترح سعراً ضمن النطاق.», the price field is pre-filled with it (until
the creator saves again after that round), and a recommendation equal to it is accepted
even outside the range — by the save action and by the submission gate
(`lib/album-details.latestProposal`).

**Calculator** (owner, 2026-09-27): base from the band for the clip count (count clamped
to 30–70) × resolution × type × quality, clamped to the price range and rounded to whole
dollars; the recommendation range is ± the spread. Every number comes from the owner's dropdown
choices on `/admin/catalogue` (DEV-09c, `lib/pricing-config.ts`) — defaults 720p 0.6 · 1080p 1.0 · 4K
1.3; AI live action 1.0 · AI 3D 0.9 · AI 2D 0.8 · filmed 1.25; standard 0.9 · good 1.0 ·
exceptional 1.15; $49–$249; ±15%. The form receives the live settings in `view.config`.

## Controls
| Control | Action | Effect |
|---|---|---|
| «الألبومات» back link | Link → `/studio/albums` | Navigation only |
| «إرسال للمراجعة» (`SubmitButton`, only when status is `draft` or `changes_requested`) | `submitAlbum(albumId)` → `submitForReview` | In one transaction: `Album.status = 'in_review'` and a `ReviewTask` (`status: 'unassigned'`, empty checklist, `slaDueAt` = submission + 3 business days). Writes `AuditLog` `album.submit`, revalidates the album and the list, toasts, refreshes |

The clip controls below render only while the album is `draft` or `changes_requested`
(`editable`). All of them are client code in `components/studio/album-clips.tsx`; the
upload protocol is `components/studio/upload-engine.ts` against
[`/api/studio/uploads`](../api/studio-uploads.md).

| Control | Action | Effect |
|---|---|---|
| Drop zone «اسحب ملفات الفيديو إلى هنا، أو» + «اختر ملفات» (multiple, `.mov,.mp4`) | `uploadMaster()` per file, two files at a time, four parts per file in parallel, three retries per part | `POST /api/studio/uploads` creates the clip row (`uploading`) → sign → PUT parts (S3 presigned, or the local `/part` route) → complete. The row appears on start (`router.refresh()`), shows a progress bar (bytes sent / total, %) while this tab uploads, and becomes «بانتظار المعالجة» on completion |
| «إلغاء» on an uploading row (or ✕ on a not-yet-placed file) | `AbortController` + `DELETE /api/studio/uploads/[clipId]` | Stops the PUTs, aborts the multipart upload, deletes the row |
| «استئناف الرفع» on an interrupted row (uploading, no live progress in this tab) | file picker → `uploadMaster({ resumeClipId })` | Refuses a file whose name or size differs from `originalFilename`/`sizeBytes` («هذا ليس الملف الذي بدأت رفعه.»); otherwise lists the landed parts and sends only the rest |
| ↑ «تقديم اللقطة» / ↓ «تأخير اللقطة» (disabled at the ends) | `moveClip(clipId, 'up'|'down')` | Renumbers the album 0..n-1, then swaps the two `orderIndex` values in one transaction; revalidates |
| «المزيد» → «تعديل العنوان» | inline form → `updateClipTitles(clipId, formData)` | Both `titleAr` and `titleEn` required (≤160); `AuditLog clip.rename`; toast «تم الحفظ» |
| «المزيد» → «اجعلها الغلاف» (disabled unless `ready` and not already cover) | `setAlbumCover(clipId)` | `Album.coverClipId`; `AuditLog album.set_cover`; the row's poster carries a «الغلاف» badge |
| «المزيد» → «حذف اللقطة» | `window.confirm` → `deleteClip(clipId)` → `destroyClip` | Deletes the row (release links cascade), then best-effort the master, preview and poster; renumbers; recomputes album totals; `AuditLog clip.delete`. Refused («لا تُحذف لقطة من ألبوم بيع من قبل…») if the album has any `OrderItem` |

Every clip action re-checks ownership and editability server-side (`lib/uploads.ts#editableClip`); an album in review, live, paused or delisted returns «اللقطات لا تُعدَّل والألبوم قيد المراجعة أو منشور.». There is still no album title/price edit and no album delete on this page.

## States
- **Changes requested with a price** — the warning panel adds «سعر لقطة المقترح: {price}» and a «راجعه في تفاصيل الألبوم» link to `#details` (`ReviewTask.proposedPrice`, DEV-09b).
- **Unpriced** — the header line reads «{n} لقطة · يُحدَّد السعر عند الاعتماد» until the operator approves the album at a price (DEV-09).
- **Not found / not owned** — `notFound()` (404). A creator with `creatorId == null` matches nothing and also gets 404 here (this route does **not** redirect to `/sell`).
- **In review** — an info `Alert`: submitted on `{date}`, and the decision arrives by email (`studio.review.inReviewBody`). No SLA date is promised to the creator.
- **Changes requested** — a warning `Alert` with the reviewer's note (`studio.review.reviewerNote`), the names of every checklist check marked `fail` (`studio.review.failedChecks`, labels from `studio.review.check.*`), and «عدّل ما طلبه المراجع، ثم أرسل الألبوم من جديد.»
- **Rejected** — status `delisted` **and** the latest review decision `reject` (a delisting without a reject decision is a takedown, not a rejection). A destructive `Alert` «لم يُقبل هذا الألبوم» with the reviewer's reason (mandatory on reject), the failed checks, and how to query the decision (reply to the decision email, or `/contact`). The status badge reads «لم يُقبل» (destructive) instead of «مسحوب».
- **Approved and live** — a success line with the approval date.
- **Earlier reviews** («المراجعات السابقة») — every decided round before the current one, newest first: decision, submitted and decided dates, and that round's note. Hidden when there is no earlier round; the current round is never repeated here.
- **Consistency warning** — mixed frame rates, colour profiles or resolutions each render a line inside one warning alert; otherwise a success alert (`studio.consistencyOk`).
- **Gate closed** — `SubmitButton` is disabled *and* lists every reason: fewer than 30 **ready** clips (`studio.minClips`), more than 70 clips of any state (`studio.maxClips`) — `MIN_ALBUM_CLIPS` / `MAX_ALBUM_CLIPS` in `lib/studio.ts`, matching the public «٣٠ إلى ٧٠ لقطة» promise, a clip still uploading or processing (`studio.clipsProcessing` «لقطات لم تكتمل معالجتها بعد»), a failed clip (`studio.clipsFailed`), missing Arabic or English title, details not saved (`studio.detailsMissing` «املأ تفاصيل الألبوم واحفظها: …»), a recommended price that the current clip count has moved out of range (`studio.priceOutOfRange`), or a clip with `identifiableFaces` and no non-rejected `model` release linked (`studio.modelReleaseMissing`).
- **Clip header** — «اللقطات» with «{ready} جاهزة من {total}» once there is a clip.
- **Upload zone** — accepted formats as an isolated Latin run (`.mov · .mp4 — H.264 · H.265 · ProRes`), the per-file cap, and «تُقرأ الدقة ومعدل الإطارات والمدة من الملف نفسه…». On the local driver a warning line «وضع التطوير: الملفات تُحفظ على هذا الجهاز، لا في التخزين السحابي.»
- **Not editable** — the zone is replaced by «اللقطات لا تُعدَّل والألبوم قيد المراجعة أو منشور.» and the rows have no controls.
- **No clips** — `EmptyState` «لا لقطات في الألبوم بعد» / «ارفع من ٣٠ إلى ٧٠ لقطة حول موضوع واحد.»
- **Clip row** — position number, the poster in a dark 16:9 frame (spinner while working, placeholder icon otherwise), Arabic title, English title (isolated), and a status badge: «جارٍ الرفع» · «بانتظار المعالجة» · «تُقرأ المواصفات» · «تُجهَّز المعاينة» (neutral) · «جاهزة» (success) · «تعذّرت المعالجة» (destructive) · «توقف الرفع قبل أن يكتمل» (uploading with no live upload in this tab). A ready row shows `W×H`, `fps`, codec, colour profile, duration, size, camera movement; a failed row the reason from `studio.upload.error.<ingestError>` (codec failures also list the accepted codecs); a working row «المواصفات بعد المعالجة». Identifiable faces add the warning badge under the row.
- **Refused upload** — the file stays in the zone with the reason (`studio.upload.refuse.<code>`: type, size, too_many, not_editable, else generic) and a ✕ to dismiss.
- **Polling** — while any clip is `uploaded`/`probing`/`transcoding` the component calls `router.refresh()` every 4 s; it stops when none is. While this tab has uploads running, leaving the page triggers the browser's unload warning.
- **Submit refused server-side** — the action re-checks ownership and status; reasons render in a destructive alert under the button.
- **Not draft/changes_requested** — the submit control is replaced by a plain neutral `Badge` naming the status (`in_review` maps to `studio.inReview`, others to `studio.<status>`).
- **Pending** — the button shows `state.loading` and is disabled.
- **No `metadata` export** — this route falls back to the root title.

## Invariants
- **Clip specs are never typed or sent by the browser.** Width, height, fps, duration, codec, colour and aspect come from ffprobe on the stored master (`lib/ingest.ts`); the consistency check and the reviewer read those columns.
- Masters go to private storage only (S3 masters bucket, or `.media/masters` on the local driver); the preview and poster are generated server-side with the site's watermark burnt in and published to the public media store (or `public/uploads/` locally).
- `Album.clipCount`, `totalRuntimeS`, `totalSizeBytes` follow READY clips (`refreshAlbumTotals`), and the cover falls back to the first ready clip.
- The creator sees the reviewer's **decision note** and the **names** of failed checks — never a check's own `note`, which is the reviewer's working text, nor `ReviewTask.notes` (internal).
- The submission gate is enforced twice: `canSubmit` for the UI, and again inside `submitForReview` before the transaction. The client-side disabled state is not the boundary.
- An album with an identifiable face and no verified-or-pending model release cannot enter review. Silence is not a release declaration.
- Submission only moves `draft`/`changes_requested` → `in_review`. It cannot publish, and it cannot re-submit an album already in review.
- Admin access is read-and-submit on any album by the same code path; the ownership filter is dropped only for `role === 'admin'`.

## Verified by
`verify:pricing` — calculator values, floor/ceiling, the under-30 basis, details refused without a save, an out-of-range recommendation refused, an in-range one landing as columns + 6 taxonomy links, a forged category refused. `verify:flows` — a fixture draft album: a real mp4 uploaded through the page's file input reaches «جاهزة», its specs match the file, and the rename form lands (plus the older rejected-album checks on this route). `verify:uploads` — the upload protocol, ingest, gate reasons, totals, cover and delete at the library layer. `audit` and `verify:arabic` still do not visit this parameterised route.
