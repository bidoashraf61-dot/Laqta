# Waitlist

**Route** `/admin/waitlist` (+ `/admin/waitlist/export`) · **Access** admin (`requireAdmin`) · **Rendering** server component, dynamic

## Purpose
The launch waiting list (DEV-45): who asked to be told the day buying opens, in which language
and from which page; export it; send the launch notice once; push it to Resend.

## Data in
- `WaitlistEntry` (its own table since DEV-45; the old `CmsEntry` `landing_copy`/`waitlist:<email>` rows were moved across by the migration and deleted): latest 300 by `createdAt desc` — `email`, `locale`, `source`, `createdAt`, `unsubscribedAt`, `launchNotifiedAt`.
- Counts: on the list (`unsubscribedAt` null), unsubscribed, notified; the number still owed the notice.
- `resendAudienceConfigured()` — `RESEND_AUDIENCE_ID` + `MAIL_API_KEY`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «تنزيل CSV» (plain `<a>`) | `GET /admin/waitlist/export` | `email,language,source,signed_up,consent,unsubscribed,launch_notified` for every row (unsubscribed ones included, marked); `private, no-store`; `AuditLog waitlist.export` |
| «أرسل إشعار الإطلاق» (gold; `window.confirm` «نرسل إشعار الإطلاق لكل من في القائمة ولم يصله بعد (n)؟ ما يُرسل لأحد مرتين.») | `sendLaunchNoticeNow` → `notifyWaitlistOfLaunch()` | Queues `launch.notice` for every member not unsubscribed and not yet notified, each in their language with their unsubscribe link; sets `launchNotifiedAt`; `AuditLog waitlist.launch_notice`; toast «جهّزنا إشعار الإطلاق للإرسال: n.» |
| «مزامنة مع Resend» (ghost) | `syncWaitlistNow` → `syncWaitlistToResend()` | POSTs new / re-consented / unsubscribed rows to the Resend audience's contacts (`unsubscribed` flag, never a delete); sets `syncedAt`; toast «تمت المزامنة: x من y.». Without the env: «المزامنة مع Resend متوقفة…» |

## States
- **Empty** — «ما فيه أحد في القائمة بعد».
- Row status badge: «ينتظر الإطلاق» (warning) · «وصله الإشعار» (success) · «ألغى الاشتراك» (neutral).
- The line under the buttons says whether the Resend sync is on.

## Invariants
- An unsubscribe is a timestamp, never a delete; nothing but the person signing up again clears it.
- The launch notice is sent to an address at most once (`launch.notice` keyed on `toEmail`, and `launchNotifiedAt`).

## Verified by
`verify:mail` (join twice → one row with language + consent version; unsubscribe by token; launch notice once, never to the unsubscribed, in the member's language with their link; CSV). `verify:arabic` and `audit` open the page.
