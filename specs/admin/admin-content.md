# Page text

**Route** `/admin/content` · **Access** admin only · **Rendering** server, dynamic (`auth()`)

## Purpose
The list of the long-form pages the owner edits from admin (DEV-64a): Terms, Privacy,
Licences, Content policy, About, Contact. Each row says what the site shows right now —
the original text from the code, or the newest published version — and opens its editor.

## Data in
- The fixed registry `DOCUMENTS` / `DOCUMENT_KEYS` in `lib/editable-documents.ts` — six rows, always
  in this order: `terms`, `privacy`, `licences`, `content-policy`, `about`, `contact`. The
  row title is the page's own footer label (`footer.*`).
- `DocumentVersion.findMany({ distinct: ['docKey'], orderBy: [{ docKey }, { publishedAt: 'desc' }] })`
  — the newest version per page — and `groupBy(['docKey'])` for the version count.
- Publisher names: `User.findMany` on the publishers' ids (`name`, else `email`).

Takes no `searchParams`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Page title (row) | plain `<a>` (`Anchor`) → `/admin/content/[key]` | opens the editor |
| «عرض الصفحة» (row) | plain `<a>`, new tab | the public page (`/terms`, …) |
| «تعديل» (row) | plain `<a>` → `/admin/content/[key]` | opens the editor |

Plain anchors, not `next/link`: a row that opens the thing to work on is the navigation
CLAUDE.md says must never be a soft client push.

## States
- **Nothing published** for a page — neutral badge «النص الأصلي» and «لم تُنشر نسخة معدّلة بعد.»
- **Published** — success badge «منشورة {date}», then publisher · the version's note ·
  «النسخ المنشورة: {count}».
- No empty state: the six rows always exist.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- The list is the registry, not the table: a page with no versions still has a row, and a
  `docKey` in the table that is not in the registry is never shown.
- Nothing on this route writes.

## Verified by
`verify:arabic`, `audit` (both list `/admin/content`), `verify:documents` (the library
behind it).
