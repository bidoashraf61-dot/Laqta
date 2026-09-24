# Releases and permits

**Route** `/studio/releases` · **Access** creator or admin (`requireCreator`; no `creatorId` → `/sell`) · **Rendering** server, dynamic

## Purpose
Declare model releases, property releases and shooting permits, attach the scanned
document to each, and link each one to the clips it covers — the data the album
submission gate and the reviewer read.

## Data in
- `Release.findMany` where `creatorId`, `orderBy [{ verification: 'asc' }, { createdAt: 'desc' }]`, including `clipLinks { clipId }`. Renders `subjectName`, `type`, `authority`, `referenceNumber`, `validFrom`/`validTo`, link count, `verification`, `rejectionReason`, and the scan: `fileName`, `fileSizeBytes`, with "attached" decided by `lib/uploads.ts#hasDocument` (`fileUploadedAt` set and `fileKey` under `documents/`).
- `maxDocumentBytes()` (`UPLOAD_MAX_DOCUMENT_BYTES`, default 15 MiB).
- `Clip.findMany` where `album.creatorId` = this creator AND (`identifiableFaces` OR `hasPeople`), `orderBy createdAt desc`, `take 200`; selects `id, titleAr, identifiableFaces, album.titleAr`. This is the linkable-clip pool for every release on the page.

## Controls
| Control | Action | Effect |
|---|---|---|
| «إضافة مستند» form (`SettingsForm`) | `createRelease` server action | Creates `Release` with `verification: 'pending'` and `fileKey: "pending/{creatorId}"` (no scan yet — a server action body is capped at 1 MB); writes `AuditLog` `release.create`; revalidates `/studio/releases`. The panel says «بعد الإضافة، أرفق نسخة المستند من بطاقة التصريح.» |
| «إرفاق المستند» on a card with no scan (`ReleaseDocument`, `.pdf,.jpg,.jpeg,.png`) | `PUT /api/studio/releases/[id]/document` ([spec](../api/release-document.md)) | Type sniffed from the bytes (PDF/JPEG/PNG), ≤ the cap, stored privately under `documents/releases/<id>/`; a `rejected` release returns to `pending`; toast «أُرفق المستند.» + refresh. Refusals toast «نوع الملف غير مقبول — ارفع مستنداً أو صورة ممسوحة.» / «الملف أكبر من الحد المسموح.» (the size is also checked before sending) |
| The file name (link, new tab) | `GET /api/studio/releases/[id]/document` | Opens the scan: a 60-second signed URL on S3, streamed `private, no-store` locally |
| «استبدال» | same `PUT` | Replaces the scan and removes the old object |
| «إزالة» | `window.confirm` → `DELETE …/document` | Clears the scan; the release and its links stay; toast «أُزيل المستند.» |
| `type` select (`model` / `property` / `permit`) | form field | `Release.type`; anything else → `state.error` |
| `subjectName` (required, ≤120) | form field | `Release.subjectName` |
| `authority`, `referenceNumber`, `validFrom`, `validTo`, `notes` | form fields | Stored, `null`/unset when blank |
| «ربط بالمقاطع» disclosure (`ReleaseLinker`) | Toggles an inline checkbox list | No mutation |
| «حفظ الروابط» | `setReleaseClips(releaseId, clipIds)` | Deletes **all** `ReleaseClip` rows for that release and recreates them from the posted selection, in one transaction; `AuditLog` `release.link_clips`; toast + `router.refresh()` |

There is still no edit and no delete for a release itself — only for its scan.

## States
- **No releases** — `EmptyState` (`dash.noReleases`); the create panel stays.
- **No linkable clips** — `ReleaseLinker` renders `dash.noLinkableClips` instead of the disclosure.
- **Rejected release** — `rejectionReason` renders in a destructive alert on the card.
- **Verification badge** — `pending` / `verified` / `rejected` via `StatusBadge domain="release"`; only a reviewer can move it, never this page.
- **No scan** — the card's «المستند» strip shows «إرفاق المستند» and «لم يُرفق المستند بعد. المراجع لا يعتمد تصريحاً بلا نسخة منه.» with the accepted formats (`PDF · JPG · PNG`, isolated) and the cap.
- **Scan attached** — file name (link) and size, with «استبدال» and «إزالة».
- **Verified** — the scan shows without controls, and «اعتُمد هذا التصريح، فلا يُستبدل مستنده.»; the route refuses PUT/DELETE with `verified` too.
- **Rejected** — «استبدال المستند يعيد التصريح إلى المراجعة.» under the strip.
- **Uploading** — the strip's buttons disable with a spinner.
- **Pending** — form submit disables with a spinner; the linker's save button shows `state.loading`.
- **Errors** — create failures render inline above the form; link failures raise an error toast (`state.notFound` when the release is not owned).
- **No creator profile** → `redirect('/sell')`.

## Invariants
- Both sides of a link are ownership-checked: the release must belong to the session creator, and clip ids are filtered to `album.creatorId = creator` before insert. Ids in the payload are treated as guessable.
- The selection posts whole — unchecking a clip really removes the link, so what the creator sees equals what `canSubmit` reads.
- Verification is never self-served: `createRelease` always writes `pending`, and the album gate only accepts a `model` release whose verification is not `rejected`. Replacing a rejected scan moves it back to `pending`, never forward.
- A scan is never public: private storage (`documents/` in the masters bucket, or `.documents/` locally), opened only through the authenticated route, refused by `mediaUrl()`.

## Verified by
`verify:arabic`, `audit`. `verify:flows` attaches a PDF through a fixture release's card and has an admin open it through the private route; `verify:uploads` covers the type/size/ownership/verified rules and that the scan is never under `public/`. The linker and the create form are not exercised by `verify:flows`.
