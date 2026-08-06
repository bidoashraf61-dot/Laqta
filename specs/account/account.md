# Account hub

**Route** `/account` · **Access** any authenticated user (buyer, creator, admin) · **Rendering** server component, dynamic (reads the session)

## Purpose
Landing page for the authenticated area: shows the signed-in user's role and a
grid of cards naming the other account surfaces.

## Data in
- `auth()` session only — reads `session.user.role` to render the role badge.
- No Prisma query of its own.
- Card list comes from the static `ACCOUNT_NAV` array in `components/layout/nav.ts`,
  filtered to drop `/account` itself.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Role badge `t('role.<role>')` | none | Display only |
| Cards for `nav.library`, `nav.boards`, `nav.orders` | none | **Not links.** `<Card>` with a title and the description `t('state.scaffold')`. Rendered as static text; clicking does nothing. |
| «التحقق بخطوتين (TOTP)» button | `<Link href="/account/security">` | Navigates to the security page. The only working control on the page. |

Apart from the security link this surface is read-only and non-navigational.

## States
- Unauthenticated: `middleware.ts` redirects to `/sign-in?callbackUrl=<path>`;
  `app/(account)/layout.tsx` repeats the check and redirects to
  `/sign-in?callbackUrl=/account`.
- No empty/error/loading state — nothing is fetched beyond the session.
- Role variants: badge text only. Buyer, creator and admin see identical cards.
- The three nav cards carry `state.scaffold` ("هذه الصفحة من نطاق جلسة أخرى…"),
  i.e. the hub was never finished. One of them names `/account/orders`, which is
  not a route in this app (see Invariants).

## Invariants
- Never render for an unauthenticated request — the middleware matcher is the
  gate, the route-group layout is the lock, and both must stay in place.
- `ACCOUNT_NAV` currently lists `/account/orders`, for which no page file exists;
  the real route is `/account/purchases`. The hub renders it as inert text so it
  does not 404 here, but the header user menu links it and does 404. Anything
  that turns these cards into links must fix `nav.ts` first.
- No money, no downloads.

## Verified by
`verify:arabic` (route listed), `audit` (route listed), `verify:auth`
(`/account` in the role-guard matrix).
