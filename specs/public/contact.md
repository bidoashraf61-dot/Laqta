# Contact

**Route** `/contact` · **Access** public · **Rendering** server component, effectively static (no DB access)

## Purpose
State the four support channels — orders, creators, rights takedowns, and enterprise/government — as a document.

## Data in
- None. Renders the `CONTACT` array of `DocumentSection` from `content/legal.ts`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| "تواصل معنا" (document footer) | Link | `/contact` — links back to this same page |

**There is no contact form, no email address, no phone number and no ticket flow on this page.** It describes how to get in touch without providing an actual channel; the copy says "راسلنا" but no destination is wired. The only interactive element is a self-referential link.

## States
- No empty, error or loading state — content is a compile-time constant.
- No submission, so no pending or success state exists.

## Invariants
- Rights-takedown intake is described here and must stay consistent with `/content-policy`.
- Content is Arabic only.

## Verified by
`verify:arabic`, `audit`.
