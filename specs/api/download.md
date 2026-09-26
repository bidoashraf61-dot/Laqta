# Download redemption

**Route** `/api/download` (GET) · **Access** authenticated, entitlement holder only · **Rendering** dynamic route handler (Node runtime)

## Purpose
Redeem a short-lived signed download token for one clip master/proxy or a whole-album ZIP, re-checking the entitlement at redemption and logging the hit.

## Data in
- Query params `token` and `sig`. `token` is base64url JSON `{ key, entitlementId, clipId, expiresAt }`; `sig` is an HMAC-SHA256 of `key\nentitlementId\nclipId\nexpiresAt` keyed on `AUTH_SECRET` (`lib/storage.ts`, `verifyDownload`, compared with `timingSafeEqual`).
- Session via `auth()` — JWT session, `session.user.id` only.
- `Entitlement.findUnique({ where: { id: payload.entitlementId } })`, including `orderItem.order.status`. Fields used: `userId`, `revokedAt`, `clipIdsSnapshot`.
- Writes one `Download` row: `entitlementId`, `userId`, `clipId`, `isAlbumZip` (`clipId === null`), `ip` (first hop of `x-forwarded-for`), `userAgent`.
- No album, clip or catalogue read. The `key` is taken from the signed payload, never looked up.

## Controls
Read-only endpoint — no forms, no body, no mutation of catalogue or money. The only write is the `Download` audit row. It is reached from links, not controls of its own:

| Control | Action | Effect |
| --- | --- | --- |
| «تحميل الألبوم كاملاً» (album ZIP) on `/account/library/[id]` | `GET /api/download?token=…&sig=…` signed with `key = albums/<albumId>.zip`, `clipId = null` | Logs a `Download` with `isAlbumZip = true`, then 302s to the resolved key |
| «تحميل» per clip | `GET /api/download` signed with `key = clip.masterKey`, `clipId = clip.id` | Logs a `Download`, then 302s to the resolved key |
| Proxy link per clip | `GET /api/download` signed with `key = clip.proxyKey`, `clipId = clip.id` | Same path; the proxy is the editing copy |

## States
- Missing `token` or `sig` → `400 {"error":"missing_token"}`.
- Bad signature, tampered payload, or past `expiresAt` → `403 {"error":"invalid_or_expired"}`. Deliberately one message for forged/tampered/expired — the caller is never told which.
- No session → `401 {"error":"unauthenticated"}`.
- Entitlement missing, owned by another user, `revokedAt !== null`, or the parent order is not `paid` → `403 {"error":"no_entitlement"}`. This is what makes a refund kill an already-issued token immediately instead of at TTL lapse.
- `clipId` present but not in `Entitlement.clipIdsSnapshot` → `403 {"error":"not_in_manifest"}`.
- Success → `302` to `await resolveDownload(payload.key)` (`lib/storage.ts`), which depends on the driver:
  - **`s3` driver** (`S3_MASTERS_BUCKET` + `AWS_REGION` set): a URL that expires in `S3_SIGNED_URL_TTL_SECONDS` — a **CloudFront signed URL** (`@aws-sdk/cloudfront-signer`) when `MASTERS_CDN_URL`, `CLOUDFRONT_KEY_PAIR_ID` and `CLOUDFRONT_PRIVATE_KEY` are all set, otherwise an **S3 presigned GET** (`@aws-sdk/s3-request-presigner`) with `Content-Disposition: attachment`. Credentials come from the AWS SDK default chain.
  - **`local` driver** (nothing set): `/media/<key>` on the same origin. There is no `/media` route, rewrite or `public/media` directory, so a local redemption ends on a 404 — honestly, rather than pretending a file was served.
  - A "/"-rooted key (dev-seed stand-in under `public/`) redirects to that path under either driver.
- The public media bucket (previews, posters, trailers, hero) never passes through this route — see `lib/media.ts` and `docs/tech/media-aws.md`.
- **Stub:** `Download.bytes` defaults to `0` and is never written by this handler or anywhere else, despite the header comment describing a byte count. Abuse detection currently has hit counts, IPs and user agents — not volume.
- No rate limit, no per-entitlement download cap, no concurrency guard.
- Middleware does not guard this path (`requiredAccess` returns `null` for `/api/*`); the handler is the only gate.
- Responses are JSON error codes in English, not Arabic UI copy — this route is never rendered to a user.

## Invariants
- **Frozen entitlement.** Ownership is served from the purchase-time snapshot. A clip is downloadable only if its id is in `Entitlement.clipIdsSnapshot` (mirror of `OrderItem.clipManifestSnapshot`). The live album is never consulted, so a clip deleted from the album after purchase still downloads and a clip added after purchase never does.
- A valid signature is necessary but never sufficient: user identity, `revokedAt`, order status `paid` and manifest membership are all re-checked at redemption.
- Masters are never addressable by a public path. Every byte goes through a token bound to key + entitlement + expiry (default TTL 900s, `S3_SIGNED_URL_TTL_SECONDS`), and the storage URL it redirects to expires on the same TTL. The masters bucket blocks public access; the signed URL is minted only after every gate above has passed.
- `lib/media.ts#mediaUrl` refuses `masters/`, `proxies/`, `albums/` and `documents/` keys, so no public page can build a URL to a master even by mistake.
- Signature comparison must stay `timingSafeEqual` with a length check — no early-exit string compare.
- Every redemption must produce exactly one `Download` row before the redirect is issued.

## Verified by
Not covered. `verify:entitlement` proves the frozen manifest at the `lib/orders.ts` layer but never calls this route; `audit` crawls `/account/downloads` (the log view), not `/api/download`. There is no test for signature forgery, expiry, revocation or cross-user redemption.
