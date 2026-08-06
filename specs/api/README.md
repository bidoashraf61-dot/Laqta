# Route handlers

Laqta has exactly two HTTP route handlers. Everything else in the portal is a
server component or a server action — there is no REST API, no public JSON
surface, and no webhook endpoint (the payment driver in `lib/payments.ts`
settles in-process, so there is nothing for a gateway to call back).

Both handlers run on the Node runtime and both sit outside the middleware
matcher's guard logic: `middleware.ts` explicitly excludes `api/auth`, and
`requiredAccess()` returns `null` for any other `/api/*` path. Each handler is
therefore its own gate.

| Route | Purpose | Spec |
| --- | --- | --- |
| `/api/download` | Redeem a signed, short-lived token for a clip master, a proxy, or an album ZIP — re-checking the entitlement at redemption and logging the hit. | [download.md](download.md) |
| `/api/auth/[...nextauth]` | Mounts the Auth.js v5 handlers (session, csrf, callbacks, signout) for the email+password and phone-OTP rails, with TOTP as the second factor. | [auth-nextauth.md](auth-nextauth.md) |

Supporting modules: `lib/storage.ts` (HMAC signing and key resolution),
`lib/auth.ts` + `lib/auth.config.ts` (providers, callbacks, guards),
`lib/orders.ts` (the frozen manifest that `/api/download` enforces).
