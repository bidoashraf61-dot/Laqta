# Preview downloads ("comps")

**Route** `/api/preview/[clipId]` and `/api/preview/album/[albumId]` (GET) · **Access** signed-in (any role), live albums only · **Rendering** dynamic route handlers (Node runtime, `force-dynamic`; the ZIP route has `maxDuration = 300`)

## Purpose
Let a signed-in visitor download a clip's **watermarked 720p preview**, or every preview in an album as one ZIP, to cut into their own timeline before buying. Owner decision 2026-09-24: this is the standard stock-library "comp" and the strongest buying lever in the category. Every download is also logged as a buying-intent signal for the operator.

## Data in
- Session via `auth()`; `session.user.id` only.
- Clip route: `Clip.findFirst({ id, album.status: 'live' })` — `previewKey`, plus `proxyKey` / `masterKey` **selected only for the guard**, and the album's clip order (for the file's position number).
- Album route: `Album.findFirst({ id, status: 'live' })` with its clips in `orderIndex` order, same fields.
- Bytes (`lib/previews.ts#previewSource`): a "/"-rooted key streams the file under `public/`; a bucket key is read from `S3_MEDIA_BUCKET` when `S3_MEDIA_BUCKET` + `AWS_REGION` are set (single clip → 302 to a 5-minute presigned GET with `response-content-disposition`; ZIP → `GetObject` per entry), else fetched through `NEXT_PUBLIC_MEDIA_CDN_URL` and streamed with the disposition header.
- Writes one `CompDownload` row per **granted** request: `userId`, `albumId`, `clipId` (null for a ZIP), `isAlbumZip`, `fileCount`, `ip`, `userAgent` (migration `20260924130000_comp_downloads`).

## Controls
Reached from `CompDownload` (`components/catalogue/comp-download.tsx`), a plain `<a>` to the route (no `download` attribute, so a refusal redirect is followed, not saved):

| Control | Where | Effect |
| --- | --- | --- |
| «حمّل المعاينة» | `/footage/[slug]` side panel, under the buy actions | `GET /api/preview/[clipId]?back=<this page>` → `{album-slug}_clip-NN_laqta-preview.mp4` |
| «حمّل كل المعاينات (ZIP)» | `/albums/[creator]/[slug]` buy panel | `GET /api/preview/album/[albumId]?back=…` → `{album-slug}_laqta-previews.zip`, entries named exactly like the single downloads |
| Signed out: «سجّل دخولك وحمّل المعاينة» / «…كل المعاينات» | same places | `/sign-in?callbackUrl=<this page>` (locale prefix kept) |

The control renders only when the preview can be delivered right now (`previewDeliverable`); the album control counts only deliverable previews.

## States
- Signed out → `401 {"error":"unauthenticated"}`, or with a same-origin `back` a `303` to `/sign-in` (or `/en/sign-in`) with `callbackUrl=back`. An off-site or protocol-relative `back` is ignored (no open redirect).
- Clip/album not found **or not live** → `404 {"error":"not_found"}` — a paused, delisted or unreviewed album answers like a missing one.
- No preview, a refused preview key, or a file that can't be read → `404 {"error":"no_preview"}`, or with `back` a `303` to `back?comp=unavailable#comps`, which the page renders as «المعاينة مو متوفرة للتحميل الحين.». Availability is checked **before** the grant, so a missing file never spends the allowance.
- Over the limit → `429`, or with `back` a `303` to `back?comp=limit#comps` («وصلت الحد: …»).
- ZIP whose declared size would exceed the ZIP32 limit → `413 {"error":"too_large"}`.
- Success → the file (`Content-Disposition: attachment`, exact `Content-Length`), or a `302` to a presigned S3 URL.

## Invariants
- **Only `Clip.previewKey` is ever served.** `servablePreviewKey` refuses: an empty key, `..`, a protocol-relative key, any key (or CDN URL) under `masters/`, `proxies/`, `albums/`, `documents/`, and any key equal to the clip's `proxyKey` or `masterKey`. A mis-set column cannot turn this into a proxy or master download.
- Limits are **per user**, counted from `CompDownload` inside one transaction under a per-user advisory lock (no race past the limit): **60 clip previews per rolling hour** (`PREVIEW_CLIPS_PER_HOUR`) and **5 album ZIPs per rolling day** (`PREVIEW_ZIPS_PER_DAY`). The row is written before any byte is served, so an interrupted download still counts; refusals are not logged.
- The ZIP is streamed with stored (uncompressed) entries — MP4 does not compress — opening one preview at a time, so memory is one chunk whether the album is 30 clips or 70.
- The watermark is burnt into the file by `npm run media:previews`; the licence (`/licences`, «ما يمنعه الترخيص») and the content policy say a preview may be used only to test in the edit, not in published work.

## Verified by
`verify:previews` (in `npm run verify`): the key guard (proxy, master, private prefixes, traversal, equal-to-proxy/master), served bytes = the `previewKey` file, filename shape, ZIP length = declared `Content-Length` and entries = exactly the previews, clip and ZIP limits trip independently, granted downloads logged and refusals not; with `VERIFY_BASE_URL`, signed-out 401s, the sign-in redirect keeping `/en`, and no open redirect. **Not covered:** a signed-in end-to-end download over HTTP, and the not-live 404 (both are one query filter, read above).
