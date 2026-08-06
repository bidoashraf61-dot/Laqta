# Sign in

**Route** `/sign-in` · **Access** anonymous (signed-in users are redirected away) · **Rendering** server, dynamic (calls `auth()`, reads `searchParams`)

## Purpose
Start a session on one of two equal rails — email + password, or phone OTP — and
hand the user back to wherever the guard interrupted them.

## Data in

- `auth()` session lookup (JWT cookie, no DB read on the page itself). If a
  session exists the page never renders: `redirect(callbackUrl ?? '/')`.
- `searchParams.callbackUrl` — the path the middleware guard captured.
- No Prisma reads at render time. The server actions read/write:
  - `User` — `findUnique({ where: { email } })` including `creator: { select: { id } }`
    (email rail, in `lib/auth.ts` `authorize`); `upsert({ where: { phone } })`
    (phone rail — see Invariants).
  - `PhoneOtp` — `deleteMany({ where: { phone, consumedAt: null } })` then
    `create` on issue; `findFirst({ where: { phone, consumedAt: null, expiresAt: { gt: now } }, orderBy: { createdAt: 'desc' } })` on consume.

## Controls

| Control | Action | Effect |
|---|---|---|
| Tab «البريد الإلكتروني» / «رمز الجوال» | client `Tabs` state | Switches rail. Email is the default tab; phone is not hidden behind "other methods". |
| Email form → «تسجيل الدخول» | `signInWithEmail(formData)` (`app/(public)/sign-in/actions.ts`) | Zod-validates `{ email, password, totp? }`, lowercases the email, calls Auth.js `signIn('email', { redirect: false })`. On success the client does `router.push(redirectTo)` + `router.refresh()`. |
| TOTP field «التحقق بخطوتين» | same `signInWithEmail`, resubmitted with `totp` | Rendered only after the action returns `status: 'two_factor'`. 6 digits, `dir="ltr"`, `.numeric`, `autoFocus`. |
| Phone form → «إرسال الرمز» | `requestPhoneCode(formData)` | Requires ≥6 digits, normalises via `normalisePhone`, calls `issueOtp(phone)`. Returns `{ phone, devCode }`. |
| Code form → «تحقق» | `signInWithPhone(formData)` | Calls Auth.js `signIn('phone', { phone, code, redirect: false })`. |
| «تغيير الرقم» | client state reset | Clears `sentTo`/`devCode`, returns to the number step. Does not invalidate the issued OTP. |
| Link «إنشاء حساب» | navigation to `/sign-up` | Read-only link. |

Hidden `callbackUrl` input is emitted on the email form and on the OTP verify
step, not on the send-code step.

## States

- **Signed in already** — page never renders; `redirect(callbackUrl ?? '/')`.
- **Pending** — submit button label swaps to `t('state.loading')` and is
  `disabled`; driven by `useTransition`.
- **Error (email rail)** — any failure (bad Zod parse, unknown email, wrong
  password, wrong TOTP, suspended account) returns the single key
  `auth.invalidCredentials` → «بيانات الدخول غير صحيحة». Account existence is
  never disclosed.
- **Two-factor challenge** — `TwoFactorRequiredError` (`code = 'two_factor_required'`)
  is thrown by `authorize` only when `twoFactorEnabled && twoFactorSecret` and no
  code was supplied. The action detects it by both `error.code` and a substring
  match on `error.message`, and returns `status: 'two_factor'`. The password is
  verified *before* this throw, so an attacker with the wrong password never
  learns the account carries 2FA.
- **Error (phone rail)** — bad/expired/exhausted/replayed code returns
  `auth.invalidCode` → «الرمز غير صحيح أو منتهي الصلاحية».
- **Dev OTP notice** — with no `SMS_PROVIDER`/`SMS_API_KEY` env, `sendSms`
  logs the code, returns `delivered: false`, and the code is rendered in a
  warning alert: «وضع التطوير: الرمز هو {code}». **SMS delivery is not wired.**
  With `SMS_PROVIDER` set but unimplemented, `issueOtp` throws.
- **Empty** — n/a, the form always renders.
- No password-reset, no "resend code" control (`auth.resendCode` exists in the
  dictionary but is unused), no email-verification step.

## Invariants

- Every email-rail failure returns the same message key. No user enumeration.
- `safeRedirect` in the actions accepts only same-origin paths: must start with
  `/` and must not start with `//`. Anything else falls back to `/`.
- OTP codes are bcrypt-hashed at rest (`PhoneOtp.codeHash`); the plaintext is
  never stored. TTL 5 minutes, max 5 attempts per challenge, single-use
  (`consumedAt`), one live challenge per number.
- TOTP verification uses `timingSafeEqual` with a ±1 step (±30 s) window.
- **The phone rail is also a sign-up rail.** `authorize` for `phone` does
  `db.user.upsert({ where: { phone }, create: { phone, phoneVerified, locale: 'ar' }, ... })`
  — a first-time verified number silently creates a `User` with `role: 'buyer'`
  (schema default), no name and no email.
- `status: 'suspended'` users are rejected on both rails.
- Touches no money and no downloads.

## Verified by

`verify:auth` (both rails end-to-end over HTTP, OTP replay/expiry, TOTP
accept/reject, the full guard matrix), `verify:arabic` (`/sign-in` is in the
route list, plus the `/en/sign-in → /sign-in` redirect case), `audit`
(real Chrome pass at desktop + phone), `verify:flows` and `audit` both use
`/sign-in` as their login step.
