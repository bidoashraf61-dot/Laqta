# Location hub

**Route** `/locations/[slug]` · **Access** public · **Rendering** server component (`TaxonomyHub kind="location"`), dynamic

## Purpose
An SEO landing page for one Saudi location (العلا، الدرعية، الرياض…) with the clips shot there — the page the business intends to outrank the global libraries on.

## Data in
- `Taxonomy` by unique `(kind='location', slug)` for `nameAr/En`, `seoTitleAr`, `seoDescAr`, `heroImage`.
- `search({ location: slug, page, perPage: 24 })`. A clip matches on any of three paths: `Clip.location.slug`, its own `ClipTaxonomy` with a `location` taxonomy, or its `Album`'s `AlbumTaxonomy` with a `location` taxonomy. Album must be `live`, clip must be `ingestStatus='ready'`.

- **SEO (DEV-33)** — `alternates: localeAlternates(path)`: canonical is this page in this language, hreflang names both; `og:locale` via `ogLocale()`; `generateMetadata` resolves the locale first. Checked by `verify:seo`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Breadcrumb "الرئيسية" | Link | `/` |
| Breadcrumb "المواقع" | Link | `/locations` |
| Clip card | Link | `/footage/{slug}` |
| Clip card album ribbon | Link | `/albums/{creatorHandle}/{albumSlug}` |

Read-only. `?page=n` is accepted and applied, but no pagination controls are rendered.

## States
- **Unknown slug or `isActive=false`** — `notFound()` → 404.
- **No clips** — `EmptyState` with `catalogue.noResultsTitle` / `catalogue.noResultsBody`.
- **No `seoDescAr`** — the editorial paragraph is omitted.
- `heroImage` is read into metadata (OpenGraph) but is not rendered on the hub page itself.

## Invariants
- The result count reads `countOf('result', total)` («نتيجة واحدة», «٧ نتائج», «٢٤ نتيجة») (DEV-22).
- Only live albums' ready clips appear.
- Server-rendered end to end.
- `BreadcrumbList` JSON-LD is emitted.
- Every clip carries its album ribbon and `PreviewWatermark`.

## Verified by
`verify:arabic` (via `/locations/alula`), `verify:search` (transliteration and synonym resolution), `audit`.
