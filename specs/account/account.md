# Account hub

**Route** `/account` · **Access** any authenticated user (buyer, creator, admin) · **Rendering** server component, dynamic (reads the session and the user row)

## Purpose
Landing page for the authenticated area: who you are signed in as, and the way
into every other account surface.

## Data in
- `auth()` session — `session.user.id` and `session.user.role`.
- `db.user.findUnique` — `name`, `email`, `emailVerified`, `phone`,
  `phoneVerified`, `country`, `createdAt`.
- `searchParams.verified` — set by `/account/verify-email` after it redeems a
  token. A flag, not a message: a redirect cannot carry translated copy, so the
  sentence is chosen here in the reader's own language.
- Card list comes from `ACCOUNT_NAV` (`components/layout/nav.ts`), minus
  `/account` itself.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Role badge `t('role.<role>')` | none | Display only |
| «تعديل بياناتك» | `<Link href="/account/profile">` | Opens the edit form |
| Card → `/account/library` | `<Card interactive>` wrapping a link | Navigates |
| Card → `/account/purchases` | as above | Navigates |
| Card → `/account/downloads` | as above | Navigates |
| Card → `/account/boards` | as above | Navigates |
| Card → `/account/security` | as above | Navigates |

Every card is a real link. They were previously inert `<Card>`s carrying
`state.scaffold`, which read as a finished page that silently did nothing.

## States
- **Unauthenticated** — `middleware.ts` redirects to `/sign-in?callbackUrl=<path>`;
  `app/(account)/layout.tsx` repeats the check.
- **`?verified=email`** — success Alert, `account.verifiedEmail`.
- **`?verified=failed`** — destructive Alert, `account.verifiedFailed`. Covers an
  expired token, a replayed one, and a token for an address the user has since
  changed away from.
- **Unverified channel** — the profile card shows a `warning` badge beside the
  email or mobile. The control that fixes it lives on `/account/profile`.
- **Missing field** — `account.profileNotSet` rather than a blank.
- Role variants: badge text only. Buyer, creator and admin see identical cards.

## Invariants
- Never render for an unauthenticated request — the middleware matcher is the
  gate, the route-group layout is the lock, and both must stay in place.
- Country is stored as an ISO code and rendered through `countryName()`, so the
  name appears in the reader's language. Never store a display name.

## Verified by
`npm run audit` (both widths, every route), `npm run verify:auth` (the role-guard
matrix), `npm run verify:arabic` (both language directions).
