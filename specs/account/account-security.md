# Security

**Route** `/account/security` · **Access** any authenticated user · **Rendering** server component shell + client card (`two-factor-card.tsx`), dynamic

## Purpose
Enrol in, or turn off, TOTP two-factor authentication. It is the only
self-service security control in the account area.

## Data in
- `requireUser()` for the session user id.
- `db.user.findUnique({ where: { id }, select: { twoFactorEnabled, role } })`.
- `twoFactorRequired(role)` from `lib/totp.ts` — true for `creator` and `admin`
  (`TWO_FACTOR_REQUIRED_ROLES`).
- The TOTP secret itself is never sent to the page on load; it is returned only
  by the enrolment action, in memory, for the duration of the form.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «تفعيل» (2FA off) | `beginTwoFactorEnrolment()` server action | Generates a 20-byte base32 secret, writes `User.twoFactorSecret` and sets `twoFactorEnabled = false`, returns `{ secret, uri }`; the card switches to the confirm form |
| Secret field «المفتاح السري» | none (readOnly, `dir="ltr"`, selects on focus) | Manual entry into an authenticator. No QR code is rendered — deliberate, to avoid a rendering dependency on the security path |
| Confirm form «أدخل الرمز لتأكيد التفعيل» + «تفعيل» | `confirmTwoFactor(formData)` server action | Verifies the 6-digit token against the stored secret (`verifyToken`, ±1 30s step, `timingSafeEqual`); on success sets `twoFactorEnabled = true`, writes an audit row `user.two_factor.enable`, revalidates and `router.refresh()` |
| «إيقاف» (2FA on, buyer only) | `disableTwoFactor()` server action | Clears `twoFactorEnabled` and `twoFactorSecret`, writes audit `user.two_factor.disable` |

There is no other control here — no password change, no email/phone change, no
session list, no recovery codes.

## States
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
- Loading/error: no route-level `loading.tsx` or `error.tsx`; action failures are
  rendered inline in the card, successes as a toast.
- Recovery: **no backup codes exist.** A user who loses the authenticator has no
  self-service path back in.

## Invariants
- `twoFactorEnabled` stays false until a live code verifies. The secret is
  written first so the authenticator's codes can be checked against it — an
  abandoned enrolment must never lock anyone out.
- Two-factor may not be disabled for `creator` or `admin`. Hiding the button is
  not the gate; `disableTwoFactor()` re-checks `twoFactorRequired(role)`.
- The secret leaves the server exactly once, in the enrolment response, and is
  never re-rendered on a later load.
- Both enable and disable write an `AuditLog` row.
- Known defect: both actions call
  `revalidatePath('/[locale]/account/security', 'page')` — a stale locale-prefixed
  path from before the site went Arabic-only. It revalidates nothing; the UI
  updates only because the client calls `router.refresh()`.

## Verified by
`verify:auth` (2FA rail: password alone refused, password + code accepted, wrong
code refused; role-guard matrix), `verify:arabic`, `audit`.
