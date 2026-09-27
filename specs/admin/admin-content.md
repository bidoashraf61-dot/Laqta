# Site copy and pages

**Route** `/admin/content` · **Access** admin only · **Rendering** server, dynamic (`auth()`)

## Purpose
The hub for every word the owner edits from admin, in two panels:
- **«نصوص الموقع»** (DEV-64b/c) — everything a visitor reads, in eight groups (landing +
  FAQ, `/sell`, emails, menus/footer/site messages, catalogue, cart/checkout,
  sign-in/account, contact): how many strings, how many edited, when last published; opens
  [`/admin/content/copy/[group]`](admin-copy-group.md).
- **«الصفحات الطويلة»** (DEV-64a) — Terms, Privacy, Licences, Content policy, About,
  Contact: the original text or the newest published version; opens
  [`/admin/content/[key]`](admin-content-key.md).

## Data in
- The fixed registry `DOCUMENTS` / `DOCUMENT_KEYS` in `lib/editable-documents.ts` — six rows, always
  in this order: `terms`, `privacy`, `licences`, `content-policy`, `about`, `contact`. The
  row title is the page's own footer label (`footer.*`).
- `DocumentVersion.findMany({ distinct: ['docKey'], orderBy: [{ docKey }, { publishedAt: 'desc' }] })`
  — the newest version per page — and `groupBy(['docKey'])` for the version count.
- Publisher names: `User.findMany` on the publishers' ids (`name`, else `email`).
- Per copy group (`COPY_GROUPS` in `lib/copy-rules.ts`): `groupKeys(group).length`, and
  `copyGroupStats(groupPrefixes(group))` — distinct edited keys and the newest
  `CopyRevision.publishedAt` under the group's sections.

Takes no `searchParams`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Copy group title / «تعديل» | plain `<a>` → `/admin/content/copy/[group]` | opens the copy editor |
| Copy group «عرض الصفحة» | plain `<a>`, new tab | the group's page (`/`, `/sell`, `/albums`, `/cart`, `/account`, `/contact`; none for email) |
| Page title (row) | plain `<a>` (`Anchor`) → `/admin/content/[key]` | opens the editor |
| «عرض الصفحة» (row) | plain `<a>`, new tab | the public page (`/terms`, …) |
| «تعديل» (row) | plain `<a>` → `/admin/content/[key]` | opens the editor |

Plain anchors, not `next/link`: a row that opens the thing to work on is the navigation
CLAUDE.md says must never be a soft client push.

## States
- **Nothing published** for a page — neutral badge «النص الأصلي» and «لم تُنشر نسخة معدّلة بعد.»
- **Published** — success badge «منشورة {date}», then publisher · the version's note ·
  «النسخ المنشورة: {count}».
- **Copy group** — success badge «المعدّلة: N» when any string is edited; then
  «N نصاً · آخر نشر {date}» or «… · لم يُعدَّل شيء بعد.»
- No empty state: the eight copy rows and six page rows always exist.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- Both lists are registries, not tables: a page with no versions still has a row, and a
  `docKey` in the table that is not in the registry is never shown.
- Nothing on this route writes.

## Verified by
`verify:arabic`, `audit` (both list `/admin/content`), `verify:documents` and
`verify:copy` (the libraries behind it).
