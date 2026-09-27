# Edit a long-form page

**Route** `/admin/content/[key]` · **Access** admin only · **Rendering** server, dynamic (`auth()`); the editor is a client component (`components/admin/document-editor.tsx`)

## Purpose
Edit one long-form page (DEV-64a) in both languages, see it exactly as it will look, publish
it with a note, and put any earlier version — or the original text — back on the site.

`[key]` is one of `terms`, `privacy`, `licences`, `content-policy`, `about`, `contact`;
anything else is `notFound()`.

## How the pages are stored
- **Two layers.** The text in `content/legal.ts` is the default. Published versions are rows
  of `DocumentVersion` (`docKey`, `sections` JSON, `note`, `restoredFromId`, `publishedAt`,
  `publishedById`); the newest row per page is what the site shows
  (`lib/editable-documents.ts#loadDocument`).
- **Append-only.** Nothing is edited or deleted. A restore publishes a copy as a new row
  with `restoredFromId` set (a version id, or `code-default` for the original text).
- A dedicated model rather than `CmsEntry`: a page is a list of sections (heading,
  paragraphs, optional bullet list, each in Arabic and English), not a title and one body.
  Recorded against `docs/decisions/2026-08-20-content-control-design.md`.

## Data in
- `loadDocument(key)` — what the site shows now (version id + sections).
- `listVersions(key)` — every version, newest first, with the publisher's name; dates
  formatted server-side with `formatDateTime` in the reader's language.
- `DOCUMENTS[key]` — the original sections, the page title in both languages
  (`translate('ar'|'en', footer.*)`), whether the page is dated, whether it shows lists.

## Layout
- Header: «تحرير: {title}», back to «نصوص الموقع والصفحات» (admin nav: «نصوص الموقع»), the line «على الموقع الآن: …» (the
  original text, or the live version's date), and «عرض الصفحة» (new tab).
- **Desktop (lg+):** editor and preview side by side; the preview is sticky and scrolls
  on its own. **Below lg:** a two-way switch «تحرير / معاينة» shows one pane at a time.
- Version history panel under both.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Section card — «العنوان» | input | Arabic heading (required) |
| Section card — «الفقرات» | textarea | Arabic paragraphs, **blank line between paragraphs** |
| Section card — «قائمة نقاط (اختيارية)» | textarea, one item per line | Arabic bullet list. **Absent on `contact`** (its guide shows no lists) |
| Section card — «الإنجليزية» (folded `<details>`) | English heading / paragraphs / list | English side; empty fields fall back to the Arabic on `/en`. A warning badge «الترجمة ناقصة…» shows while any part is missing |
| ↑ / ↓ (section header) | reorder in the draft | disabled at the ends |
| Bin (section header) | native confirm, remove from the draft | nothing changes on the site until publish |
| «إضافة قسم» | append an empty section, focus its heading | — |
| «ما الذي تغيّر؟ (اختياري…)» | input, max 200 | stored as the version's `note` |
| «تجاهل التعديلات» | native confirm | the editor goes back to what the site shows; the stored draft is cleared |
| «نشر» | native confirm → `publishDocumentAction(key, sections, note)` | validates, writes a `DocumentVersion`, audits `document.publish`, revalidates the page (both languages) and `/admin/content`. Disabled until something changed |
| Preview «العربية / الإنجليزية» | toggle | renders the draft through the same `DocumentBody` the public page uses, in that language and direction |
| History row «فتح في المحرر» | loads that version into the editor (toast) | nothing published until «نشر» |
| History row «استرجاع» | native confirm → `restoreDocumentAction(key, id)` | publishes a copy of that version as a new version; audits `document.restore`. Hidden on the live row |
| «النص الأصلي» row «فتح في المحرر» / «استرجاع» | same, from `content/legal.ts` | `restoredFromId = 'code-default'` |

Both actions refuse during view-as-user (`state.forbidden`) and an unknown key
(`state.notFound`).

## Publish rules (`validateSections`, enforced in the action, not only the editor)
First failure wins and names its section number; the editor opens that section's English
fold, rings the card in red and scrolls to it. Refused when:
- the page has no sections, or more than 40;
- a section has no Arabic heading, or no Arabic paragraph **and** no Arabic list item;
- a heading is over 140 characters, a paragraph over 3,000, a list item over 600;
- any field contains HTML tags;
- an English field is mostly Arabic (more Arabic letters than Latin — the About page quotes
  «العلا» inside English on purpose, so any-Arabic is allowed);
- `contact` has a list, or any page has an English list with no Arabic list;
- any field matches a banned claim (`lib/copy-claims.ts`, shared with `verify:licence`):
  view caps, a "standard/extended" tier, price comparisons, "real locations", "permits
  cleared", "every use";
- the note is over 200 characters.
Empty paragraphs and items are dropped and every field is trimmed before the check
(`normaliseSections`), on the server.

## States
- **Nothing published** — «على الموقع الآن: النص الأصلي.»; history shows «لم تُنشر أي نسخة
  بعد…» and the original-text row carries the «على الموقع» badge.
- **Unpublished changes** — dot + «تعديلات غير منشورة»; the publish bar becomes sticky at
  the bottom of the editor. With no changes it sits at the end (a phone would otherwise
  give a quarter of the screen to a disabled button). Leaving the tab asks first
  (`beforeunload`).
- **Draft from an earlier visit** — the draft is kept in `localStorage`
  (`laqta:document-draft:<key>`) while unpublished; on the next visit a warning alert offers
  «استعادتها / تجاهلها». Storage failures are ignored — it is a convenience only.
- **Refused publish** — destructive alert inside the publish bar with the rule's message.
- **After publish / restore** — success toast; the page refreshes and the editor
  remounts (keyed by the live version id) clean from what is now live.
- Dated pages (`terms`, `privacy`, `licences`, `content-policy`) note «تاريخ السريان في
  الصفحة يصبح تاريخ النشر.»
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- The code default is never deleted and is always the fallback: no row, a database error,
  or a stored version that no longer validates renders `content/legal.ts`.
- Copy never breaks a page — `loadDocument` never throws.
- A published version is never rewritten; a restore is a new version. The date a version
  took effect is its `publishedAt`, and that is the date the public page prints.
- Every publish and restore is audited (`AuditLog`, entity `DocumentVersion`).
- The preview is the page: it renders `components/layout/document-body.tsx`, the same
  component the public routes render.

## Verified by
- `verify:documents` — the original text of all six pages passes the rules; each refusal
  above; a refused publish writes nothing; a publish is stored normalised, attributed,
  audited, shown by the page and dated from the publish; the newest wins; a restore (to a
  version and to the original) writes a new row, deletes nothing and is audited; a restore
  across pages is refused; a stored version that no longer validates falls back.
- `verify:licence` — also scans the newest published version of every page.
- `verify:arabic`, `audit` — `/admin/content/terms`.
- Not covered: the client editor's controls (reorder, fold, draft restore, publish button)
  are driven by no browser gate.
