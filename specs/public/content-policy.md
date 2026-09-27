# Content policy

**Route** `/content-policy` · **Access** public · **Rendering** server component, dynamic (one `DocumentVersion` read per render)

## Purpose
State what may be uploaded and sold — release and permit requirements, prohibited subjects, and how rights complaints are handled.

## Data in
- `loadDocument('content-policy')` (`lib/editable-documents.ts`, DEV-64a): the newest `DocumentVersion` the owner published from [`/admin/content/content-policy`](../admin/admin-content-key.md), else the `CONTENT_POLICY` sections from `content/legal.ts`.
- The effective date is that version's `publishedAt`; with nothing published it is the shared `EFFECTIVE_FROM` (`2026-08-01`) from `content/legal.ts`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| "تواصل معنا" (document footer) | Link | `/contact` |

Read-only. Linked from `/sell`.

## States
- No empty, error or loading state. A database error, or a stored version that no longer passes the publish rules, renders the `content/legal.ts` text — copy never breaks the page.
- The effective date is the live version's publish date, or the shared `EFFECTIVE_FROM` for the original text.
- The code default is flagged in-code as pending review by Saudi counsel.

## Invariants
- «العلامة المائية والمعاينة» states that a signed-in visitor may download a watermarked 720p preview (clip or album) to test in their edit, and that it is not licensed for published work (added 2026-09-24 — pending the owner's counsel).
- The rules stated here must match what the review gate actually enforces: `lib/review-checklist.ts` makes `releases` a blocking item — an album cannot be approved while the model release for every identifiable face and the property release for private or branded premises are unresolved. The document is explicit that the technical block does not transfer responsibility away from the creator.
- Effective date must always render.

## Verified by
`verify:arabic`, `audit`, `verify:documents` (load, publish, restore, fall-back), `verify:licence` (scans the published version).

## Accepted resolutions (2026-09-27)
The «ما الذي نقبله» section reads «لقطات سعودية بدقة 720p أو 1080p أو 4K، تُذكر دقة كل ألبوم عليه وتنعكس على سعره، ضمن ألبومات متناسقة من ٣٠ إلى ٧٠ لقطة حول موضوع واحد.» (EN to match). Was «1080p أو 4K … لا تقل عن ثماني لقطات» — 720p is now accepted at a lower price (owner) and the eight-clip minimum predated the 30–70 album.
