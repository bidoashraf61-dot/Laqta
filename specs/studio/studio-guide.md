# Delivery guide

**Route** `/studio/guide` (`/en/studio/guide`) · **Access** creator (admin with a creator profile); 2FA-enrolled, like every studio route · **Rendering** server component, dynamic

## Purpose
The creator brief (ALB-20, `docs/creators/creator-brief-ar.md`) inside the studio
(DEV-13): everything an album needs to pass review the first time, where the creator
is when they ask "what exactly do you need from me?".

## Data in
- `requireCreator()`; no `creatorId` → `/sell`.
- Copy: `content/creator-guide.ts#creatorGuide(locale, vars)` — Arabic source, English
  for `/en`. Latin runs are written between backticks and rendered isolated
  (`.ltr-island`, monospace chip).
- **Every enforced number is read from the code that enforces it**, never written in
  the copy: `MIN_ALBUM_CLIPS` / `MAX_ALBUM_CLIPS` and `MIN_PAYOUT_USD` and
  `REVIEW_SLA_BUSINESS_DAYS` (`lib/studio.ts`), `maxClipBytes()` (`lib/uploads.ts`,
  `UPLOAD_MAX_CLIP_BYTES`), `PAYOUT_HOLD_DAYS`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «نموذج سجل الجودة» (header) | `<a download>` → `/creators/qa-log-template.csv` | The quality-log template (a copy of `docs/creators/qa-log-template.csv` in `public/creators/`) |
| Contents rail (≥ `lg`) | In-page anchors | Jump to a section; `sticky`. Hidden below `lg` — the page reads top to bottom on a phone |

## Sections (in order)
«قبل أن تبدأ» — the pre-start checklist (8 items) · «ما هو الألبوم» · «المواصفات
التقنية» (resolution, frame rate, colour, length, audio, file type, codec, file size,
quality) · «الدقة السعودية» · «فحوص إضافية للقطات المولّدة» · «متطلبات إضافية للقطات
المصوّرة» · «ما لا نقبله» · «تسمية الملفات» (an `ltr` code block) · «سجل الجودة» (the
CSV columns) · «كيف تسير الأمور» (six numbered steps: subject → upload → details and
price calculator → review within the SLA → price agreed → share, hold, payout minimum).

**Example album:** not a section yet — the brief's "example album" needs a real
published album to point at (ALB work). Add a link when one is live.

## Entry points
- Studio sidebar, «المحتوى» group: «دليل التسليم» (`BookOpen`).
- `/studio/albums/[id]`, right above the uploader, while the album is editable:
  «قبل الرفع: راجع دليل التسليم» (plain `<a>`).

## States
Static content; no empty, loading or error state of its own.

## Invariants
- Mirrors the **draft** brief — the owner has not approved ALB-20. When the brief
  changes, `content/creator-guide.ts` changes in the same commit.
- Numbers the code enforces are never hard-coded in the copy (see Data in).
- No pricing multipliers are quoted: the owner edits them in admin (DEV-09c), so the
  guide points at the price calculator instead.
- Reading surface in the dashboard shell: one column at `68ch`, no cards as structure.
  The grid track is `minmax(0,1fr)` so the file-naming block scrolls inside itself
  instead of widening the page on a phone.

## Verified by
`audit` and `verify:arabic` (route added to both lists). Looked at in Chrome as a
seeded creator at 1440 and 390 wide.
