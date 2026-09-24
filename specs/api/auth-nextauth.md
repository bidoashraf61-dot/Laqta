# Auth.js catch-all

**Route** `/api/auth/[...nextauth]` (GET, POST) · **Access** public (each sub-endpoint enforces its own rules) · **Rendering** dynamic route handler (Node runtime)

## Purpose
Mounts the Auth.js v5 handlers so the standard endpoints (`/session`, `/csrf`, `/callback/email`, `/callback/phone`, `/signout`, `/providers`) exist over HTTP. The file itself is three lines: `export const { GET, POST } = handlers` from `lib/auth.ts` — all behaviour lives in the config.

## Data in
- `User.findUnique({ where: { email } })` on the `email` provider, including `creator: { select: { id } }`. Fields used: `passwordHash`, `status`, `twoFactorEnabled`, `twoFactorSecret`, `role`, `locale`.
- `User.upsert({ where: { phone } })` on the `phone` provider — OTP sign-in doubles as sign-up, creating `{ phone, phoneVerified, locale: 'ar' }`; the OTP itself is consumed via `consumeOtp` (`lib/otp.ts`).
- `User.findUnique` again on a JWT `trigger === 'update'`, to refresh `role`, `locale` and `creator.id` mid-session.
- No adapter and no session table: `session.strategy` is `jwt` (`lib/auth.config.ts`). `@auth/prisma-adapter` is a dependency but is not wired anywhere.

## Controls
No UI of its own. It is the HTTP target of these callers:

| Control | Action | Effect |
| --- | --- | --- |
| Sign-in form, email rail (`app/(public)/sign-in/actions.ts`) | server action → `signIn('email', …)` | Verifies bcrypt password, then TOTP when enrolled; sets the JWT session cookie |
| Sign-in form, phone rail | server action → `signIn('phone', { phone, code })` | Consumes the OTP, upserts the user, sets the session cookie |
| Sign-up form | server action → `signIn('email', …)` after account creation | Signs the new account straight in |
| "تسجيل الخروج" in the user menu (`components/layout/user-menu.tsx`) | client `signOut({ redirectTo: '/' })` → `POST /api/auth/signout` | Clears the session cookie, returns to `/` |
| `SessionProvider` (`components/layout/providers.tsx`) | `GET /api/auth/session` | Hydrates the client session; also the endpoint `verify:auth` polls |
| Any Auth.js POST | `GET /api/auth/csrf` then `POST /api/auth/callback/<provider>` | CSRF double-submit; the shape `verify:auth` drives directly |

## States
- No session → `/api/auth/session` answers `null` (not `{}`); callers must handle it.
- Bad email/password, unparseable credentials, `status === 'suspended'`, wrong or expired OTP, replayed OTP, wrong TOTP → `authorize` returns `null`, Auth.js redirects to the error page with no session.
- Password correct but the account is 2FA-enrolled and no `totp` was supplied → `TwoFactorRequiredError` with `code = 'two_factor_required'`, which is how the sign-in form knows to show the authenticator step instead of "wrong password". The password is checked *before* this throw, so an attacker with a wrong password never learns the account carries 2FA.
- Session claims are shaped in two places: the edge-safe `session` callback in `lib/auth.config.ts` (used by `middleware.ts`) and the full one in `lib/auth.ts`. Both project `id`, `role` (default `buyer`), `locale` (default `ar`), `creatorId`, and, during a view-as-user session, `impersonatedBy` (the admin's id) and `impersonation` (`{ id, expiresAt, targetName }`) — both derived from `token.imp`.
- View-as-user is granted only through a JWT `update` carrying `{ impersonation: { start: <Impersonation.id> } }`, which `lib/impersonation.ts#applyImpersonationStart` re-verifies against the database (row belongs to the calling admin, open, in date; target still viewable) before swapping the token's identity. `{ impersonation: { end: true } }` ends it. The old client-settable `impersonatedBy` update is gone. Both `jwt` callbacks restore the admin once `token.imp.expiresAt` has passed (`lib/impersonation-shared.ts#expireIfDue`).
- **Odd but intentional-looking:** `pages.signIn` and `pages.error` point at `/ar/sign-in`, a path `middleware.ts` 308-redirects to `/sign-in`. Every auth error costs an extra hop.
- `middleware.ts` excludes `api/auth` from its matcher, so no guard or locale rewrite runs on this route.
- `trustHost: true` — host header is trusted unconditionally.

## Invariants
- Arabic-only site: a user created by phone OTP gets `locale: 'ar'`.
- A suspended user must never receive a session on either rail.
- Role, locale and `creatorId` are read from the database, never from client input; a session's role changes only via a JWT `update` that re-reads `User`.
- 2FA is enforced after password verification, never before, and a missing code throws rather than returning `null` so the two cases stay distinguishable to the form and indistinguishable to an attacker.
- Phone numbers are normalised to E.164 (`normalisePhone`) before any lookup, so `05…`/`01…` and `+966…`/`+20…` are the same identity.
- No money, no downloads: this route touches neither frozen invariant.

## Verified by
`verify:auth` — drives `/api/auth/csrf`, `/api/auth/callback/{email,phone}` and `/api/auth/session` over real HTTP for both rails, wrong password, wrong OTP, OTP replay, TOTP enrolled/absent/wrong, and the full anonymous/buyer/creator/admin × `/account`,`/studio`,`/admin` guard matrix. `audit` covers the `/sign-in` page but not this handler.
