# Release document (scan)

**Route** `/api/studio/releases/[id]/document` (GET, PUT, DELETE) · **Access** GET: the release's creator or any admin; PUT/DELETE: the release's creator only, release not `verified` · **Rendering** dynamic route handler (Node runtime)

## Purpose
Attach, open, replace and remove the scanned model release, property release or
permit behind a `Release` row — kept in PRIVATE storage and opened only through this
route. Used by `/studio/releases` (creator) and `/admin/review/[id]` (reviewer).

## Data in
- Session via `lib/route-auth.ts#studioActor` (`creator` or `admin`); outside the
  middleware matcher like every `/api/studio` route (a scan can exceed the 10 MB body
  Next buffers for middleware).
- `Release` scoped by `creatorId` (dropped for an admin on GET): `fileKey`,
  `fileName`, `fileMime`, `fileSizeBytes`, `fileUploadedAt`, `verification`.
- `UPLOAD_MAX_DOCUMENT_BYTES` (default 15 MiB).
- Driver: `s3` → the masters bucket under `documents/` (SSE-S3); `local` →
  `documentPath(key)` (`DOCUMENT_ROOT`, default `.documents/`), never `public/`.

## Controls
| Control | Action | Effect |
| --- | --- | --- |
| `GET` | `viewableRelease` → `signedDocumentUrl` | S3: **302** to a presigned GET that lives **60 s** (`inline`, stored type). Local: the file streamed with `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, `inline`. An admin open writes `AuditLog release.document_view` |
| `PUT` (raw body, `X-Filename` URI-encoded) | `attachReleaseDocument` | Reads the body with a hard cap, sniffs the type from the bytes (`%PDF-`, JPEG `FFD8FF`, PNG signature), stores at `documents/releases/<releaseId>/<uuid>.<ext>`, sets the `file*` columns, removes the previous scan. A `rejected` release goes back to `pending` with `rejectionReason` cleared. Audit `release.document_attach` |
| `DELETE` | `detachReleaseDocument` | Clears the `file*` columns, `fileKey` back to `pending/<creatorId>`, removes the object. Audit `release.document_remove` |

## States
- No session → **401**; a buyer → **403**; no creator profile on PUT/DELETE (an admin) → **403** `forbidden`.
- Not the caller's release, or no document attached (GET) → **404** `not_found`.
- `verified` release on PUT/DELETE → **409** `verified`.
- Empty or over the cap (declared or actual) → **413** `size`; bytes not PDF/JPEG/PNG → **415** `type` (a renamed `.html` "permit.pdf" is refused).

## Invariants
- A scan is never publicly addressable: `documents/` is refused by `lib/media.ts#mediaUrl`, the local root is outside `public/`, and every open re-checks ownership or admin role before a URL is minted.
- The type is decided by the bytes, never by the filename or `Content-Type`, and served back with the stored type plus `nosniff`.
- "Has a document" is `fileUploadedAt` set **and** `fileKey` under `documents/` (`hasDocument`) — the legacy `pending/<creatorId>` key is not a document.
- Once verified, a scan cannot be swapped or removed: the reviewer signed off on that paper.

## Verified by
`verify:uploads` — HTML-as-PDF refused, 16 MB refused, another creator cannot attach or
open, an admin can open, the key sits under `documents/` and outside `public/`,
`mediaUrl()` refuses it, verified locks it, replacing a rejected scan returns it to
`pending` and removes the old object, remove clears it; with `VERIFY_BASE_URL`, an
unauthenticated GET → 401 and nothing is served under `/.documents/`, `/documents/`,
`/.media/masters/`.
