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

Read-only. The self-service controls it describes live on
[`/account/profile`](../account/account-profile.md) («بياناتك», DEV-52).

## States
- No empty, error or loading state. A database error, or a stored version that no longer passes the publish rules, renders the `content/legal.ts` text — copy never breaks the page.
- The effective date is the live version's publish date, or the shared `EFFECTIVE_FROM` for the original text.
- The code default is flagged in-code as pending review by Saudi counsel; the PDPL references are unconfirmed.

## Invariants
- The stated collection and retention must match what the code actually stores — notably `SearchQueryLog` (query text plus `userId`), `AuditLog`, `Order.billingEntitySnapshot`, and the waiting-list `CmsEntry` written by `captureEmail`.
- Effective date must always render.
- **«ملفات تعريف الارتباط والتحليلات» / "Cookies and analytics"** (DEV-46, section anchor
  `id: 'cookies'`, the consent banner links to `/privacy#cookies`): the necessary cookies
  (session, cart/language, the consent answer), Google Analytics only with consent,
  nothing loads before a choice or after a refusal, «إعدادات التتبّع» at the foot of every
  page withdraws and deletes its cookies. Must stay true to `lib/consent.ts` and
  `components/layout/analytics-consent.tsx`. Flagged in-code for counsel (transfer wording).
- **«حقوقك»** says both rights can be exercised from the account («تعديل بياناتك»): a
  one-file export and account deletion, what deletion clears and what it keeps. Must stay
  true to `lib/account-privacy.ts`.
- A section `id` (the anchor) survives a publish from the admin editor
  (`normaliseSections` keeps a slug-shaped `id`; the editor carries it through untouched).
- «من يطّلع على بياناتك» says an error report (page, browser, error message — no email, IP or cookies) may go to an error-monitoring processor (Sentry, `docs/tech/sentry.md`). Added 2026-09-24 and **flagged in-code for counsel** (no vendor or transfer country named). It must stay true to `lib/observability.ts#scrubEvent`: if the scrubber ever sends more, this sentence changes with it.

## Verified by
`verify:arabic`, `audit`, `verify:documents`, `verify:privacy` (what «حقوقك» promises about deletion) (load, publish, restore, fall-back), `verify:licence` (scans the published version).
