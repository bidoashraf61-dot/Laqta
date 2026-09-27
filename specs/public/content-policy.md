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
- «العلامة المائية والمعاينة» states that a signed-in visitor may download a watermarked 720p preview (clip or album) to test in their edit, and that it is not licensed for published work (added 2026-09-24 — pending the owner's counsel).
- The rules stated here must match what the review gate actually enforces: `lib/review-checklist.ts` makes `releases` a blocking item — an album cannot be approved while the model release for every identifiable face and the property release for private or branded premises are unresolved. The document is explicit that the technical block does not transfer responsibility away from the creator.
- Effective date must always render.

## Verified by
`verify:arabic`, `audit`.

## Accepted resolutions (2026-09-27)
The «ما الذي نقبله» section reads «لقطات سعودية بدقة 720p أو 1080p أو 4K، تُذكر دقة كل ألبوم عليه وتنعكس على سعره، ضمن ألبومات متناسقة من ٣٠ إلى ٧٠ لقطة حول موضوع واحد.» (EN to match). Was «1080p أو 4K … لا تقل عن ثماني لقطات» — 720p is now accepted at a lower price (owner) and the eight-clip minimum predated the 30–70 album.
