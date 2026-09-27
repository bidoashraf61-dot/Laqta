# Buyer authenticated area — `/account/*`

**Copy is editable from admin (DEV-64b/c).** Every string on these routes comes from
`messages/*.json` through `translate()`, and the owner can override any of it at
[`/admin/content/copy`](../admin/admin-copy-group.md) — published edits show everywhere
within 15 s, `?copyPreview=<id>` shows an admin unpublished drafts. A spec that quotes a
string quotes the **default**; the live page may show an edit. The rules an edit must meet
(placeholders, length, direction, banned claims) are in that spec.

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
| `/account/profile` | Edit name, email, mobile and country; verify either login channel. | [account-profile.md](./account-profile.md) |
| `/account/library` | Everything the user owns, one card per entitlement, from the frozen manifest. | [account-library.md](./account-library.md) |
| `/account/library/[id]` | Download surface for one purchased album: ZIP, per-clip master and proxy links, and the licence certificate. | [account-library-id.md](./account-library-id.md) |
| `/account/certificates/[orderItemId]` | The licence certificate PDF for one purchased album. Route handler. | [../api/certificates.md](../api/certificates.md) |
| `/account/purchases` | Order history table — number, date, total, invoice, status. Read-only. | [account-purchases.md](./account-purchases.md) |
| `/account/downloads` | Redemption log, latest 200. Read-only. | [account-downloads.md](./account-downloads.md) |
| `/account/boards` | The user's clip boards: list, create, and "add this clip" from a clip page (DEV-49). | [account-boards.md](./account-boards.md) |
| `/account/boards/[id]` | One board: its clips, share by link on/off, remove, rename, delete (DEV-49). | [account-boards-id.md](./account-boards-id.md) |
| `/account/security` | TOTP enrolment and removal; mandatory and non-removable for creator and admin — an unenrolled one is held here from `/admin` and `/studio` until they enrol. | [account-security.md](./account-security.md) |

## Known gaps

- ~~`ACCOUNT_NAV` links `/account/orders`, which 404s.~~ **Closed.** The entry
  now points at `/account/purchases` under the `nav.orders` label, and
  `/account/downloads` and `/account/security` were added to the nav.
- ~~The hub renders its cards as inert text.~~ **Closed.** Every card is a link,
  and the hub carries a profile summary with a link to `/account/profile`.
- ~~«أضف للوح» on a clip page lands on a boards page that ignores `?add=`.~~ **Closed
  (DEV-49).** Boards can be created, filled from a clip page, shared, emptied and deleted.
- `/account/library/[id]` is in neither the `audit` nor the `verify:arabic`
  route list, so the one page that hands over files is never opened by a browser
  gate.
