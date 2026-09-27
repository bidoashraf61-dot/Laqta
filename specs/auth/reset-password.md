# Reset password

**Route** `/reset-password?token=…` (+ `/en/reset-password?token=…`) · **Access** anyone holding a live token · **Rendering** server, dynamic (reads `searchParams`, one DB read); `robots: noindex, nofollow`, `referrer: no-referrer`

## Purpose
Where the reset email lands. Choose a new password, and every session the
account had ends. Reached only from the `auth.passwordReset` email (or the dev
link on `/forgot-password`).

## Data in

- `searchParams.token` — the plaintext token from the email.
- Render and `generateMetadata` (the tab title follows the card: «اختر كلمة مرور
  جديدة» or «هذا الرابط ما عاد يشتغل»): `isResetTokenLive(token)` — `PasswordResetToken.findUnique({ where:
  { tokenHash: sha256(token) } })` with the user's `status`. Read-only; the page
  never consumes the token.
- Server action `completeReset(formData)` (`app/(public)/forgot-password/actions.ts`)
  → `resetPassword(token, password)` (`lib/password-reset.ts`):
  - claim: `PasswordResetToken.updateMany({ where: { id, usedAt: null,
    expiresAt: { gt: now } }, data: { usedAt: now } })` — a compare-and-set, so
    the same link submitted twice succeeds once;
  - then one transaction: `User.update({ passwordHash: bcrypt(12),
    passwordChangedAt: now })` and every other live token of the user burned.

- **Meta description (DEV-38)** — `brand.seo.resetPassword`, in the page's language.

## Controls

| Control | Action | Effect |
|---|---|---|
| «كلمة المرور الجديدة» (`#password`, hint «٨ أحرف على الأقل») | — | `type="password"`, `dir="ltr"`, `autoComplete="new-password"`, `autoFocus`. |
| «أعد كتابة كلمة المرور» (`#confirm`) | — | Same attributes. |
| «احفظ كلمة المرور» (gold) | `completeReset(formData)` | Length ≥ 8 and match are checked in the browser first, then again in the action. |
| «تسجيل الدخول» (gold, done state) | plain `<a>` → `/sign-in` (locale kept) | Full load, so the header re-renders signed out. |
| «اطلب رابطاً جديداً» (gold, dead-link state) | plain `<a>` → `/forgot-password` (locale kept) | The way out of a dead end must always commit. |

The password rule is the one sign-up and the email rail already use: at least 8
characters (`PASSWORD_MIN`). No new rules were invented here.

## States

- **Live token** — `<h1>` «اختر كلمة مرور جديدة», description «بعد ما تحفظها،
  نسجّل خروج حسابك من كل الأجهزة وتدخل من جديد.», the form.
- **Dead token** (missing, unknown, used, expired, superseded by a newer
  request, or the account suspended) — `<h1>` «هذا الرابط ما عاد يشتغل», «روابط
  تعيين كلمة المرور تشتغل مرة وحدة، وخلال ٣٠ دقيقة من طلبها. اطلب رابطاً
  جديداً.», and the request-new button. No form. The page does not say which
  of those it was.
- **Pending** — button label `state.loading`, `disabled`.
- **Too short / mismatch** — destructive alert `auth.passwordTooShort` /
  `auth.passwordMismatch`.
- **Token died between render and submit** — destructive alert
  `auth.resetInvalidTitle`.
- **Done** — `role="status"` block: `<h2>` «تغيّرت كلمة المرور», «ادخل الحين
  بكلمة المرور الجديدة. إذا كان حسابك عليه تحقق بخطوتين، بنطلب رمز التطبيق مثل
  العادة.», and the sign-in button.

## Invariants

- **Single use.** The claim is a compare-and-set on `usedAt`; a completed reset
  also burns every other live token of the account.
- **30 minutes.** `expiresAt` is checked on render and again, atomically, in the
  claim.
- **Every existing session ends.** Sessions are JWTs (no DB session table), so
  the reset stamps `User.passwordChangedAt`; the `jwt` callback in `lib/auth.ts`
  stores `signedInAt` at sign-in and, on every later `auth()` call, returns
  `null` (signed out) when `passwordChangedAt` is later. Tokens minted before
  this change carry no `signedInAt` and fall back to `iat`. Middleware (edge,
  no DB) still admits a stale cookie; the route-group layout's `auth()` then
  refuses it — the gate/lock split in [`guard-model.md`](./guard-model.md).
  Because the layout redirects after the shell has started streaming, that
  refusal arrives as HTTP 200 carrying `NEXT_REDIRECT;…;/sign-in` in the
  payload (the browser follows it), not as a 307. `verify:auth`'s `probe`
  counts it as `redirected`.
- **2FA is untouched.** `twoFactorEnabled` / `twoFactorSecret` are not written;
  the next sign-in still raises `two_factor_required`.
- **The old password stops working** the moment the transaction commits.
- The token never leaves this page: `referrer: 'no-referrer'`, noindex.
- Touches no money and no downloads.

## Verified by

`verify:auth` (the reset section: token single-use, expired token refused and
the password unchanged, old password refused and new one accepted, a session
cookie minted before the reset no longer returns a session, a 2FA account still
gets the challenge after a reset), `verify:action-locale`, `verify:arabic`
(`/reset-password` and `/en/reset-password` — the dead-link state — in the route
list).
