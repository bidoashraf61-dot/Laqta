# Category hub

**Route** `/categories/[slug]` · **Access** public · **Rendering** server component (`TaxonomyHub kind="category"`), dynamic

## Purpose
An SEO landing page for one category: Arabic metadata, breadcrumb, editorial copy, and the clips that belong to it.

## Data in
- `Taxonomy` by unique `(kind='category', slug)`. Used for `nameAr/En`, `seoTitleAr`, `seoDescAr`, `heroImage`.
- `search({ category: slug, page, perPage: 24 })` from `lib/search.ts` — matches `Clip` where either `ClipTaxonomy` or the parent `Album`'s `AlbumTaxonomy` carries a `category` taxonomy with this slug, and `album.status='live'`, `ingestStatus='ready'`.
- Metadata falls back to `"{nav.footage} {nameAr}"` and `"{brand.tagline} — {nameAr}. {brand.promise}"` when the SEO fields are unset.

- **SEO (DEV-33)** — `alternates: localeAlternates(path)`: canonical is this page in this language, hreflang names both; `og:locale` via `ogLocale()`; `generateMetadata` resolves the locale first. Checked by `verify:seo`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Breadcrumb "الرئيسية" | Link | `/` |
| Breadcrumb "الفئات" | Link | `/categories` |
| Clip card | Link | `/footage/{slug}` |
| Clip card album ribbon | Link | `/albums/{creatorHandle}/{albumSlug}` |

Read-only. **No filter rail and no pagination controls** — the page accepts `?page=n` and passes it into `search()`, but nothing on the page renders next/previous links, so pages beyond the first are only reachable by editing the URL.

## States
- **Unknown slug or `isActive=false`** — `notFound()` → 404. Metadata returns `state.notFound`.
- **No clips** — `EmptyState` with `catalogue.noResultsTitle` / `catalogue.noResultsBody`.
- **No `seoDescAr`** — the editorial paragraph is omitted.

## Invariants
- Only live albums' ready clips appear.
- The page is server-rendered end to end — this is the highest-value organic surface and must not depend on client JS.
- `BreadcrumbList` JSON-LD is emitted.
- Every clip carries its album ribbon and `PreviewWatermark`.

## Verified by
`verify:arabic` (via `/categories/aerials`), `audit`.
