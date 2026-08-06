# Buyer authenticated area — `/account/*`

Everything a signed-in buyer gets after purchase: what they own, what they paid,
what they pulled, their boards, and their two-factor setting.

Access is gated twice. `middleware.ts` maps `/account` and `/account/*` to
`'authenticated'` and redirects an anonymous request to
`/sign-in?callbackUrl=<path>`. `app/(account)/layout.tsx` repeats the check and
redirects again — middleware is the gate, the layout is the lock. No role
distinction inside the area: buyer, creator and admin all see the same pages.

All seven routes are dynamic server components (they read the session).
`requireUser()` supplies the user id; every query is filtered by it.

The area is read-mostly. The only mutations reachable from it are the two-factor
server actions in `account/security/actions.ts` and the `Download` rows written
by `/api/download` when a library link is redeemed.

Two invariants govern this area and are restated in the specs that touch them:

- **Entitlement is frozen.** The library is served from
  `OrderItem.clipManifestSnapshot`, never from the live album (`lib/orders.ts`).
- **Masters are never a plain URL.** Every download is a short-lived HMAC token
  bound to key + entitlement + expiry, and the entitlement is re-checked at
  redemption (`lib/storage.ts`, `app/api/download/route.ts`).

| Route | Purpose | Spec |
| --- | --- | --- |
| `/account` | Account hub: role badge and cards naming the other surfaces (cards are inert; only the security link works). | [account.md](./account.md) |
| `/account/library` | Everything the user owns, one card per entitlement, from the frozen manifest. | [account-library.md](./account-library.md) |
| `/account/library/[id]` | Download surface for one purchased album: ZIP plus per-clip master and proxy links. | [account-library-id.md](./account-library-id.md) |
| `/account/purchases` | Order history table — number, date, total, invoice, status. Read-only. | [account-purchases.md](./account-purchases.md) |
| `/account/downloads` | Redemption log, latest 200. Read-only. | [account-downloads.md](./account-downloads.md) |
| `/account/boards` | Lists the user's clip boards and their share state. No create/edit controls exist. | [account-boards.md](./account-boards.md) |
| `/account/security` | TOTP enrolment and removal; mandatory and non-removable for creator and admin. | [account-security.md](./account-security.md) |

## Known gaps

- `ACCOUNT_NAV` (`components/layout/nav.ts`) links `/account/orders`, which has
  no page file. The header user menu renders it and it 404s; the real route is
  `/account/purchases`. `/account/downloads` and `/account/security` are missing
  from that nav entirely.
- The footage detail page links «أضف إلى لوح» to `/account/boards?add=<clipId>`;
  the boards page ignores `searchParams`, so nothing is added.
- `/account/library/[id]` is in neither the `audit` nor the `verify:arabic`
  route list, so the one page that hands over files is never opened by a browser
  gate.
