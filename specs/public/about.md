# About

**Route** `/about` · **Access** public · **Rendering** server component, effectively static (no DB access, no dynamic APIs)

## Purpose
Explain what Laqta is and how the marketplace works, as a read-mode document.

## Data in
- None. Renders the `ABOUT` array of `DocumentSection` from `content/legal.ts` through `components/layout/document-page.tsx`.
- No effective date is passed for this document (unlike the policy pages).

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| "تواصل معنا" (footer of the document) | Link | `/contact` |

Read-only.

## States
- No empty, error or loading state — the content is a compile-time constant, so the page cannot fail to have content.
- Content is Arabic only.

## Invariants
- Rendered through `DocumentPage` (shared by about, terms, privacy, licences, content-policy): the summary under the title is `<Prose>` (Serif Text 1.2rem / 1.85), matching the site-wide head composition.
- Policy and marketing prose lives in `content/legal.ts`, not in the message dictionary — these are reviewed as whole documents by counsel, not as strings.
- Measure capped at `62ch` so it tracks Arabic glyph width rather than a Latin assumption.

## Verified by
`verify:arabic`, `audit`.
