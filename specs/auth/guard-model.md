# Guard model — middleware, route-group layouts, role matrix

**Route** not a route — `middleware.ts` (edge) + the four route-group layouts · **Access** applies to every request that matches the middleware matcher · **Rendering** edge middleware + server layouts

## Purpose
Decide, before a route handler runs, whether the current session may reach a
path — and repeat that decision inside each route-group layout so a matcher
hole cannot leak a guarded page.

## Data in

- **Middleware** (`middleware.ts`, edge runtime): `request.auth?.user` from the
  Auth.js JWT cookie via `NextAuth(authConfig)`. `lib/auth.config.ts` is the
  edge-safe half — `session: { strategy: 'jwt' }`, `providers: []`, no Prisma,
  no bcrypt. **Zero database reads in middleware.**
- **Layouts**: `auth()` from `lib/auth.ts`, again JWT-only. The session shape is
  `{ id, role, locale, creatorId, twoFactorEnabled?, impersonatedBy?, impersonation?, name, email, image }`.
- **`twoFactorEnabled` (the `tfa` claim)** — stamped at sign-in (flag **and** secret
  present), re-read from the database on every node `auth()` with the same `User` read,
  and on `update()`. In middleware it is the cookie's copy: `undefined` on a cookie minted
  before the claim existed. Parked with the admin during a view-as-user and restored when
  it ends (`lib/impersonation-shared.ts`).
- **Token refresh**: the node `jwt` callback reads `User` (role, status,
  `passwordChangedAt`, `creator.id`) on every `auth()` call and applies role and
  `creatorId` to the session (DEV-05), so layouts and actions see a promotion or
  demotion at once. Middleware reads the **cookie**, which only changes on sign-in or
  `update()` — a buyer promoted mid-session is still refused at `/studio` until they
  sign in again.
- Prisma models referenced: `User` (`role`, `locale`, `status`), `Creator` (`id`,
  as `session.user.creatorId`), enum `Role { buyer | creator | admin }`, enum
  `UserStatus { active | suspended | pending_verification }`.

## Controls

This surface is **not interactive** — it renders nothing. It has exactly two
decision tables.

| Control | Action | Effect |
|---|---|---|
| Legacy locale prefix `/(ar\|en)(/…)?` | `NextResponse.redirect(url, 308)` | Strips the segment: `/ar/albums → /albums`, `/en → /`. 308 (not 301) so a POST keeps its method. |
| Guarded path, no session | `NextResponse.redirect('/sign-in?callbackUrl=…')` | `callbackUrl` is `encodeURIComponent(pathname + search)`. |
| Guarded path, wrong role | `NextResponse.rewrite('/forbidden')` | **Rewrite, not redirect** — the typed URL stays in the address bar, and the response is HTTP 200 carrying `app/(public)/forbidden/page.tsx` («لا تملك صلاحية الوصول»). |
| `/admin*` or `/studio*`, creator/admin with `tfa === false` | `NextResponse.redirect(enrolmentUrl(locale, pathname + search))` | Mandatory 2FA (`lib/two-factor.ts`): `/account/security?next=%2Fadmin%2F…`, or `/en/account/security?next=%2Fen%2F…` under English. Only an explicit `false`; an unknown claim is left to the layout. `/account/*` is never held. |
| Layout re-check | `redirect('/sign-in?callbackUrl=…')` or `redirect('/forbidden')` | Same decision, taken again server-side before any page below fetches data. |
| Layout 2FA lock (`(admin)`, `(studio)`) | `redirect(enrolmentUrl(locale, '/admin' \| '/studio'))` | `twoFactorOwed(session.user)` on the **database** value — catches a pre-claim cookie and 2FA removed mid-session. Streams as a 200 carrying `NEXT_REDIRECT`, like the other layout redirects. |

### Path → required access (`requiredAccess`, middleware)

| Path prefix | Required |
|---|---|
| `/admin`, `/admin/*` | `['admin']` |
| `/studio`, `/studio/*` | `['creator', 'admin']` |
| `/account`, `/account/*` | `'authenticated'` (any role) |
| everything else | none |

`lib/auth.ts` exports `canAccess(role, pathname)` which mirrors this table for
non-throwing checks inside pages and actions.

### Role matrix (as asserted by `verify:auth`)

| | `/account` | `/studio` | `/admin` |
|---|---|---|---|
| anonymous | redirect → `/sign-in` | redirect → `/sign-in` | redirect → `/sign-in` |
| `buyer` | allowed | forbidden (200 rewrite) | forbidden (200 rewrite) |
| `creator` | allowed | allowed | forbidden (200 rewrite) |
| `admin` | allowed | allowed | allowed |

### Layout guards (defence in depth)

| Layout | Check | Failure |
|---|---|---|
| `app/(public)/layout.tsx` | none — reads the session only to render `SiteChrome` | — |
| `app/(account)/layout.tsx` | `!session?.user` | `redirect('/sign-in?callbackUrl=/account')` |
| `app/(studio)/layout.tsx` | `!session?.user`; then `role !== 'creator' && role !== 'admin'`; then `twoFactorOwed` | `redirect('/sign-in?callbackUrl=/studio')` / `redirect('/forbidden')` / `redirect('/account/security?next=/studio')` |
| `app/(admin)/layout.tsx` | `!session?.user`; then `role !== 'admin'`; then `twoFactorOwed` | `redirect('/sign-in?callbackUrl=/admin')` / `redirect('/forbidden')` / `redirect('/account/security?next=/admin')` |

Note the layouts **redirect** to `/forbidden` where middleware **rewrites** —
a wrong-role user who somehow bypassed the matcher loses the URL they typed.

### Server-side helpers (`lib/auth.ts`)

`getCurrentUser()` (nullable), `requireUser()` (throws `UNAUTHENTICATED`),
`requireRole(...roles)` (throws `FORBIDDEN`, then `TWO_FACTOR_REQUIRED` for a creator or
admin who has not enrolled), `requireAdmin()`,
`requireCreator()` = `requireRole('creator', 'admin')`. `lib/route-auth.ts#studioActor()`
does the same for the `/api/studio` upload routes (403 `two_factor_required`), which sit
outside the middleware matcher. Server actions use these;
they throw rather than redirect, so they pair with — not replace — the layout guard.

## States

- **Anonymous on a guarded path** → `/sign-in` with the original path preserved
  as `callbackUrl`, which `safeRedirect` then re-validates as same-origin before
  the sign-in action honours it.
- **Wrong role** → forbidden page at HTTP 200 (rewrite). Any HTTP-status-based
  test will see 200, which is why `verify:auth` probes for the Arabic string
  «لا تملك صلاحية الوصول» instead.
- **Admin on `/studio`** → allowed by the guard, but `app/(studio)/studio/page.tsx`
  then does `if (!user.creatorId) redirect('/sell')` — an admin with no creator
  profile lands on the seller pitch page, not the studio dashboard.
- **Role changed mid-session** → the JWT still carries the old role until an
  explicit `update` trigger refreshes it from the DB. Middleware, which reads
  only the token, will keep enforcing the stale role.
- **Creator/admin without 2FA** → signs in normally (refusing them would leave no way
  to reach enrolment), then is held on `/account/security?next=…` for every `/admin*` and
  `/studio*` request, in the language they were reading. After enrolling, the cookie is
  re-issued (`unstable_update`) and they go back to `next`. A cookie from another browser,
  minted before enrolment, is held until «المتابعة» (or any `/api/auth/session` fetch)
  refreshes it from the database.
- **Suspended user** → blocked at `authorize` time (no new session), and — since
  DEV-48 — an already-issued JWT is refused at the next `auth()` call: the `jwt`
  callback's per-call account read returns `null` for `status='suspended'`, so the
  session ends on the next server render (middleware, on the edge, still admits the
  cookie; the route-group layout is the lock).
- **Rate limits (DEV-48, `lib/rate-limit.ts`)** — in-process fixed windows, keys
  hashed: sign-in 10 consecutive failures per account and 40 attempts per network
  per 15 min (enforced in `authorize`, before the input's shape is checked — so a
  malformed guess counts too — and so a POST straight to the Auth.js callback
  meets it too; a success clears the account's count; a locked sign-in throws
  `RateLimitedError`, `code='rate_limited'`); sign-up 10 per network per hour;
  checkout 20 orders and 30 promo previews per account per 10 min. Loopback and an
  unknown client IP are exempt from the per-network limits only. One server process
  at launch — several instances would each keep their own counts.
- **Security headers (DEV-48, `next.config.mjs`)** — every page (not `/api/*` or the
  certificate PDFs) carries a Content-Security-Policy: `default-src 'self'`; scripts
  from self (+ inline, for Next's hydration) and Google Tag Manager only; images,
  media and fetches from self, the media CDN (`NEXT_PUBLIC_MEDIA_CDN_URL`), S3 for
  studio uploads and Google Analytics; `frame-ancestors 'none'`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`. Plus `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, a
  `Permissions-Policy` refusing camera/microphone/geolocation.
- **Impersonation (view-as-user)** → the token's identity IS the customer's for the
  view, so the guard enforces the customer's role (an admin viewing a buyer cannot
  reach `/admin`). Middleware additionally refuses, with a 403, every non-GET request
  and the writing GETs listed in `lib/impersonation-shared.ts` while
  `impersonatedBy` is set, except `POST /api/impersonation/end`, and stamps
  `x-laqta-impersonation` on the forwarded request (stripped otherwise) for
  `lib/db.ts`'s write guard. Still no database read in middleware: expiry is checked
  on the token alone. See `specs/admin/admin-users-id.md`.
- **Matcher exclusions** — `api/auth`, `_next/static`, `_next/image`,
  `favicon.ico`, `robots.txt`, `sitemap.xml`, and **any path containing a dot**
  are not seen by middleware at all. A guarded route with a dot in its path
  would be enforced only by its layout.

## Invariants

- Middleware must stay edge-safe: no Prisma, no bcrypt, no provider imports.
  `lib/auth.config.ts` exists solely to keep that boundary.
- The guard runs before any route handler — an unauthorised request must never
  reach data-fetching code. The layout check is not a substitute; both must stay.
- The wrong-role response is a rewrite, never a redirect, from middleware.
- Two-factor is mandatory for `creator` and `admin` on `/admin*` and `/studio*`, held by
  middleware (cookie), the layouts (database) and `requireRole`/`studioActor` (actions and
  upload routes). There is no bypass — not in development either: the demo accounts are
  enrolled by the seed, and the gates type the code (`scripts/two-factor-fixture.mjs`).
- `callbackUrl` is only ever honoured through `safeRedirect` (same-origin path,
  no protocol-relative `//`) in the sign-in actions.
- Guards decide access only. They never read or write money, entitlements or
  downloads; the frozen invariants (`OrderItem.clipManifestSnapshot`,
  `OrderItem.commissionRate`) live in `lib/orders.ts` and are untouched here.

## Verified by

`verify:auth` — (DEV-48) a suspension ends an open session and `/account` redirects; ten wrong passwords lock the account (the right one then refused); `/` carries the CSP and nosniff/referrer headers. And the whole matrix, over HTTP, against a running server: anonymous
redirects for `/account`, `/studio`, `/admin`, plus buyer/creator/admin against
each, and the mandatory-2FA hold (middleware redirect with `next` in both languages,
`/account/*` and sign-out open, the stale-cookie case, the layout lock, the upload-route
403). Also `verify:arabic` for the `/en/*` and `/ar/*` 308 redirects. `audit`
walks every route in real Chrome and would catch a guard that renders an error
boundary at 200.
