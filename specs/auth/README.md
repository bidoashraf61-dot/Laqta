# Auth — sign-in, sign-up and the guard model

Two public surfaces and one cross-cutting decision layer.

Sessions are **JWT only** (`session: { strategy: 'jwt' }`) — there is no DB
session table in play, which is what lets `middleware.ts` run the guards on the
edge runtime without Prisma. `lib/auth.config.ts` is the edge-safe half of the
Auth.js config; `lib/auth.ts` spreads it and adds the two credential providers
(`email`, `phone`) plus the DB-backed callbacks.

Two sign-in rails, both first-class:

- **email** — email + bcrypt password, with a TOTP second factor
  (`lib/totp.ts`, RFC 6238, SHA-1 / 6 digits / 30 s / ±1 step) once the account
  has enrolled. Enrolment lives at `/account/security`, not here.
- **phone** — 6-digit OTP (`lib/otp.ts`, bcrypt-hashed at rest, 5-minute TTL,
  5 attempts, single-use). This rail doubles as sign-up: a first-time verified
  number upserts a `buyer` `User`. **No SMS provider is wired** — in development
  the code is returned to the form and shown in a warning alert.

**Password reset** — email rail only (`lib/password-reset.ts`): SHA-256-hashed
token, 30 minutes, single use, one live per account, sent through the outbox as
`auth.passwordReset`. Sessions are JWTs, so a reset stamps
`User.passwordChangedAt` and the `jwt` callback refuses any token that began
before it. No SMS reset: SMS delivery is not wired.

Access is decided twice on purpose: middleware is the gate, the route-group
layout is the lock.

## Routes

| Route | Spec | Purpose |
|---|---|---|
| `/sign-in` | [`sign-in.md`](./sign-in.md) | Start a session on the email or phone rail, then return to `callbackUrl`. |
| `/sign-up` | [`sign-up.md`](./sign-up.md) | Create a buyer account from name + email + password and sign it in immediately. |
| `/forgot-password` | [`forgot-password.md`](./forgot-password.md) | Ask for a single-use reset link by email. Same answer whether or not the address has an account; rate-limited per address and per IP. |
| `/reset-password?token=…` | [`reset-password.md`](./reset-password.md) | Choose a new password from the emailed link; every existing session ends, 2FA stays required. |
| — (`middleware.ts` + layouts) | [`guard-model.md`](./guard-model.md) | The path → role table, the anonymous redirect, the wrong-role rewrite, and the layout re-check. |

## Role matrix at a glance

| | `/account` | `/studio` | `/admin` |
|---|---|---|---|
| anonymous | → `/sign-in` | → `/sign-in` | → `/sign-in` |
| `buyer` | allowed | forbidden | forbidden |
| `creator` | allowed | allowed | forbidden |
| `admin` | allowed | allowed | allowed |

"Forbidden" is a **rewrite** to `/forbidden`, so it arrives as HTTP 200 with
the Arabic 403 page and the typed URL still in the address bar.

## Gate

`npm run verify:auth` drives all of the above over HTTP against a running
server (`npm start &`), including OTP replay/expiry, TOTP accept/reject, and
every cell of the matrix, and password reset (neutral answer, single-use and
expired tokens, the old password refused, an older session cookie dead, 2FA
still asked, the rate limits).
