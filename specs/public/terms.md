# Terms of service

**Route** `/terms` · **Access** public · **Rendering** server component, dynamic (one `DocumentVersion` read per render)

## Purpose
The binding terms: what a buyer actually purchases, account rules, pricing and invoicing, licence exclusions, creator obligations, and liability limits.

## Data in
- `loadDocument('terms')` (`lib/editable-documents.ts`, DEV-64a): the newest `DocumentVersion` the owner published from [`/admin/content/terms`](../admin/admin-content-key.md), else the `TERMS` sections from `content/legal.ts`.
- The effective date is that version's `publishedAt`; with nothing published it is the shared `EFFECTIVE_FROM` (`2026-08-01`) from `content/legal.ts`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| "تواصل معنا" (document footer) | Link | `/contact` |

Read-only. No acceptance checkbox, no versioned consent record — agreeing to these terms is not captured anywhere in the schema on this route.

## States
- No empty, error or loading state. A database error, or a stored version that no longer passes the publish rules, renders the `content/legal.ts` text — copy never breaks the page.
- The effective date is per document: the date the live version was published, or the shared `EFFECTIVE_FROM` for the original text. Earlier versions are kept (append-only) and readable in admin, not on the public site. (`LicenceVersion` in the schema versions the *album licence*, which is a separate thing.)
- The code default is flagged in-code as drafted but **not yet reviewed by Saudi counsel**; the ZATCA/PDPL references in particular are unconfirmed.

## Invariants
- The prose describes how the product actually behaves — the frozen commission, entitlement served from the order snapshot, the 30-day payout hold, the review checklist. If code changes any of those, this document is wrong and must change with it.
- A policy without a stated effective date is not a policy: the date must always render.

## Verified by
`verify:arabic`, `audit`, `verify:documents` (load, publish, restore, fall-back), `verify:licence` (scans the published version).
