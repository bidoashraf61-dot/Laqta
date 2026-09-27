# Operator control panel — `/admin/*`

The admin area is the platform's back office: the review queue that gates what goes
live, the creator roster, disputes, the catalogue, the storefront, orders and money.

**Access.** Every route is admin-only and guarded twice — `middleware.ts` matches
`/admin*` and rewrites non-admins to `/forbidden` (URL preserved), and
`app/(admin)/layout.tsx` repeats the check before rendering. Each page additionally calls
`requireAdmin()`, and every server action in `app/(admin)/admin/actions.ts` calls it again
before touching the database. Middleware is the gate, the layout is the lock, the action
is the last word.

**Two-factor is mandatory** (`lib/two-factor.ts`). An admin who has not enrolled in TOTP
signs in normally but every `/admin/*` request is sent to `/account/security?next=<path>`
(`/en/account/security?next=/en/…` under English) with a notice saying why; after enrolling
they are taken back to `next`. The same three layers hold it: middleware on the cookie's
`tfa` claim (only an explicit `false` — a cookie minted before the claim is left to the
layout), `app/(admin)/layout.tsx` on the database value, and `requireRole()` (so
`requireAdmin()`) throwing `TWO_FACTOR_REQUIRED` for any forged action. The seeded
`admin@laqta.sa` is enrolled with a published dev secret — `npm run totp:code --
admin@laqta.sa` prints the current code.

**Shape.** All routes render inside `DashboardShell` with the `admin` nav
(`components/dashboard/nav.ts`). Lists filter through the URL (`FilterChips`, `SearchBox`,
`RangePicker` — plain anchors, deliberately, see the note in
`components/dashboard/toolbar.tsx`). Mutations go through `ActionButton` (one verb on a
row) or `SettingsForm` (a panel of fields). Every status label and badge colour comes from
`components/dashboard/status.tsx`.

**Auditing.** Every privileged action writes an `AuditLog` row via `recordAudit`. The tail
is surfaced on `/admin/settings` and `/admin/reports`.

**View as user.** `/admin/users/[id]` can open a support view of a buyer's account:
reason required, read-only (refused in `middleware.ts` and again in `lib/db.ts`, not just
by hidden buttons), 30-minute expiry, audited at start and end/expiry, with a banner on
every page while it runs. During a view the session's role is the buyer's, so the whole
admin area is out of reach until it ends. Admins, creators and 2FA-enrolled accounts
cannot be viewed. See [admin-users-id.md](admin-users-id.md).

**Frozen invariants.** Two rules the whole area is built around and none of it can break:
entitlement is served from `OrderItem.clipManifestSnapshot`, and commission is frozen on
the `OrderItem` at purchase. Neither is configurable anywhere in this area.

## Routes

| Route | Purpose | Spec |
| --- | --- | --- |
| `/admin` | Work-queue depths, overdue reviews, 30-day platform totals. | [admin.md](admin.md) |
| `/admin/analytics` | Platform trends, funnel, category split and top albums over 7/30/90 days. | [admin-analytics.md](admin-analytics.md) |
| `/admin/review` | Albums awaiting a decision, ordered by SLA. | [admin-review.md](admin-review.md) |
| `/admin/review/[id]` | Review one album: duplicate + consistency reports, releases, clips, the 9-check gated checklist (in Arabic; AI accuracy blocking, DEV-17). | [admin-review-id.md](admin-review-id.md) |
| `/admin/users` | Find any account by email, name or phone; role, status, joined, order count. | [admin-users.md](admin-users.md) |
| `/admin/users/[id]` | One account: profile, suspend/reactivate, orders, library, preview downloads, contact messages, sample claim, creator link, and read-only audited view-as-user. | [admin-users-id.md](admin-users-id.md) |
| `/admin/creators` | Creator roster: approve, suspend, reinstate, set tier / commission override. | [admin-creators.md](admin-creators.md) |
| `/admin/disputes` | DMCA and content complaints: disable content, then close with a written resolution. | [admin-disputes.md](admin-disputes.md) |
| `/admin/requests` | Footage requests from buyers, in their own words. Read-only by design. | [admin-requests.md](admin-requests.md) |
| `/admin/messages` | Messages from the public `/contact` form: read in full, reply by mail, mark handled / reopen. | [admin-messages.md](admin-messages.md) |
| `/admin/catalogue` | Live catalogue: pause, resume, feature, delist, set an album's trailer; edit, add and delete price bands. | [admin-catalogue.md](admin-catalogue.md) |
| `/admin/taxonomy` | Categories, locations, tags, themes and the search synonym layer. | [admin-taxonomy.md](admin-taxonomy.md) |
| `/admin/merchandising` | Homepage slot copy, media and scheduling; collection publish/feature toggles; link to the free sample. | [admin-merchandising.md](admin-merchandising.md) |
| `/admin/merchandising/sample` | Curate, title and publish the free sample album. | [admin-merchandising-sample.md](admin-merchandising-sample.md) |
| `/admin/orders` | Find orders, settle a bank transfer, see Paymob reference / source and gateway flags, refund a line at its frozen rate. | [admin-orders.md](admin-orders.md) |
| `/admin/payouts` | Approve payout requests (freezing the destination), batch approved ones into a payout run with one export file per rail, and mark a run (or a single payout) paid. | [admin-payouts.md](admin-payouts.md) |
| `/admin/promos` | Create, edit and switch promo codes on or off. | [admin-promos.md](admin-promos.md) |
| `/admin/bundles` | Album bundles: what each costs apart and together, whether a buyer can get it now; switch on/off. | [admin-bundles.md](admin-bundles.md) |
| `/admin/bundles/new`, `/admin/bundles/[id]` | Build or edit a bundle with a live per-album split of who pays the discount (Laqta). | [admin-bundles-edit.md](admin-bundles-edit.md) |
| `/admin/content` | Hub for the owner's words: every visitor-facing copy group and the long-form pages; what each shows now, open its editor. | [admin-content.md](admin-content.md) |
| `/admin/content/copy/[group]` | Edit any visitor-facing copy (8 groups: landing, sell, email, site, catalogue, checkout, account, contact) in Arabic and English with live rule checks, preview on the real page, publish, undo a publish. | [admin-copy-group.md](admin-copy-group.md) |
| `/admin/content/copy/email/preview` | One email rendered with sample data, with or without unpublished edits. | [admin-copy-email-preview.md](admin-copy-email-preview.md) |
| `/admin/content/[key]` | Edit one page in Arabic and English with a live preview, publish with a note, restore any earlier version or the original text. | [admin-content-key.md](admin-content-key.md) |
| `/admin/reports` | Zero-result search report plus the last 50 audit entries. Read-only. | [admin-reports.md](admin-reports.md) |
| `/admin/settings` | Operating constants, licence version, storage status. Read-only by design. | [admin-settings.md](admin-settings.md) |

## Coverage

- `verify:arabic` and `audit` cover 22 routes (plus `/admin/bundles` and `/admin/bundles/new`) (now including `/admin/messages`,
  `/admin/users`, `/admin/content`, `/admin/content/terms`,
  `/admin/content/copy/landing`, `/admin/content/copy/catalogue` and
  `/admin/content/copy/email/preview`). `/admin/users/[id]` is in neither (it needs an id).
  `/admin/requests` is in neither. **`/admin/review/[id]` is in
  neither** — the surface where the review gate actually lives is unexercised by any gate.
- `verify:flows` drives filter chips on `/admin/catalogue`, `/admin/creators`,
  `/admin/review`, `/admin/disputes`, `/admin/payouts`, `/admin/taxonomy`.
- `verify:money` covers the refund path (`lib/admin.refundOrderItem`).
- `verify:payouts` covers `lib/payouts` behind `/admin/payouts`: run eligibility, the three
  per-rail CSV formats and their totals, mark-run-paid posting the same ledger row as the
  single mark-paid, sequential and concurrent double submit, and exclusion back to the queue
  (library level — the rendered run panel and the download route are not driven by a gate).
- `verify:payments` covers the Paymob callback into `settleOrder` and the derived
  webhook/manual source shown on `/admin/orders` (handler level, not the rendered row).
- `verify:entitlement` covers the order snapshot.
- `verify:bundles` covers `lib/bundles.ts` behind `/admin/bundles`: the arithmetic, the
  Laqta-share ceiling, every save rule, checkout (applies only when complete and running,
  biggest saving wins, creators paid in full, promo codes do not stack), settlement and an
  exact full refund.
- `verify:documents` covers `lib/editable-documents.ts` behind `/admin/content/[key]`: the publish
  rules, publish, restore (to a version and to the original text), audit rows and the
  fall-back to `content/legal.ts` (library level — the client editor is not driven).
- `verify:copy` covers `lib/copy-rules.ts` + `lib/copy-overrides.ts` behind
  `/admin/content/copy/[group]`: every original passes, each edit rule refuses, publish /
  reset / undo / preview against the database, and `translate()` precedence (library level —
  the client editor and the preview banner are not driven).
- `verify:auth` asserts the role matrix on `/admin` for buyer, creator and admin (the
  seeded creator and admin sign in with their TOTP code), and the mandatory-2FA hold: an
  unenrolled admin is sent from `/admin`, `/admin/orders?…`, `/studio`, `/en/admin` and
  `/en/studio/…` to the enrolment page with the right `next`; `/account/*` and sign-out stay
  open; a cookie from before enrolling is held until refreshed; and the layout lock sends
  `/admin` to enrol when 2FA is removed mid-session.
- `verify:impersonation` also checks that ending (or expiring) a view hands the admin back
  **still enrolled** — the viewed buyer's `tfa: false` never leaks out — and `/admin`
  opens rather than the 2FA page.
- `verify:impersonation` drives a whole view-as-user session in real Chrome: who may be
  viewed, non-admins never see the control, blank reason refused, start/end/expiry rows
  and audit entries, the banner, and 403s for a server-action POST, an `/en` POST, a
  writing GET and a download while the view is active.
- `verify:flows` searches `/admin/users` and opens the detail page, and round-trips a
  price band edit on `/admin/catalogue` (refused when invalid, persisted, audited, no album
  or order moved, restored).

## Dead ends worth knowing

- A bundle whose discount comes to exceed Laqta's share on an album (after a price change or
  a creator promoted to a lower commission) silently stops applying at checkout; the only
  signal is its «غير متاحة» badge on `/admin/bundles`. Nothing notifies the owner.
- A buyer who already owns an album of a bundle cannot get the bundle price — it needs every
  album in one order. The bundle page says so.


- `saveSlot` can create a slot, but no control on `/admin/merchandising` submits the `key`
  it needs — only editing existing slots is reachable.
- Album prices are set per album at approval on `/admin/review/[id]` ($49–$249, DEV-09);
  price bands only suggest. Spec B (the creator accepts the price before the album goes
  live) is still not built — the creator is told the price by the approval email only.
- Making a buyer a creator (`/admin/users/[id]`) takes effect at their next sign-in: an
  open session is still a buyer at the `/studio` gate (the success message says so).
- **2FA has no recovery path.** No backup codes, and no admin control resets another
  account's 2FA: an admin or creator who loses their authenticator needs a database edit
  (`twoFactorEnabled = false, twoFactorSecret = null`), after which they are held on
  `/account/security` to enrol again.
- An admin held for 2FA still sees «لوحة التحكم» / «الاستوديو» in the header; each click
  lands back on `/account/security` with the notice.
- When the layout lock fires (2FA removed from a live session), the page below it has
  already started rendering in parallel and its `requireAdmin()` throws
  `TWO_FACTOR_REQUIRED` into the server log. The visitor only sees the redirect; the log
  line is noise, not a leak.
- The view-as-user write guard in `lib/db.ts` is not exercised by any gate on its own —
  every writing path a gate can reach is already refused by middleware first.
- The trailer field on `/admin/catalogue` takes a media-bucket **key**; there is no upload
  control. Files reach the bucket through `npm run media:upload` (`docs/tech/media-aws.md`).
  `saveAlbumTrailer` is exercised by no gate — `verify:flows` does not open the popover.
- Editable from admin: the six long-form pages (DEV-64a) and every visitor-facing string
  (DEV-64b/c). **Not editable, by the owner's decision (2026-09-27):** the admin and
  studio labels (`dash.*`, `studio.*`, `admin.*`, `payoutRun.*`, `security.*`) and
  `brand.name` — they need a code change. `actions.*` / `state.*` are shared, so an edit
  there also changes the dashboards' buttons and messages.
- A published copy edit reaches a second server instance within 15 s (per-process map,
  `lib/copy-overrides.ts`); only the publishing process updates at once.
- The shell's `<main>` is `overflow-x-clip` (was `overflow-y-auto`, which silently
  disabled every `position: sticky` in the dashboards); wide content is clipped rather
  than scrollable inside `<main>` — give a wide table its own scroll wrapper.
- A refund or void done in the Paymob dashboard is only *flagged* on `/admin/orders`
  (`reversed_at_gateway`); nothing reverses the Laqta ledger automatically.
