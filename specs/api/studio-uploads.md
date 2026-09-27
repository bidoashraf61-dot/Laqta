# Studio master uploads

**Route** `/api/studio/uploads` (POST) · `/api/studio/uploads/[clipId]` (GET, DELETE) · `/api/studio/uploads/[clipId]/sign` (POST) · `/api/studio/uploads/[clipId]/part` (PUT, local driver only) · `/api/studio/uploads/[clipId]/complete` (POST) · **Access** creator (own albums) or admin (any album), album `draft` or `changes_requested` · **Rendering** dynamic route handlers (Node runtime), JSON

## Purpose
Get a creator's master from their browser into the PRIVATE masters store, in parts,
resumably, and hand it to the ingest job — which reads the specs from the file with
ffprobe and makes the watermarked preview and poster. The client is
`components/studio/upload-engine.ts`; the page is `/studio/albums/[id]`.

## Data in
- Session via `auth()` in `lib/route-auth.ts#studioActor` — `role` must be `creator`
  or `admin`. These routes are **outside the middleware matcher** (`api/studio` is
  excluded: a part is a 16 MB+ body and Next buffers a middleware-visible body at
  10 MB), so this check is the only guard in front of them — including the mandatory-2FA
  hold (`twoFactorOwed`, `lib/two-factor.ts`).
- `lib/uploads.ts#editableAlbum` / `editableClip` — `Album.findFirst` scoped by
  `creatorId` (dropped for admins), status in `EDITABLE_STATUSES`.
- Limits (env, `lib/uploads.ts`): `UPLOAD_MAX_CLIP_BYTES` (default 20 GiB);
  `.mov`/`.mp4` only, browser type `video/quicktime`, `video/mp4`,
  `application/octet-stream` or empty; at most `MAX_ALBUM_CLIPS` (70) clips per
  album counting clips in flight.
- Part size: 16 MiB, grown so no file needs more than 9,000 parts (`partSizeFor`).
- Driver (`lib/storage.ts#storageDriver`): `s3` when `S3_MASTERS_BUCKET` + `AWS_REGION`
  are set, else `local`.

## Controls
| Control | Action | Effect |
| --- | --- | --- |
| `POST /api/studio/uploads` `{ albumId, name, type, size }` | `startClipUpload` | Validates, creates the `Clip` (`ingestStatus: uploading`, specs 0, `masterKey = masters/<albumId>/<clipId>.<ext>`, `sizeBytes` = declared, `originalFilename`, titles = filename stem, `orderIndex` = last + 1). S3: `CreateMultipartUpload`, `uploadId` stored. Audit `clip.upload_start`. **201** `{ clipId, driver, partSize, partCount }` |
| `POST …/[clipId]/sign` `{ partNumbers }` (1–100, each 1..partCount) | `partTargets` | S3: presigned `UploadPart` URLs (1 h). Local: `/api/studio/uploads/<clipId>/part?n=N`. `{ targets: [{ partNumber, url, method: 'PUT' }] }` |
| `PUT <target>` | browser → S3, or `…/part?n=N` | S3: straight to the bucket (needs CORS, `docs/tech/media-aws.md`). Local: streamed to `.media/uploads/<clipId>/part-N`, capped at the part size; answers `ETag` |
| `GET …/[clipId]` | `uploadedParts` | Resume: `{ clipId, driver, parts: [{ partNumber, size, etag }], partSize, partCount }` (S3 `ListParts`, or the local part files) |
| `POST …/[clipId]/complete` `{ parts: [{ partNumber, etag }] }` | `completeClipUpload` | S3: `CompleteMultipartUpload` + `HeadObject`. Local: parts 1..N concatenated into `MEDIA_MASTERS_DIR` (default `.media/masters`) — any gap refuses. Stored size over the cap → object removed, clip `failed/size`. Else `ingestStatus: uploaded`, `sizeBytes` = stored bytes, `uploadId` cleared; `ingestSoon()`; audit `clip.upload_complete`; revalidates the album page |
| `DELETE …/[clipId]` | `destroyClip` | Aborts/removes the master, preview and poster (best effort), deletes the row, renumbers, refreshes album totals. Audit `clip.delete` |

## States
- No session → **401** `unauthenticated`; a buyer → **403** `forbidden`; a creator or admin
  who has not enrolled in 2FA → **403** `two_factor_required` (mandatory 2FA — these routes
  are outside middleware, so `studioActor()` is the only place it is held).
- Album or clip not the caller's (or absent) → **404** `not_found` — never "exists but not yours".
- Album not `draft`/`changes_requested` → **409** `not_editable`. Clip not `uploading` on sign/part/complete/resume → **409** `not_editable`.
- Wrong extension or type → **415** `type`; size ≤ 0 or over the cap, or an oversized part → **413** `size`; album full → **409** `too_many`; album ever sold (delete) → **409** `sold`.
- Complete with missing parts → **400** `incomplete`; the clip stays `uploading` and can resume.
- Local driver: `…/part` on the S3 driver → **404** (bytes never pipe through the app in production).
- After complete, ingest runs in the background (`lib/ingest.ts`): `uploaded → probing → transcoding → ready`, or `failed` with `Clip.ingestError` ∈ `missing | probe | container | codec | preview | size`.

## Invariants
- **Specs come from the stored file.** Width, height (rotation applied), fps, duration, codec, bitrate, colour (`Rec.709`/`Rec.2020`/`HLG`/`PQ` only when tagged — LOG is never guessed), aspect ratio: ffprobe, server-side. Nothing the browser sends reaches those columns.
- **Stored size is measured**, never the browser's number (`HeadObject` / `stat`).
- Accepted codecs: `h264`, `hevc`, `prores`; container `mov`/`mp4`. Anything else fails ingest with a reason rather than producing a preview.
- A master is never under `public/` and never a public key; `lib/media.ts#mediaUrl` refuses `masters/`.
- The queue is the `Clip` table: a worker claims with a conditional `uploaded → probing` update, so the web process and `npm run media:ingest` never encode one clip twice. Clips stuck in `probing`/`transcoding` for 60 minutes go back to `uploaded`.
- `Album.clipCount`, `totalRuntimeS`, `totalSizeBytes` are recomputed from READY clips after every ingest and delete (`refreshAlbumTotals`); the cover falls back to the first ready clip when unset or deleted.
- A clip of an album that has ever been sold is never deleted — its master key is frozen in `OrderItem.clipManifestSnapshot`.

## Verified by
`verify:uploads` — refusals (other creator, album in review, type, size), a real
ffmpeg-generated master uploaded in parts and assembled byte-exact, ffprobe specs,
preview (H.264, 720 lines) and poster published, album totals and cover, the gate's
`clipsProcessing`/`minClips`, an audio-only file failing with `probe`, delete removing
row, master and preview; with `VERIFY_BASE_URL`, unauthenticated start and part → 401.
`verify:auth` — an unenrolled creator's `GET …/[clipId]` → 403 `two_factor_required`.
The S3 driver's presigned path is not exercised (no bucket in CI).
