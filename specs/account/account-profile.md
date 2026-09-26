# Edit your details

**Route** `/account/profile` · **Access** any authenticated user · **Rendering** server component, dynamic

## Purpose
Change the name, email, mobile and country on the account — and verify the two
channels that are also login credentials.

## Data in
- `auth()` session — `session.user.id`.
- `db.user.findUnique` — `name`, `email`, `phone`, `country`, `emailVerified`,
  `phoneVerified`.
- `COUNTRIES` / `countryName()` (`lib/countries.ts`) for the select.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Name, email, mobile, country + «حفظ» | `updateProfile` | Validates with zod, rejects an email or mobile already on another account, writes the row. **Changing the email clears `emailVerified`; changing the mobile clears `phoneVerified`.** Then `revalidatePath('/account')` and `redirect('/account')`. |
| «أرسل رابط التوثيق» | `sendEmailVerification` | Issues a single-use token (sha256-hashed, 30-minute TTL) and mails it. Acts on the SAVED address, not on what is typed in the field. |
| «أرسل رمز التوثيق» | `sendPhoneCode` | **Not rendered today** — the whole mobile row is hidden while `phoneSignInEnabled()` is false (no SMS provider). When open: issues an OTP through `lib/otp.ts` (bcrypt-hashed, one live challenge per number), sent by SMS only. Both actions also refuse with `auth.phoneUnavailable` while the rail is shut. |
| Code field + «تأكيد» | `confirmPhoneCode` | Same gate. Redeems the OTP, stamps `phoneVerified`, redirects to `/account`. |

The verification block sits **below** the form, not inside it, because it acts
on the stored value rather than the edited one. A verify button beside an input
someone is mid-way through editing invites verifying a value the server has
never seen.

## States
- **Verified channel** — a `success` badge; no control.
- **Unverified channel** — a `warning` badge and its verify control.
- **Empty channel** — the row is not rendered at all. Offering to verify a blank
  mobile is a dead end; the form above is where you add one.
- **Email only at launch** — the verification block shows the email row alone;
  the mobile row appears once an SMS provider exists (DEV-01). The mobile number
  itself can still be saved in the form above.
- **No mail provider configured** — the mail driver says so and hands back the
  link, which the UI shows. (The phone code is never handed back.) A screen that claims
  "check your inbox" for a message that was never sent is a support ticket
  nobody can reproduce. When a provider is wired the fallback stops arriving and
  the UI is unchanged.
- **Redirect result** — success and failure are both reported on `/account` via
  `?verified=`.

## Invariants
- **A verification token is single-use and address-bound.** It carries
  `${userId}:${email}`, so a token cannot verify an address the user has since
  changed away from. Redeeming it twice fails.
- **Redeeming does not require a session** — the token is the proof, and
  demanding a sign-in as well breaks the common case of opening the link on a
  different device.
- **Changing a credential must clear its verified stamp.** The warning above the
  fields states this, and `updateProfile` performs it.
- **Server actions here never call `t()`** — see `specs/localisation.md`. They
  bind the request's language with `actionT()`.
- Redemption is a route handler (`/account/verify-email`), not a page: it
  performs a side effect and must not be replayed by a render.

## Verified by
`npm run audit`, `npm run verify:auth`, `npm run verify:arabic`,
`npm run verify:action-locale`. Both flows were also driven end to end in Chrome
in Arabic and English, including the single-use replay.
