# End a view-as-user session

**Route** `POST /api/impersonation/end` · **Access** any session (does nothing without an active view) · **Rendering** Node route handler

## Purpose
The one write a view-as-user session may make: ending itself. Posted by the «إنهاء
العرض» / "End view" button in the impersonation banner as a plain HTML form, so it works
without JavaScript and cannot be swallowed by the client router.

## Data in
- `auth()` — `session.user.impersonation` (id, expiresAt, targetName) and
  `session.user.id` (the customer while the view is active).

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| `POST` with an active view | `unstable_update({ impersonation: { end: true } })` | The JWT callback (`lib/impersonation.ts#applyImpersonationEnd`) closes the `Impersonation` row (`endReason='ended'`, or `'expired'` if the clock already ran out), audits `user.impersonate.end`, and restores the admin's identity from `token.imp`. 303 → `/admin/users/{customerId}` |
| `POST` without a view | — | 303 → `/` |

## States
- No body, no JSON; always a 303.

## Invariants
- This is the only non-GET path `middleware.ts` lets through while a view is active
  (`IMPERSONATION_END_PATH` in `lib/impersonation-shared.ts`). Unlike `api/auth` and
  `api/payments`, it IS inside the middleware matcher, so the request carries the
  `x-laqta-impersonation` header; `lib/db.ts` still permits the two tables ending a view
  needs (`Impersonation`, `AuditLog`).
- Ending from a browser's own `update({ impersonation: { end: true } })` takes the same
  JWT-callback path and writes the same row and audit entry.

## Verified by
`verify:impersonation` (end closes the row as ended, writes the audit row, removes the
banner and restores the admin session).
