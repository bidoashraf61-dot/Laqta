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
  `{ id, role, locale, creatorId, impersonatedBy?, name, email, image }`.
- **Token refresh**: `jwt` callback re-reads `User` (with `creator: { select: { id } }`)
  only on `trigger === 'update'` — role and `creatorId` changes are otherwise
  invisible until the token is refreshed.
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
| Layout re-check | `redirect('/sign-in?callbackUrl=…')` or `redirect('/forbidden')` | Same decision, taken again server-side before any page below fetches data. |

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
| `app/(studio)/layout.tsx` | `!session?.user`; then `role !== 'creator' && role !== 'admin'` | `redirect('/sign-in?callbackUrl=/studio')` / `redirect('/forbidden')` |
| `app/(admin)/layout.tsx` | `!session?.user`; then `role !== 'admin'` | `redirect('/sign-in?callbackUrl=/admin')` / `redirect('/forbidden')` |

Note the layouts **redirect** to `/forbidden` where middleware **rewrites** —
a wrong-role user who somehow bypassed the matcher loses the URL they typed.

### Server-side helpers (`lib/auth.ts`)

`getCurrentUser()` (nullable), `requireUser()` (throws `UNAUTHENTICATED`),
`requireRole(...roles)` (throws `FORBIDDEN`), `requireAdmin()`,
`requireCreator()` = `requireRole('creator', 'admin')`. Server actions use these;
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
- **Suspended user** → blocked at `authorize` time (no new session), *not* by
  the guard. An already-issued JWT for a user suspended afterwards keeps working
  until it expires.
- **Impersonation** → `session.user.impersonatedBy` is carried through the `jwt`
  and `session` callbacks; the guard itself ignores it and enforces the
  impersonated role.
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
- `callbackUrl` is only ever honoured through `safeRedirect` (same-origin path,
  no protocol-relative `//`) in the sign-in actions.
- Guards decide access only. They never read or write money, entitlements or
  downloads; the frozen invariants (`OrderItem.clipManifestSnapshot`,
  `OrderItem.commissionRate`) live in `lib/orders.ts` and are untouched here.

## Verified by

`verify:auth` — the whole matrix, over HTTP, against a running server: anonymous
redirects for `/account`, `/studio`, `/admin`, plus buyer/creator/admin against
each. Also `verify:arabic` for the `/en/*` and `/ar/*` 308 redirects. `audit`
walks every route in real Chrome and would catch a guard that renders an error
boundary at 200.
