# Taxonomy

**Route** `/admin/taxonomy` · **Access** admin only · **Rendering** server, dynamic (`searchParams` + `auth()`)

## Purpose
Manage the one `Taxonomy` table that carries categories, locations, tags and themes —
above all the Arabic/English synonym layer that search folding depends on.

## Data in
- `searchParams.kind` — accepted if in `category | location | tag | theme`.
- `searchParams.q` — case-insensitive `contains` over `nameAr`, `nameEn`, `slug`.
- `Taxonomy.findMany` — `orderBy [kind asc, sortOrder asc, nameAr asc]`, `take: 300`,
  includes `parent.nameAr` and `_count` of `albums` and `clips` (only `albums` is shown).
- `Taxonomy.groupBy({ by: ['kind'] })` — chip counts.
- `Taxonomy.findMany({ where: { parentId: null } })` — the parent select options
  (id, nameAr, kind), ordered `kind asc, nameAr asc`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| `SearchBox` | GET form / `?q=` | re-queries the list |
| `FilterChips` (`param="kind"`) | plain `<a>` to `?kind=` | re-queries the list |
| «إضافة مصطلح» (header) | opens `TaxonomyEditor` in create mode | — |
| «تعديل» (per term) | opens `TaxonomyEditor` in edit mode | — |
| Editor form → save | `saveTaxonomy` (`SettingsForm`) | creates or updates a `Taxonomy` row: kind, slug, nameAr, nameEn, `synonymsAr[]`, `synonymsEn[]`, `parentId`, `isActive`, `sortOrder`. Audits `taxonomy.create` / `taxonomy.update` |
| Activate / deactivate button | `toggleTaxonomyActive(id, !isActive)` | flips `isActive`. Audits `taxonomy.activate` / `taxonomy.deactivate` |

There is **no delete control** — terms are only deactivated.

Also on each **location** and **category** row: «نص الصفحة» (plain `<a>`) → [`/admin/taxonomy/[id]`](admin-taxonomy-id.md), where the page's intro, FAQs and SEO text are written (DEV-41).

## States
- **Empty result** — `EmptyState` with `dash.noTerms`.
- **Inactive term** — a warning badge (`dash.slotInactive`) beside the name; the row is
  otherwise identical.
- **Validation failures** (inline `Alert` above the form):
  - kind not in the four allowed values → `state.error`
  - missing `nameAr` or `nameEn` → `dash.termAr`
  - slug failing `/^[a-z0-9][a-z0-9-]*$/` → `dash.termSlug`
  - `(kind, slug)` already taken by another row → `dash.termSlug`
- **Self-parenting** — if the submitted `parentId` equals the term's own `id` it is
  coerced to `null` rather than rejected.
- **Synonym parsing** — split on both the Latin comma and the Arabic comma `،`, trimmed,
  empties dropped.
- **Truncation** — hard `take: 300`, no pagination.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- Each term's album count is `countOf('album', n)` (DEV-22).
- Terms are deactivated, never deleted: a delete would cascade away `AlbumTaxonomy` /
  `ClipTaxonomy` attachments and break bookmarked location URLs.
- `(kind, slug)` is unique in the schema and re-checked in the action before writing.
- The synonym arrays are the search contract — they are what lets an Arabic query reach
  English-tagged footage. They are stored as written, not normalised here.
- Read/write of taxonomy touches no money and no entitlement.

## Verified by
`verify:arabic`, `audit`, `verify:flows` (filter-chip navigation on `/admin/taxonomy`).
The downstream folding/stemming behaviour is covered by `verify:search`, but that gate
does not drive this editor.
