# Library

**Route** `/account/library` · **Access** any authenticated user · **Rendering** server component, dynamic

## Purpose
Lists everything the signed-in user owns — one card per entitlement — served
entirely from the frozen purchase manifest.

## Data in
- `requireUser()` for the session user id.
- `getLibrary(user.id)` (`lib/orders.ts`) → `db.entitlement.findMany`
  - filter: `{ userId, revokedAt: null }`
  - order: `grantedAt` desc, no limit
  - includes `album` (`slug`, `titleAr`, `titleEn`, `creator.handle`,
    `creator.displayNameAr`) and `orderItem`
    (`clipManifestSnapshot`, `licenceTier`, `createdAt`, `order.orderNumber`,
    `order.status`).
- Clip count per card is `clipManifestSnapshot.length` — the frozen JSON, never
  `album.clips`.
- `paid` is derived as `orderItem.order.status === 'paid'`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «تحميل الألبوم كاملاً» | `<Link href="/account/library/{entitlement.id}">` | Opens the per-album download page. Rendered with `disabled={!entry.paid}` on the `Button`, which `asChild` forwards to the `<Link>` — see States. |
| «ألبوم» | `<Link href="/albums/{creator.handle}/{album.slug}">` | Public album page |
| Empty-state «الألبومات» | `<Link href="/albums">` | Album index |

No mutations on this surface. No server actions.

## States
- Empty: `EmptyState` with «لم تشترِ أي ألبوم بعد» / «كل ألبوم تشتريه يظهر هنا للأبد»
  and a gold CTA to `/albums`.
- Unpaid entitlement (order still `pending`): a warning badge
  «بانتظار تأكيد الدفع» next to the licence badge, and the download button is
  marked disabled. Note that `disabled` on an anchor is not enforced by the
  browser — the real gate is `/api/download`, which refuses any order not `paid`.
- Licence variant: `extended` renders a gold badge, `standard` a neutral one.
- Loading: no explicit `loading.tsx` in `app/(account)`; the page streams with
  the App Router default.
- Error: no `error.tsx` in the route group. `requireUser()` throws
  `UNAUTHENTICATED` if the session is missing, which surfaces as the framework
  error boundary — in practice middleware redirects first.
- Revoked entitlements (`revokedAt` set) simply do not appear.

## Invariants
- The free sample appears like any album (`getLibrary` marks it `isSample`); its album button goes to [`/sample`](../public/sample.md), not an album page.
- **Frozen entitlement.** The clip list and count come from
  `OrderItem.clipManifestSnapshot`. This page must never join through to
  `album.clips`; a creator editing or deleting clips after purchase must not
  change what a buyer sees here.
- Only the owner's rows: the `userId` filter is not optional.
- Ownership is unlimited in time and download count («ملكك للأبد · تحميل غير محدود»).

## Verified by
`verify:entitlement` (buy → mutate album → library clip count unchanged),
`verify:arabic`, `audit`.
