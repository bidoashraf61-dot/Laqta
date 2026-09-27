# Privacy policy

**Route** `/privacy` · **Access** public · **Rendering** server component, dynamic (one `DocumentVersion` read per render)

## Purpose
State what personal data the platform collects, why, and what rights the user has over it.

## Data in
- `loadDocument('privacy')` (`lib/editable-documents.ts`, DEV-64a): the newest `DocumentVersion` the owner published from [`/admin/content/privacy`](../admin/admin-content-key.md), else the `PRIVACY` sections from `content/legal.ts`.
- The effective date is that version's `publishedAt`; with nothing published it is the shared `EFFECTIVE_FROM` (`2026-08-01`) from `content/legal.ts`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| "تواصل معنا" (document footer) | Link | `/contact` |

Read-only. There is no data-export or account-deletion request control on this page.

## States
- No empty, error or loading state. A database error, or a stored version that no longer passes the publish rules, renders the `content/legal.ts` text — copy never breaks the page.
- The effective date is the live version's publish date, or the shared `EFFECTIVE_FROM` for the original text.
- The code default is flagged in-code as pending review by Saudi counsel; the PDPL references are unconfirmed.

## Invariants
- The stated collection and retention must match what the code actually stores — notably `SearchQueryLog` (query text plus `userId`), `AuditLog`, `Order.billingEntitySnapshot`, and the waiting-list `CmsEntry` written by `captureEmail`.
- Effective date must always render.
- «من يطّلع على بياناتك» says an error report (page, browser, error message — no email, IP or cookies) may go to an error-monitoring processor (Sentry, `docs/tech/sentry.md`). Added 2026-09-24 and **flagged in-code for counsel** (no vendor or transfer country named). It must stay true to `lib/observability.ts#scrubEvent`: if the scrubber ever sends more, this sentence changes with it.

## Verified by
`verify:arabic`, `audit`, `verify:documents` (load, publish, restore, fall-back), `verify:licence` (scans the published version).
