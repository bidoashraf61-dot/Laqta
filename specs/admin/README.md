# Operator control panel — `/admin/*`

The admin area is the platform's back office: the review queue that gates what goes
live, the creator roster, disputes, the catalogue, the storefront, orders and money.

**Access.** Every route is admin-only and guarded twice — `middleware.ts` matches
`/admin*` and rewrites non-admins to `/forbidden` (URL preserved), and
`app/(admin)/layout.tsx` repeats the check before rendering. Each page additionally calls
`requireAdmin()`, and every server action in `app/(admin)/admin/actions.ts` calls it again
before touching the database. Middleware is the gate, the layout is the lock, the action
is the last word.

**Shape.** All routes render inside `DashboardShell` with the `admin` nav
(`components/dashboard/nav.ts`). Lists filter through the URL (`FilterChips`, `SearchBox`,
`RangePicker` — plain anchors, deliberately, see the note in
`components/dashboard/toolbar.tsx`). Mutations go through `ActionButton` (one verb on a
row) or `SettingsForm` (a panel of fields). Every status label and badge colour comes from
`components/dashboard/status.tsx`.

**Auditing.** Every privileged action writes an `AuditLog` row via `recordAudit`. The tail
is surfaced on `/admin/settings` and `/admin/reports`.

**Frozen invariants.** Two rules the whole area is built around and none of it can break:
entitlement is served from `OrderItem.clipManifestSnapshot`, and commission is frozen on
the `OrderItem` at purchase. Neither is configurable anywhere in this area.

## Routes

| Route | Purpose | Spec |
| --- | --- | --- |
| `/admin` | Work-queue depths, overdue reviews, 30-day platform totals. | [admin.md](admin.md) |
| `/admin/analytics` | Platform trends, funnel, category split and top albums over 7/30/90 days. | [admin-analytics.md](admin-analytics.md) |
| `/admin/review` | Albums awaiting a decision, ordered by SLA. | [admin-review.md](admin-review.md) |
| `/admin/review/[id]` | Review one album: duplicate + consistency reports, releases, clips, the 8-check gated checklist. | [admin-review-id.md](admin-review-id.md) |
| `/admin/creators` | Creator roster: approve, suspend, reinstate, set tier / commission override. | [admin-creators.md](admin-creators.md) |
| `/admin/disputes` | DMCA and content complaints: disable content, then close with a written resolution. | [admin-disputes.md](admin-disputes.md) |
| `/admin/catalogue` | Live catalogue: pause, resume, feature, delist; read-only price bands. | [admin-catalogue.md](admin-catalogue.md) |
| `/admin/taxonomy` | Categories, locations, tags, themes and the search synonym layer. | [admin-taxonomy.md](admin-taxonomy.md) |
| `/admin/merchandising` | Homepage slot copy, media and scheduling; collection publish/feature toggles. | [admin-merchandising.md](admin-merchandising.md) |
| `/admin/orders` | Find orders, settle a bank transfer, refund a line at its frozen rate. | [admin-orders.md](admin-orders.md) |
| `/admin/payouts` | Approve payout requests (freezing the destination) and mark them paid. | [admin-payouts.md](admin-payouts.md) |
| `/admin/promos` | Create, edit and switch promo codes on or off. | [admin-promos.md](admin-promos.md) |
| `/admin/reports` | Zero-result search report plus the last 50 audit entries. Read-only. | [admin-reports.md](admin-reports.md) |
| `/admin/settings` | Operating constants, licence version, storage status. Read-only by design. | [admin-settings.md](admin-settings.md) |

## Coverage

- `verify:arabic` and `audit` cover all 13 top-level routes. **`/admin/review/[id]` is in
  neither** — the surface where the review gate actually lives is unexercised by any gate.
- `verify:flows` drives filter chips on `/admin/catalogue`, `/admin/creators`,
  `/admin/review`, `/admin/disputes`, `/admin/payouts`, `/admin/taxonomy`.
- `verify:money` covers the refund path (`lib/admin.refundOrderItem`).
- `verify:entitlement` covers the order snapshot.
- `verify:auth` asserts the role matrix on `/admin` for buyer, creator and admin.

## Dead ends worth knowing

- `beginImpersonation` / `endImpersonation` exist in `actions.ts` and the `Impersonation`
  model exists, but **no UI in the area calls them**.
- `PayoutRun` is never read or written by any admin route, despite `/admin/payouts` being
  titled "دفعات التحويل" (payout runs). There is no batching or export.
- `saveSlot` can create a slot, but no control on `/admin/merchandising` submits the `key`
  it needs — only editing existing slots is reachable.
- `PriceBand` has no editor anywhere.
