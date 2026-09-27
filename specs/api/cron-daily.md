# Daily jobs endpoint

**Route** `POST /api/cron/daily` · **Access** `Authorization: Bearer <CRON_SECRET>` only · **Rendering** route handler, dynamic

## Purpose
Run the once-a-day jobs (`lib/jobs.ts#runDailyJobs`) for a hosted scheduler that can call a URL
but not run a command: bank-transfer reminders (DEV-30), the operator's digest (DEV-57), then one
outbox drain. The same work runs from a shell with `npm run jobs:daily` (cron `0 7 * * *`).

## Data in
- `CRON_SECRET` (env). Compared in constant time.
- `sendTransferReminders()` — `Order` `pending` + `bank_transfer`, older than 3 days, not already reminded.
- `sendOperatorDigest()` — `digestFigures()`: open review tasks (and overdue by `slaDueAt`), pending bank transfers (count + oldest order number), `Payout.status='requested'`, open `ContactMessage`, `FootageRequest` open from the last 24 h, `MailOutbox` failed and unsent.

## Controls
None — machine endpoint.

## States
- No `CRON_SECRET` → `503 { error: 'unconfigured' }` (shut, never open).
- Wrong or missing bearer → `401 { error: 'unauthorised' }`.
- OK → `200 { reminders, digest, sent }`.

## Invariants
- Idempotent: reminders are keyed on the order number, the digest on the date — a second call the same day sends nothing twice.
- No request body is read.

## Verified by
`verify:mail` runs the jobs against the database (once-only reminder, none for a fresh order, one digest per date). The HTTP route itself is not exercised by a gate.
