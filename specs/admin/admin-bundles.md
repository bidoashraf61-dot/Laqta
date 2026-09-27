# Bundles

**Route** `/admin/bundles` · **Access** admin only · **Rendering** server, dynamic (`auth()`)

## Purpose
Every album bundle (DEV-62), what it costs apart and together today, and whether a buyer can
get it right now. Create, edit, switch on or off.

**Who pays the discount: Laqta, from its commission** (owner decision, 2026-09-27). Each
creator is paid exactly what their album earns sold alone. So on no album may the discount
exceed Laqta's commission on it — the *ceiling*, checked at save and again at checkout.

## Data in
- `Bundle.findMany({ orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }] })` with
  `BundleAlbum` rows (by `position`) and each album's price, status, exclusivity and creator
  tier / override.
- Per bundle, computed now: `bundleLines` → `priceBundle` → `overCeiling`
  (`lib/bundle-pricing.ts`).

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «حزمة جديدة» (header; also in the empty state) | plain `<a>` | [`/admin/bundles/new`](admin-bundles-edit.md) |
| Bundle title / «تعديل» | plain `<a>` | [`/admin/bundles/[id]`](admin-bundles-edit.md) |
| «عرض الصفحة» | plain `<a>`, new tab | [`/bundles/[slug]`](../public/bundles-slug.md) |
| «إيقاف» / «تشغيل» | `setBundleActiveAction(id, !isActive)` (`ActionButton`; «إيقاف» asks first) | flips `isActive`; audits `bundle.activate` / `bundle.deactivate`; revalidates the site. Past orders keep their price |

There is no delete — orders reference a bundle by `OrderItem.bundleId`.

## States
- **Empty** — `EmptyState` «لا حزم بعد» with the create button.
- **Row badge** (five-valued): «سارية» (on, in dates, buyable) success; «مجدولة» (starts
  later); «انتهت» (end passed); «متوقفة» (off); «غير متاحة» warning — on and in dates but a
  buyer would not get it: an album is no longer live/priced, or the discount now exceeds
  Laqta's share because a price or a creator's rate changed. Checkout skips such a bundle
  silently, so the owner has to see it here.
- Row line: «ألبومات: N» · «خصم N٪» or «سعر ثابت» · separate total struck, bundle price ·
  start — end.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- Nothing on this route changes an order, a commission or an entitlement.
- Every write goes through `lib/bundles.ts` (`saveBundle`, `setBundleActive`) and is audited.

## Verified by
`verify:bundles`; `verify:arabic`, `audit` (`/admin/bundles`).
