# Security

**Route** `/account/security` (`/en/account/security`) · **Access** any authenticated user · **Rendering** server component shell + client card (`two-factor-card.tsx`), dynamic

## Purpose
Enrol in, or turn off, TOTP two-factor authentication. It is the only
self-service security control in the account area — and, for a creator or admin
who has not enrolled, **the page every `/admin/*` and `/studio/*` request is
sent to** until they do (mandatory 2FA, `lib/two-factor.ts`).

## Data in
- `requireUser()` for the session user id.
- `db.user.findUnique({ where: { id }, select: { twoFactorEnabled, twoFactorSecret, role } })`.
  "Enabled" means the flag **and** a secret — the same rule sign-in and the
  session claim use.
- `twoFactorRequired(role)` from `lib/two-factor.ts` (re-exported by
  `lib/totp.ts`) — true for `creator` and `admin` (`TWO_FACTOR_REQUIRED_ROLES`).
- `?next=` — where the 2FA hold came from, e.g. `/admin/orders?status=paid` or
  `/en/studio/albums`. Passed through `safeDashboardReturn()`: only a same-site
  `/admin…` or `/studio…` path (with or without `/en`) is kept; anything else
  (`https://…`, `//…`, `/account/…`) is dropped. Ignored for buyers.
- The TOTP secret itself is never sent to the page on load; it is returned only
  by the enrolment action, in memory, for the duration of the form.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «تفعيل» (2FA off) | `beginTwoFactorEnrolment()` server action | Generates a 20-byte base32 secret, writes `User.twoFactorSecret` and sets `twoFactorEnabled = false`, returns `{ secret, uri }`; the card switches to the confirm form |
| Secret field «المفتاح السري» | none (readOnly, `dir="ltr"`, selects on focus) | Manual entry into an authenticator. No QR code is rendered — deliberate, to avoid a rendering dependency on the security path |
| Confirm form «أدخل الرمز لتأكيد التفعيل» + «تفعيل» | `confirmTwoFactor(formData)` server action | Verifies the 6-digit token against the stored secret (`verifyToken`, ±1 30s step, `timingSafeEqual`); on success sets `twoFactorEnabled = true`, writes an audit row `user.two_factor.enable`, **re-issues the session cookie (`unstable_update({})`) so the new `tfa` claim reaches middleware**, revalidates `/account/security`. The client then goes to `next` with a full navigation (`window.location.assign`) when there is one, else `router.refresh()` |
| «المتابعة» (enabled **and** a valid `next`) | `refreshTwoFactorSession()` server action, then `window.location.assign(next)` | For an account that enrolled in another browser: this browser's cookie still says `tfa: false`, so middleware keeps sending it here. The action re-issues the cookie from the database; nothing else changes |
| «إيقاف» (2FA on, buyer only) | `disableTwoFactor()` server action | Clears `twoFactorEnabled` and `twoFactorSecret`, writes audit `user.two_factor.disable` |

There is no other control here — no password change, no email/phone change, no
session list, no recovery codes. Sign-out is the header's account menu, which
stays reachable while held here.

## States
- **Held (creator/admin, 2FA off)** — an `info` Alert above the card,
  `data-two-factor="required"`: title «فعّل التحقق بخطوتين لتدخل» / "Turn on
  two-factor to continue", body «لوحة الإدارة واستوديو صنّاع المحتوى لا يُفتحان
  قبل تفعيل التحقق بخطوتين على حسابك. فعّله من هنا، ثم نعيدك إلى حيث كنت.»
  Shown whenever the role requires 2FA and it is off, with or without `next`.
- 2FA off: status badge «غير مُفعّل» + an «تفعيل» button.
- Enrolling: the confirm form replaces the buttons. `useTransition` disables the
  submit button while pending.
- Bad code: `confirmTwoFactor` returns `{ ok: false, messageKey: 'security.invalidToken' }`
  and the card renders a destructive alert «الرمز غير صحيح». No lockout, no
  attempt counter, no rate limit.
- 2FA on, buyer: status badge «مُفعّل» + an «إيقاف» button.
- 2FA on, creator or admin: no disable button at all — only the explanatory line
  «التحقق بخطوتين إلزامي لحسابات صنّاع المحتوى والإدارة.» The server action
  enforces the same rule independently and refuses with that message key even if
  the request is forged.
- **Ready (2FA on, valid `next`)** — below a rule inside the card,
  `data-two-factor="ready"`: «التحقق بخطوتين مفعّل. حسابك جاهز. تابع إلى الصفحة
  التي كنت تقصدها.» + «المتابعة» (the card's one gold action).
- Loading/error: no route-level `loading.tsx` or `error.tsx`; action failures are
  rendered inline in the card, successes as a toast.
- Recovery: **no backup codes exist.** A user who loses the authenticator has no
  self-service path back in, and no admin control resets 2FA — it is a database
  edit today.

## Invariants
- `twoFactorEnabled` stays false until a live code verifies. The secret is
  written first so the authenticator's codes can be checked against it — an
  abandoned enrolment must never lock anyone out.
- Two-factor may not be disabled for `creator` or `admin`. Hiding the button is
  not the gate; `disableTwoFactor()` re-checks `twoFactorRequired(role)`.
- **This page is never held.** `/account/*` is outside the 2FA hold; it is where
  the hold sends people. The hold itself (middleware, the `(admin)`/`(studio)`
  layouts, `requireRole()`, `studioActor()`) is described in
  [`specs/auth/guard-model.md`](../auth/guard-model.md).
- «المتابعة» and the post-enrolment jump only ever go to a dashboard path
  (`safeDashboardReturn`) — `next` is never an open redirect.
- The secret leaves the server exactly once, in the enrolment response, and is
  never re-rendered on a later load.
- Both enable and disable write an `AuditLog` row.

## Verified by
`verify:auth` — 2FA rail (password alone refused, password + code accepted,
wrong code refused); the mandatory hold: an unenrolled admin and creator are
sent here from `/admin`, `/admin/orders?…`, `/studio`, `/en/admin` and
`/en/studio/albums` with the right `next`, while `/account`, this page (both
languages) and sign-out stay open; the notice renders in Arabic and English; a
cookie from before enrolling is still held and the page offers «المتابعة»; an
off-site / non-dashboard `next` gets no «المتابعة»; a refreshed session opens
`/admin`. `verify:flows` — an admin-promoted creator lands here from `/studio`
with the notice, then reaches the studio once enrolled. `verify:arabic`,
`audit`.
