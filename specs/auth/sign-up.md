# Sign up

**Route** `/sign-up` · **Access** anonymous (signed-in users are redirected to `/`) · **Rendering** server, dynamic (calls `auth()`)

## Purpose
Create a buyer account from name + email + password, and sign it in immediately
in the same round trip.

## Data in

- `auth()` session lookup. If a session exists: `redirect('/')` — this page
  ignores `callbackUrl` entirely.
- No Prisma reads at render time. The action `signUpWithEmail` (defined in
  `app/(public)/sign-in/actions.ts`, imported across route folders) does:
  - `User.findUnique({ where: { email }, select: { id: true } })` — existence check.
  - `User.create({ data: { email, name, passwordHash, locale: 'ar', role: 'buyer' } })`.
  - Then Auth.js `signIn('email', …)`, which re-reads the `User` with
    `creator: { select: { id } }`.

## Controls

| Control | Action | Effect |
|---|---|---|
| «الاسم» field | — | `minLength={2}`, no `dir` override (Arabic content expected). |
| «البريد الإلكتروني» field | — | `type="email"`, `dir="ltr"`, `autoComplete="email"`. |
| «كلمة المرور» field | — | `type="password"`, `dir="ltr"`, `minLength={8}`, hint «٨ أحرف على الأقل». |
| «إنشاء حساب» submit | `signUpWithEmail(formData)` | Zod: name ≥2, valid email, password ≥8. Creates the user, hashes with bcrypt cost 12, then signs in. On `ok` the client does `router.push('/')` + `router.refresh()`. |
| Link «تسجيل الدخول» | navigation to `/sign-in` | Read-only link. |

There is no phone sign-up form here — a phone account is created implicitly by
the OTP rail on `/sign-in`.

## States

- **Signed in already** — never renders; `redirect('/')`.
- **Pending** — button label swaps to `t('state.loading')`, disabled.
- **Validation error** — any Zod failure returns `auth.invalidCredentials` →
  «بيانات الدخول غير صحيحة». Client-side `required`/`minLength` catch most of it first.
- **Duplicate email** — returns `auth.accountExists` → «هذا الحساب موجود مسبقًا».
  This is a deliberate enumeration trade-off: `/sign-up` discloses existence,
  `/sign-in` does not.
- **Created but session failed** — if the post-create `signIn` throws an
  `AuthError`, the action returns `auth.somethingWentWrong` →
  «تعذّر إكمال العملية، حاول مجددًا». **The user row is already committed**;
  there is no rollback, so the retry path is `/sign-in`.
- **Empty / loading** — n/a, static form.
- No email verification is sent or required (`User.emailVerified` stays null).
  No creator sign-up path — becoming a creator goes through `/sell`.

## Invariants

- New accounts are always `role: 'buyer'`, `locale: 'ar'`, `status: 'active'`
  (schema default). A role is never chosen by the user at sign-up.
- Passwords are stored only as a bcrypt hash (cost 12) in `User.passwordHash`.
- `redirectTo` is hard-coded to `'/'`; `safeRedirect` is not involved here
  because no callback is accepted.
- Touches no money and no downloads.

## Verified by

`verify:arabic` (`/sign-up` is in the route list), `audit` (real Chrome, desktop
+ phone: script errors, unlabelled controls, heading order, RTL). `verify:auth`
covers sign-*in* with seeded users, not the create path — account creation is
not directly gated.

## Heading level

`CardTitle` defaults to `<h2>` — correct for a card among cards, wrong here,
where the card IS the page. This route passes `as="h1"`. Without it the page had
no `<h1>` at all, and since every guarded route redirects here when signed out,
that single omission reported as 46 findings across the portal in `npm run audit`.
