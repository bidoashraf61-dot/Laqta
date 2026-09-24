# Forgot password

**Route** `/forgot-password` (+ `/en/forgot-password`) · **Access** anyone, signed in or not · **Rendering** server shell (`requestLocale()` only, no DB read), client form; `robots: noindex`

## Purpose
The email rail's way back in. Before this page a buyer who forgot their password
was locked out of their library for good — there was no reset of any kind.
Enter an address, get a single-use link by email, and learn nothing about
whether the address has an account.

## Data in

- Page render: none. `RESET_TTL_MINUTES` (30) from `lib/password-reset.ts` is
  passed to the form for the confirmation copy.
- Server action `requestReset(formData)` (`app/(public)/forgot-password/actions.ts`)
  → `requestPasswordReset({ email, ip, pageLocale })` (`lib/password-reset.ts`):
  - `PasswordResetRequest.create({ emailHash, ipHash })` — **every** request,
    known address or not. Both are SHA-256 of the value salted with
    `AUTH_SECRET`; the table is a counter, not a log.
  - `PasswordResetRequest.count` per `emailHash` and per `ipHash` over the last
    hour. Over the limit → stop here (still answers `sent`).
  - `User.findUnique({ where: { email } })`. Missing or `suspended` → stop here
    (still answers `sent`).
  - In one transaction: every live `PasswordResetToken` of the user gets
    `usedAt = now` (one live link per account), a new token row is created
    (`tokenHash` = SHA-256 of 32 random bytes, `expiresAt` = now + 30 min), and
    one `auth.passwordReset` `MailOutbox` row is enqueued in the **account's**
    `User.locale` (Arabic fallback). Then `drainSoon()`.
  - IP: first `x-forwarded-for` hop, else `x-real-ip`, else the literal
    `unknown` bucket.

## Controls

| Control | Action | Effect |
|---|---|---|
| Field «البريد الإلكتروني» (`#email`, `dir="ltr"`, `autoFocus`) + «أرسل الرابط» (gold) | `requestReset(formData)` | Zod `email().max(320)`. Malformed → `auth.invalidEmail` «اكتب بريداً إلكترونياً صحيحاً.». Well-formed → always `{ status: 'sent', email, devLink }`. |
| Phone hint (muted text) | — | «سجّلت برقم جوالك؟ ما تحتاج كلمة مرور. ادخل برمز الجوال.» — the phone rail has no password to reset. |
| «رجوع لتسجيل الدخول» | `Link` → `/sign-in` | Muted link, in both states. |
| «استخدم بريداً ثانياً» (outline) | client state reset | Sent state only; back to the empty form. |
| «افتح رابط التعيين» | plain `<a>` to the reset link | Dev-link alert only (see States). |

No SMS / "reset by code" option: `lib/otp.ts` has no SMS provider wired
(`sendSms` logs in development and throws with a provider set), so offering one
would be a control that cannot work.

## States

- **Empty form** — the default.
- **Pending** — button label `state.loading`, `disabled`.
- **Malformed address** — destructive alert, `auth.invalidEmail`.
- **Sent** — the form is replaced by a `role="status"` block: `<h2>` «شوف بريدك»,
  «إذا كان {email} مسجّلاً عندنا، بيوصلك رابط خلال دقائق. الرابط يشتغل مرة وحدة
  وينتهي بعد ٣٠ دقيقة.» (the address wrapped in U+2068/U+2069 isolates), and the
  spam-folder hint. **Identical** for a known address, an unknown one, a
  suspended account and a rate-limited request.
- **Dev link** — only when `NODE_ENV !== 'production'` **and** no mail provider
  is configured (`isMailConfigured()` false) **and** a token was actually
  issued: a warning alert «وضع التطوير: ما فيه مزوّد بريد، فالرابط هنا بدل
  البريد.» with the link. Mirrors the phone rail's dev OTP notice. In
  development this does reveal that the address exists; production never
  renders it, with or without a provider.

## Invariants

- **No account enumeration.** Every well-formed request gets the same response
  body and the same UI. The difference is only in the database (a token and an
  outbox row, or not). Response *timing* differs slightly (the known-address
  path writes two more rows) — not equalised.
- **Rate limits** (`lib/password-reset.ts`): 3 requests per address per hour,
  10 per IP per hour. The request is recorded before the count, so a flood
  keeps itself limited. A limited request queues nothing and still answers
  `sent`. `x-forwarded-for` is trusted as sent — behind a proxy that
  overwrites it this is the client IP; directly exposed, a client can rotate it
  and only the per-address limit binds (same as `/contact`).
- **The token is a credential.** Plaintext exists only in the queued email's
  `payload.resetUrl` until the drain sends it, then the drain replaces it with
  `[redacted]`. A row still pending when its `payload.expiresAt` passes is
  parked (`failedAt`, `lastError: 'expired before sending'`) and scrubbed —
  a dead link is never sent.
- **One live link per account.** A new request burns the older ones.
- Suspended accounts are never sent a link.
- The link is built with `siteUrl` in the **recipient's** locale
  (`/en/reset-password?token=…` for an English account).
- Touches no money and no downloads.

## Verified by

`verify:auth` (the reset section: unknown and known address answer the same,
only the known one queues a token and a message, rate limit trips per address
and per IP), `verify:mail` (`auth.passwordReset` renders in both languages and
passes the copy rules), `verify:action-locale` (the action returns keys, never
`t()`), `verify:arabic` (`/forgot-password` and `/en/forgot-password` in the
route list).
