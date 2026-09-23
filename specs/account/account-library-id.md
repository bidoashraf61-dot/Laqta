# Library — album downloads

**Route** `/account/library/[id]` (`id` = `Entitlement.id`) · **Access** the owning authenticated user only · **Rendering** server component, dynamic

## Purpose
Hands over the files for one purchased album: a whole-album ZIP link plus a
per-clip master and editing-proxy link, every clip taken from the frozen
purchase manifest.

## Data in
- `requireUser()` for the session user id.
- `db.entitlement.findFirst`
  - filter: `{ id, userId: user.id, revokedAt: null }` — the id alone is never
    enough; ownership and non-revocation are part of the query.
  - includes `album` (`titleAr`, `titleEn`) and `orderItem`
    (`clipManifestSnapshot`, `order.orderNumber`, `order.status`).
- Clip rows are `orderItem.clipManifestSnapshot` cast to
  `{ id, slug, titleAr, titleEn, masterKey, proxyKey }[]`. `album.clips` is never
  read.
- `paid = orderItem.order.status === 'paid'`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «← مكتبتي» | `<Link href="/account/library">` | Back to the library |
| «تحميل الألبوم كاملاً» | `<Link>` to `downloadUrl({ key: 'albums/{albumId}.zip', entitlementId, clipId: null })` → `/api/download?token=…&sig=…` | Redeems a signed 15-minute HMAC token at `app/api/download/route.ts`, which re-checks the entitlement, logs a `Download` row with `isAlbumZip = true`, then 302s to `resolveKey()` |
| «تحميل» (per clip) | `<Link>` to `downloadUrl({ key: clip.masterKey, entitlementId, clipId })` | Same redemption path; logs a `Download` row for that clip |
| «نسخة المونتاج» (per clip) | `<Link>` to `downloadUrl({ key: clip.proxyKey, entitlementId, clipId })` | Same redemption path, proxy key |

No forms, no server actions. Every mutation on this surface is the `Download`
row written by the API route.

## States
- Not found / not yours / revoked: `notFound()` → 404. The same 404 covers a
  bad id and someone else's entitlement — no distinction is leaked.
- Order not yet `paid`: warning alert «بانتظار تأكيد الدفع»; the ZIP button and
  every per-clip button are omitted entirely. Clip titles still render, so the
  buyer can see what they bought while a bank transfer settles.
- Always shown: an info alert with `library.frozenNote` explaining the clip list
  is as it stood at purchase.
- Clip with no `masterKey`: renders a neutral `—` badge instead of a download
  button.
- Empty manifest: the `<ul>` renders with no rows (no dedicated empty state).
- Storage driver — `lib/storage.ts` has an `s3` driver (active when
  `S3_MASTERS_BUCKET` + `AWS_REGION` are set: `/api/download` then 302s to a
  short-lived CloudFront-signed or S3-presigned URL) and falls back to the
  **local driver** in development, where redemption lands on a `/media/<key>`
  path nothing serves. The signing and entitlement checks are real either way.
  The «نسخة المونتاج» link downloads `proxyKey` — the clean editing proxy, private,
  never the public watermarked `previewKey`. The album ZIP key `albums/<albumId>.zip` is
  synthesised by this page and is not produced by any zip-building job in the
  repo.

## Invariants
- **Frozen entitlement.** Clips are read from `OrderItem.clipManifestSnapshot`
  only. A clip the creator has since deleted is still listed and still
  downloadable.
- **Masters are never a plain URL.** Every link is a short-lived HMAC token
  bound to key + entitlement + expiry (`lib/storage.ts`,
  `S3_SIGNED_URL_TTL_SECONDS`, default 900s), verified with `timingSafeEqual`.
- Entitlement is re-checked at redemption, not just at issue: `/api/download`
  refuses when the entitlement is missing, belongs to another user, is revoked,
  or its order is not `paid` — so a refund kills live tokens immediately.
- `clipId` must appear in `Entitlement.clipIdsSnapshot` or redemption is
  refused (`not_in_manifest`).
- Every redemption is logged to `Download` with IP and user agent; that log is
  the only abuse signal.

## Verified by
`verify:entitlement` (frozen manifest survives album mutation). **Not covered**
by `audit` or `verify:arabic` — neither route list includes
`/account/library/[id]`, so this page is never opened in a real browser by a gate.
