# Privacy policy

**Route** `/privacy` · **Access** public · **Rendering** server component, effectively static (no DB access)

## Purpose
State what personal data the platform collects, why, and what rights the user has over it.

## Data in
- None. Renders the `PRIVACY` sections and `EFFECTIVE_FROM` from `content/legal.ts`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| "تواصل معنا" (document footer) | Link | `/contact` |

Read-only. There is no data-export or account-deletion request control on this page.

## States
- No empty, error or loading state — content is a compile-time constant.
- Effective date is the shared `EFFECTIVE_FROM` constant.
- Flagged in-code as pending review by Saudi counsel; the PDPL references are unconfirmed.

## Invariants
- The stated collection and retention must match what the code actually stores — notably `SearchQueryLog` (query text plus `userId`), `AuditLog`, `Order.billingEntitySnapshot`, and the waiting-list `CmsEntry` written by `captureEmail`.
- Effective date must always render.
- «من يطّلع على بياناتك» says an error report (page, browser, error message — no email, IP or cookies) may go to an error-monitoring processor (Sentry, `docs/tech/sentry.md`). Added 2026-09-24 and **flagged in-code for counsel** (no vendor or transfer country named). It must stay true to `lib/observability.ts#scrubEvent`: if the scrubber ever sends more, this sentence changes with it.

## Verified by
`verify:arabic`, `audit`.
