# User

**Route** `/admin/users/[id]` · **Access** admin only · **Rendering** server, dynamic (`params` + `auth()`)

## Purpose
One account and everything support asks about it, on one screen: profile, orders,
library, preview downloads, contact messages, the free-sample claim, the creator link —
plus the three things an operator does to an account itself: suspend/reactivate,
**make this user a creator** (DEV-05), and **view the site as this user** (read-only,
audited, expiring support impersonation).

## Data in
- `closeExpiredImpersonations()` runs first (writes): any `Impersonation` row still open
  past `expiresAt` is closed `endReason='expired'`, `endedAt=expiresAt`, and audited
  `user.impersonate.expired`, so the history never shows a stale view as running.
- `lib/admin-users.ts#loadUserDetail(id)`:
  - `User` — email (+ `emailVerified`), phone (+ `phoneVerified`), name, country, locale,
    role, status, billingEntityType, legalName, twoFactorEnabled, createdAt, `creator`
    (id, handle, displayNameAr, status, isHouse).
  - `Order` — the user's last 25, newest first: orderNumber, status, total, currency,
    `_count.items`.
  - `Entitlement` — up to 100, newest first, with album title, `clipIdsSnapshot.length`,
    `revokedAt` / `revokeReason`, and the order number it came from.
  - `CompDownload` — last 20 watermarked preview downloads (clip or whole-album ZIP).
  - `ContactMessage` — last 20 whose `email` equals the user's email
    (case-insensitive). Empty when the account has no email.
  - `Impersonation` — last 10 views of this user, with the admin's email/name.
- The sample claim is the entitlement whose album belongs to the house creator.
- 404 when the id is unknown or is the house account.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «المستخدمون» back link | link | → `/admin/users` |
| «إيقاف الحساب» (header; status ≠ suspended; hidden for admins) | `setUserStatus(id,'suspended')`, native confirm «إيقاف هذا الحساب؟ …» | `User.status='suspended'`; audits `user.suspended` (detail from/to). Their open sessions end at their next page load (DEV-48). Refuses admins and self with «حساب المدير لا يُوقف من هنا.» |
| «إعادة تفعيل الحساب» (status = suspended) | `setUserStatus(id,'active')` | `User.status='active'`; audits `user.reactivated` |
| «افتح في الطلبات» (each order) | plain `<a>` | → `/admin/orders?q={orderNumber}` — refunds (and so ownership withdrawal) live there |
| «رسائل التواصل» link (when there are messages) | plain `<a>` | → `/admin/messages` |
| «افتح في صنّاع المحتوى» (creator accounts) | plain `<a>` | → `/admin/creators?q={handle}` |
| «اجعله صانع محتوى» panel (accounts with no creator profile; admins included) → «المعرّف» (required, 3–30, `[a-z0-9-]`, `dir=ltr`), «الاسم المعروض بالعربي» / «بالإنجليزي» (required, ≤80), «الدولة» (native select over `COUNTRIES`, default EG), «صانع مؤسس: حصته ٧٠٪» (checkbox, **checked by default**), «أنشئ حساب الصانع» | `makeCreator` (`SettingsForm`) | Creates `Creator` `status='approved'`, `appliedAt`/`approvedAt=now`, tier **silver** when founding (30% commission = 70% to the creator, decision D8; `notes` records it) else **standard** (65%). Sets `User.role='creator'`; an admin keeps `admin`. Audits `creator.create` (detail userId, handle, tier, founding). Refuses: existing profile «هذا الحساب صانع محتوى أصلاً.», suspended account, bad handle, taken handle, missing names. Success «صار صانع محتوى. إذا كان داخلاً الآن، يسجّل خروجه ثم دخوله ليفتح الاستوديو.»; the page revalidates and the creator panel replaces the form |
| «عرض الموقع كهذا المستخدم» panel → «سبب العرض» (required textarea, ≤500), «مرجع الرسالة أو التذكرة (اختياري)» (≤120), «ابدأ العرض» | `startViewAsUser` (`SettingsForm`) | See **View as user** below. On success redirects to `/account` as the customer; on refusal shows the reason inline |

## View as user
- **Who.** `lib/impersonation.ts#viewRefusal`: buyers only. Refused, with the reason
  shown in place of the form: admins («حسابات المديرين لا تُعرض.»), creators and any
  2FA-enrolled account («حسابات صنّاع المحتوى لا تُعرض: فيها بيانات الدفع ومحمية
  بالتحقق بخطوتين.»), yourself. Decided 2026-09-24: a creator's studio holds payout
  details and the account carries mandatory 2FA; their albums, sales and payouts are
  already readable on other admin routes.
- **Start.** `openImpersonation` writes `Impersonation` (reason, ticketRef, ip,
  `expiresAt = now + 30 min`) and audits `user.impersonate.start` (detail: impersonationId,
  reason, ticketRef, expiresAt). Then `unstable_update({ impersonation: { start: id } })`;
  the JWT callback re-verifies the row (this admin's, open, in date, admin still active,
  target still viewable) and swaps the token's identity to the customer, parking the
  admin's inside it (`token.imp`). If the swap is refused, the row is closed and an error
  shown.
- **Read-only**, three layers: (1) `middleware.ts` answers 403 (plain text, reader's
  language) to every non-GET request during a view — every server action — except
  `POST /api/impersonation/end`, and to the writing GETs `/api/download`, `/api/preview`,
  `/cart/add`, `/account/certificates`, `/account/verify-email`; (2) middleware stamps
  `x-laqta-impersonation` on the request (always overwritten, never passed through) and
  `lib/db.ts` refuses any Prisma write except to `Impersonation` / `AuditLog` while it is
  present (`ReadOnlyImpersonationError`); (3) the session role is the customer's, so
  `/admin` is forbidden until the view ends.
- **Banner.** `components/layout/impersonation-banner.tsx`, rendered by the root layout on
  every page while `session.user.impersonation` is set: fixed to the bottom edge, warning
  fill, «تتصفح الآن بحساب: {name}», «للقراءة فقط: لا شراء ولا تحميل ولا تعديل.
  تنتهي الجلسة {time}», and «إنهاء العرض» — a plain form POST to
  `/api/impersonation/end`. English copy under `/en`.
- **End.** The end route calls `unstable_update({ impersonation: { end: true } })`; the
  JWT callback closes the row (`endReason='ended'`), audits `user.impersonate.end`, and
  restores the admin, then 303s to this page. The admin's 2FA claim (`tfa`) is parked
  with them at start and restored at end or expiry, so the viewed buyer's `false` never
  sends the admin to `/account/security` (mandatory 2FA, `lib/two-factor.ts`).
- **Expiry.** 30 minutes. The edge JWT callback (`lib/auth.config.ts`) restores the admin
  on the first request after `expiresAt`, so middleware re-issues an admin cookie; the
  node callback closes the row `expired` when it sees the expired token, and this page's
  `closeExpiredImpersonations()` catches any it missed.
- **History panel** «جلسات العرض»: badge جارية (warning) / انتهت / انتهت مهلتها, start
  time, reason, admin email, ticket ref. Empty: «لم يُعرض هذا الحساب من قبل».

## States
- **Made a creator (DEV-30)** — «اجعله صانع محتوى» also queues «صرت صانع محتوى على لقطة» (`creator.added`) to the account: the 2FA step and the sign-out/in note.
- **Empty sections** — each panel has its own line: «لا طلبات على هذا الحساب», «لا
  ألبومات في مكتبته», «لم يحمّل معاينات», «لم تصلنا رسالة من هذا البريد», «لم
  يستلمها» (sample).
- **Revoked entitlement** — destructive «سُحبت» badge plus the stored revoke reason.
- **Sample entitlement** — neutral «العيّنة المجانية» badge in the library list.
- **Admin account** — no suspend control, no suspend hint, view-as refused.
- **Pending** — `ActionButton` / `SubmitButton` spinners; refusal renders inline above the
  view-as fields.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- No money or ownership mutation here. Ownership is withdrawn only by a refund on
  `/admin/orders` (`lib/admin.refundOrderItem`), which this page links to and never
  duplicates. The library list is read from `Entitlement`, which mirrors the frozen
  `OrderItem.clipManifestSnapshot`.
- Suspension refuses new sign-in on both rails (`lib/auth.ts` authorize); a session already
  open lives until its JWT expires — the page says so.
- Every view is audited at start and end/expiry, carries a reason, and cannot outlive
  30 minutes.
- **A promoted buyer must sign in again to open the studio.** Middleware reads the role
  from the session cookie (edge, no database), so an open session stays `buyer` at the
  `/studio` gate. An **admin** made a creator reaches the studio at once: the role already
  passes, and `creatorId` arrives through the `jwt` callback's per-request read.

## Verified by
`verify:impersonation` (who may be viewed, non-admin cannot reach the form, blank reason
opens nothing, start row + audit + banner + session identity, 403 on a server-action POST,
an `/en` POST, a writing GET and a download, `/admin` unreachable, customer unchanged, end
row + audit + admin restored, expiry via a re-signed cookie closes the row `expired` with
its audit). `verify:flows` opens the page from a `/admin/users` search, and runs make-creator twice on throwaway accounts: a buyer (profile approved, silver, role creator, audited, form replaced, studio content after a fresh sign-in) and an admin (keeps admin, open session reaches `/studio`, not `/sell`). Not in
`verify:arabic` / `audit` (the route needs an id). The data-layer guard (`lib/db.ts`) is
exercised only indirectly — no gate issues a writing GET that middleware does not already
refuse.
