# Route handlers

Laqta has a small, fixed set of HTTP route handlers. Everything else in the portal is a
server component or a server action — there is no REST API and no public JSON
surface. There is exactly one webhook: Paymob's transaction callback, which is
the only thing that can mark a card or Apple Pay order paid (dormant until the
`PAYMOB_*` variables are set).

Every handler runs on the Node runtime and sits outside the middleware
matcher's guard logic: `middleware.ts` explicitly excludes `api/auth`,
`api/payments`, `api/studio` (upload bodies exceed the 10 MB Next buffers
for middleware) and `api/health`, and `requiredAccess()` returns `null` for any other `/api/*`
path. Each handler is therefore its own gate — the `/api/studio` ones through
`lib/route-auth.ts#studioActor`.

| Route | Purpose | Spec |
| --- | --- | --- |
| `/api/cron/daily` | POST with `CRON_SECRET`: bank-transfer reminders, the operator digest, an outbox drain (DEV-30/57). | [cron-daily.md](cron-daily.md) |
| `/api/health` | GET: 200 when the database answers, 503 when not — the host's and the uptime monitor's probe (DEV-14). | [health.md](health.md) |
| `/api/download` | Redeem a signed, short-lived token for a clip master, a proxy, or an album ZIP — re-checking the entitlement at redemption and logging the hit. | [download.md](download.md) |
| `/api/preview/[clipId]`, `/api/preview/album/[albumId]` | Signed-in download of a clip's watermarked 720p preview, or an album's as a streamed ZIP — `previewKey` only, per-user limits, logged. | [preview-download.md](preview-download.md) |
| `/api/studio/uploads/…` | A creator's master, uploaded in parts straight to private storage (S3 presigned multipart, or a local streaming route in development), resumable, then queued for ffprobe + preview ingest. | [studio-uploads.md](studio-uploads.md) |
| `/api/studio/releases/[id]/document` | Attach, open (60 s signed URL), replace or remove a release's scanned document — private, type sniffed from the bytes. | [release-document.md](release-document.md) |
| `/api/payments/paymob` | Paymob "transaction processed" callback: HMAC-verified, idempotent, amount-checked, settles through the same `settleOrder()` as the admin. | [payments-paymob.md](payments-paymob.md) |
| `/api/impersonation/end` | End a view-as-user session: the only non-GET a view may make; closes and audits the row, restores the admin. | [impersonation-end.md](impersonation-end.md) |
| `/api/auth/[...nextauth]` | Mounts the Auth.js v5 handlers (session, csrf, callbacks, signout) for the email+password and phone-OTP rails, with TOTP as the second factor. | [auth-nextauth.md](auth-nextauth.md) |

Supporting modules: `lib/storage.ts` (HMAC signing; `s3`/`local` drivers; `resolveDownload`),
`lib/uploads.ts` (upload protocol, document storage, album totals), `lib/ingest.ts` +
`lib/media-pipeline.ts` (ffprobe, preview and poster — shared with `npm run media:previews`),
`lib/auth.ts` + `lib/auth.config.ts` (providers, callbacks, guards),
`lib/orders.ts` (the frozen manifest that `/api/download` enforces),
`lib/paymob.ts` + `lib/paymob-callback.ts` (the Paymob driver and callback).
- [`certificates.md`](./certificates.md) — the licence certificate PDF, owner-only
- [`invoices.md`](./invoices.md) — the invoice PDF for an order, owner-only (DEV-28)
