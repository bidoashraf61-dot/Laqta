# Contact messages

**Route** `/admin/messages` · **Access** admin only (`requireAdmin`) · **Rendering** server component, dynamic

## Purpose
Everything sent from the public `/contact` form, in the visitor's own words, with the one verb it needs: mark handled. With no mail provider configured this page is the only place a message surfaces, so it must be readable daily.

A separate route rather than a tab on `/admin/requests`: footage requests are deliberately read-only (fulfilled by shipping an album), while a message is answered and closed. Mixing them would either give requests a status control or take this one away from messages.

## Data in
- `ContactMessage.findMany`, take 200.
  - Default (no `?status`): `status='open'`, **oldest first** — the one that has waited longest is the one most likely to cost a customer.
  - `?status=handled` / `?status=any`: newest first.
- `ContactMessage.groupBy(status)` for the handled count on its chip.
- Topic label from `contact.topic.<key>`; status badge from `components/dashboard/status.tsx` (`contact` domain: open → warning, handled → neutral).

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Filter chips «بانتظار الرد» / «تمت معالجتها» / «الكل» | `FilterChips` (plain `<a>`) | `?status=` — `''` (open), `handled`, `any` (all). Not `all`: `FilterChips` keys its blank chip as `all`, so a second `all` collides |
| «رد بالبريد» | Plain `<a href="mailto:…">` | Opens the operator's mail client to the visitor's address |
| «تمت المعالجة» (open rows) | `ActionButton` → `setContactMessageStatus(id, 'handled')` | Sets `status`, `handledAt`, `handledById`; writes `AuditLog` `contact.handled`; toast; refresh |
| «أعد فتحها» (handled rows) | `ActionButton` (ghost) → `setContactMessageStatus(id, 'open')` | Clears `handledAt`/`handledById`; `AuditLog` `contact.open` |

Each row shows: name, status badge, email (`.ltr-island`), topic (or «بلا موضوع»), received date-time, the visitor's language (AR/EN), whether the operator email was sent («أُرسل التنبيه بالبريد» / «لم يُرسل تنبيه بالبريد»), and the full message (`whitespace-pre-line`, never truncated). Handled rows add «عولجت في <date>».

## States
- **Empty** — `EmptyState` with `dash.messagesEmpty` and the page hint.

## Invariants
- The message is never edited or deleted from this area — it is the visitor's words and the record of what was asked.
- Every status change is audited.
- Admin copy lives in the Arabic-only `dash.messages*` keys (see `specs/localisation.md` → Deliberate gaps).

## Verified by
- `verify:arabic` and `audit` — `/admin/messages` added to both route lists.
- Manual: messages submitted from `/contact` and `/en/contact` appear here with their locale and `mailDelivered=false` (no provider).
