# Content policy

**Route** `/content-policy` · **Access** public · **Rendering** server component, effectively static (no DB access)

## Purpose
State what may be uploaded and sold — release and permit requirements, prohibited subjects, and how rights complaints are handled.

## Data in
- None. Renders the `CONTENT_POLICY` sections and `EFFECTIVE_FROM` from `content/legal.ts`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| "تواصل معنا" (document footer) | Link | `/contact` |

Read-only. Linked from `/sell`.

## States
- No empty, error or loading state — content is a compile-time constant.
- Effective date is the shared `EFFECTIVE_FROM` constant.
- Flagged in-code as pending review by Saudi counsel.

## Invariants
- The rules stated here must match what the review gate actually enforces: `lib/review-checklist.ts` makes `releases` a blocking item — an album cannot be approved while the model release for every identifiable face and the property release for private or branded premises are unresolved. The document is explicit that the technical block does not transfer responsibility away from the creator.
- Effective date must always render.

## Verified by
`verify:arabic`, `audit`.
