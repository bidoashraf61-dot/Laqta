# About

**Route** `/about` · **Access** public · **Rendering** server component, dynamic (one `DocumentVersion` read per render)

## Purpose
Explain what Laqta is and how the marketplace works, as a read-mode document.

## Data in
- `loadDocument('about')` (`lib/editable-documents.ts`, DEV-64a): the newest version the owner published from [`/admin/content/about`](../admin/admin-content-key.md), else the `ABOUT` sections from `content/legal.ts`. Rendered through `components/layout/document-page.tsx` → `document-body.tsx`.
- No effective date is passed for this document (unlike the policy pages).

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| "تواصل معنا" (footer of the document) | Link | `/contact` |

Read-only.

## States
- No empty, error or loading state. A database error, or a stored version that no longer passes the publish rules, renders the `content/legal.ts` text — the page cannot fail to have content.
- Bilingual: `/en/about` renders the English side of each section, falling back to the Arabic per field.

## Invariants
- Rendered through `DocumentPage` (shared by about, terms, privacy, licences, content-policy): the summary under the title is `<Prose>` (Serif Text 1.2rem / 1.85), matching the site-wide head composition.
- Policy and marketing prose lives in `content/legal.ts` (the default) and published `DocumentVersion` rows, not in the message dictionary — these are reviewed and edited as whole documents, not as strings.
- Measure capped at `62ch` so it tracks Arabic glyph width rather than a Latin assumption.
- **«كيف تُصنع اللقطات» / "How the footage is made"** (DEV-25 part, 2026-09-28): the AI disclosure — some albums filmed, some AI-generated, labelled on every album and on the certificate, plus the extra accuracy check for generated albums. The founder, company and founding-date section is **not written yet** — it waits on the owner's details (BIZ-10).
- «نموذج العمل» says «ترخيص دائم» (decision D2 — never "own forever") and «فاتورة», not «فاتورة ضريبية» (DEV-28).

## Verified by
`verify:arabic`, `audit`, `verify:documents`, `verify:licence` (scans the published version).
