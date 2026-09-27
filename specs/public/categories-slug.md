# Category hub

**Route** `/categories/[slug]` · **Access** public · **Rendering** server component (`TaxonomyHub kind="category"`), dynamic

## Purpose
An SEO landing page for one category: Arabic metadata, breadcrumb, editorial copy, and the clips that belong to it.

## Data in
- `Taxonomy` by unique `(kind='category', slug)`. Used for `nameAr/En`, `seoTitleAr`, `seoDescAr`, `heroImage`.
- `search({ category: slug, page, perPage: 24 })` from `lib/search.ts` — matches `Clip` where either `ClipTaxonomy` or the parent `Album`'s `AlbumTaxonomy` carries a `category` taxonomy with this slug, and `album.status='live'`, `ingestStatus='ready'`.
- Metadata falls back to `"{nav.footage} {nameAr}"` and `"{brand.tagline} — {nameAr}. {brand.promise}"` when the SEO fields are unset.

- **Page layout (DEV-41)** — top to bottom: breadcrumb; H1; the owner's **intro** (`introAr/En` via `pickLocalised`, `whitespace-pre-line`; falls back to the SEO description); the result count; **«ألبومات {name}» / "{name} albums"** — up to 6 live albums tagged with the term or holding clips that are (`lib/catalogue.ts#getHubAlbums`), first page only; **«اللقطات»** — the clip grid; **«أسئلة عن {name}»** — up to 3 owner-written Q&As (`Taxonomy.faqs`, read through `lib/hub-page.ts#parseHubFaqs`; English pair only when both halves exist, else the Arabic pair) with `FAQPage` JSON-LD; **«تصفّح أيضاً»** — up to 6 other active locations/categories the hub's albums are tagged with, most shared first (`getRelatedHubs`), as pill links. The owner writes the text at [`/admin/taxonomy/[id]`](../admin/admin-taxonomy-id.md).
- **Title and H1 (DEV-38)** — `catalogue.hubTitle`: «لقطات {name}» / "{name} stock footage" (e.g. «لقطات الرياض», "Riyadh stock footage"). The `<title>` uses the owner's `seoTitleAr`/`seoTitleEn` **in the page's own language only** — an English page with no `seoTitleEn` gets the generated English title, not the Arabic SEO title. The meta description likewise: own-language `seoDesc*`, else `brand.seo.hubCategory` («لقطات {name} سعودية في ألبومات جاهزة للمونتاج…» / "{name} stock footage from Saudi Arabia in edit-ready albums…").
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
- **No intro and no `seoDesc*`** — the paragraph is omitted. **No albums / no FAQs / no related hubs** — that section is omitted.

## Invariants
- The result count reads `countOf('result', total)` (DEV-22).
- Only live albums' ready clips appear.
- The page is server-rendered end to end — this is the highest-value organic surface and must not depend on client JS.
- `BreadcrumbList` JSON-LD is emitted — Home › Footage › the hub, each name in the page's language and each `item` at its own-language address (`/en/…` on the English page) (DEV-35).
- Every clip carries its album ribbon and `PreviewWatermark`.

## Verified by
`verify:arabic` (via `/categories/aerials`), `audit`.
