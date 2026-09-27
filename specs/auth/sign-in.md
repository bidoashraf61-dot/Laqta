# Sign in

**Route** `/sign-in` · **Access** anonymous (signed-in users are redirected away) · **Rendering** server, dynamic (calls `auth()`, reads `searchParams`)

## Purpose
Start a session and hand the user back to wherever the guard interrupted them.
**Email + password is the only open rail at launch.** The phone-OTP rail is
built but shut until an SMS provider exists (`phoneSignInEnabled()` in
`lib/otp.ts`, DEV-01); the page then renders the email form alone, with no tabs.

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

- **Meta description (DEV-38)** — `brand.seo.signIn`, in the page's language.

## Controls

| Control | Action | Effect |
|---|---|---|
| Tab «البريد الإلكتروني» / «رمز الجوال» | client `Tabs` state | **Rendered only when `phoneEnabled`** (the page passes `phoneSignInEnabled()`). Otherwise the email form renders on its own. When shown, email is the default tab; phone is not hidden behind "other methods". |
| Email form → «تسجيل الدخول» | `signInWithEmail(formData)` (`app/(public)/sign-in/actions.ts`) | Zod-validates `{ email, password, totp? }`, lowercases the email, calls Auth.js `signIn('email', { redirect: false })` — passing `totp` **only when one was typed** (an absent key is posted by Auth.js as the string `"undefined"`, which read as a wrong code and refused every enrolled account). On success the client does `router.push(redirectTo)` + `router.refresh()`. Email and password are **controlled** inputs so they survive the form action's reset. |
| TOTP field «التحقق بخطوتين» | same `signInWithEmail`, resubmitted with `totp` | Rendered only after the action returns `status: 'two_factor'`, under the still-filled email and password. 6 digits, `dir="ltr"`, `.numeric`, `autoFocus`. |
| Phone form → «إرسال الرمز» | `requestPhoneCode(formData)` | Phone tab only. Returns `auth.phoneUnavailable` «الدخول برمز الجوال غير متاح حالياً. ادخل ببريدك الإلكتروني.» while the rail is shut. Otherwise requires ≥6 digits, normalises via `normalisePhone`, calls `issueOtp(phone)` (code goes out by SMS). Returns `{ phone }` — never the code. |
| Code form → «تحقق» | `signInWithPhone(formData)` | Calls Auth.js `signIn('phone', { phone, code, redirect: false })`. The provider's `authorize` returns `null` while the rail is shut, whatever the code. |
| «تغيير الرقم» | client state reset | Clears `sentTo`, returns to the number step. Does not invalidate the issued OTP. |
| Link «نسيت كلمة المرور؟» | `Link` → `/forgot-password` | Under the password field, inline-end, muted (not gold — the submit button is the form's one gold voice). Email tab only; the phone rail has no password. See [`forgot-password.md`](./forgot-password.md). |
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
- **Too many attempts (DEV-48)** — after 10 consecutive failures for one account, or
  40 attempts from one network, within 15 minutes, `authorize` throws
  `RateLimitedError` and the form shows `auth.rateLimited` «محاولات كثيرة ورا بعض.
  انتظر دقائق وجرّب مرة ثانية.» — even for the right password, until the window
  resets. A successful sign-in clears the account's count.
- **Two-factor challenge** — `TwoFactorRequiredError` (`code = 'two_factor_required'`)
  is thrown by `authorize` only when `twoFactorEnabled && twoFactorSecret` and no
  code was supplied. The action detects it by both `error.code` and a substring
  match on `error.message`, and returns `status: 'two_factor'`. The password is
  verified *before* this throw, so an attacker with the wrong password never
  learns the account carries 2FA.
- **Creator/admin not enrolled** — signs in without a code (there is nothing to
  ask for), then `/admin*` and `/studio*` hold them on `/account/security` until
  they enrol. See [`guard-model.md`](./guard-model.md).
- **Error (phone rail)** — bad/expired/exhausted/replayed code returns
  `auth.invalidCode` → «الرمز غير صحيح أو منتهي الصلاحية».
- **Phone rail shut** (today) — no tabs, email form only. There is no dev-code
  notice any more: the code is never shown in the browser in any environment.
- **Empty** — n/a, the form always renders.
- Password reset lives on its own routes (`/forgot-password` →
  `/reset-password`), linked from the email tab. No "resend code" control (`auth.resendCode` exists in the
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
- **No phone session without SMS.** `phoneSignInEnabled()` is checked in the
  `phone` provider's `authorize` (the lock), in `requestPhoneCode`, and on the
  page (the tab). No action returns an OTP to the client.
- **A password reset ends every session.** The `jwt` callback stamps
  `token.signedInAt` at sign-in and, on every later call, reads
  `User.passwordChangedAt` (one indexed read per `auth()`); a session that began
  before it returns `null`. See [`reset-password.md`](./reset-password.md).
- Touches no money and no downloads.

## Verified by

`verify:auth` (email rail end-to-end over HTTP; phone rail refused with a
correct code, no plain code in production, no phone tab in the HTML; OTP store
replay/wrong-code in-process; TOTP
accept/reject, the full guard matrix), `verify:arabic` (`/sign-in` is in the
route list, plus the `/en/sign-in → /sign-in` redirect case), `audit`
(real Chrome pass at desktop + phone), `verify:flows` and `audit` both use
`/sign-in` as their login step — the seeded creator and admin are enrolled, so
those gates also type the TOTP code (`scripts/two-factor-fixture.mjs#submitSignIn`),
which exercises the challenge step in real Chrome.

## Heading level

`CardTitle` defaults to `<h2>` — correct for a card among cards, wrong here,
where the card IS the page. This route passes `as="h1"`. Without it the page had
no `<h1>` at all, and since every guarded route redirects here when signed out,
that single omission reported as 46 findings across the portal in `npm run audit`.
