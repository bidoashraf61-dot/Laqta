# Route handlers

Laqta has a small, fixed set of HTTP route handlers. Everything else in the portal is a
server component or a server action — there is no REST API and no public JSON
surface. There is exactly one webhook: Paymob's transaction callback, which is
the only thing that can mark a card or Apple Pay order paid (dormant until the
`PAYMOB_*` variables are set).

Every handler runs on the Node runtime and sits outside the middleware
matcher's guard logic: `middleware.ts` explicitly excludes `api/auth` and
`api/payments`, and `requiredAccess()` returns `null` for any other `/api/*`
path. Each handler is therefore its own gate.

| Route | Purpose | Spec |
| --- | --- | --- |
| `/api/download` | Redeem a signed, short-lived token for a clip master, a proxy, or an album ZIP — re-checking the entitlement at redemption and logging the hit. | [download.md](download.md) |
| `/api/preview/[clipId]`, `/api/preview/album/[albumId]` | Signed-in download of a clip's watermarked 720p preview, or an album's as a streamed ZIP — `previewKey` only, per-user limits, logged. | [preview-download.md](preview-download.md) |
| `/api/payments/paymob` | Paymob "transaction processed" callback: HMAC-verified, idempotent, amount-checked, settles through the same `settleOrder()` as the admin. | [payments-paymob.md](payments-paymob.md) |
| `/api/auth/[...nextauth]` | Mounts the Auth.js v5 handlers (session, csrf, callbacks, signout) for the email+password and phone-OTP rails, with TOTP as the second factor. | [auth-nextauth.md](auth-nextauth.md) |

Supporting modules: `lib/storage.ts` (HMAC signing; `s3`/`local` drivers; `resolveDownload`),
`lib/auth.ts` + `lib/auth.config.ts` (providers, callbacks, guards),
`lib/orders.ts` (the frozen manifest that `/api/download` enforces),
`lib/paymob.ts` + `lib/paymob-callback.ts` (the Paymob driver and callback).
- [`certificates.md`](./certificates.md) — the licence certificate PDF, owner-only
