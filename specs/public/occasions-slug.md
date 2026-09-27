# Occasion page

**Route** `/occasions/[slug]` · **Access** public · **Rendering** server component (`TaxonomyHub kind="theme"`), dynamic

## Purpose
A landing page for one campaign season a Saudi brief is built around (DEV-42): «لقطات رمضان»,
«لقطات العيد», «لقطات يوم التأسيس», «لقطات اليوم الوطني», «لقطات موسم الرياض» — the albums and
clips tagged with that occasion.

## Data in
- `slug` must be one of `lib/occasions.ts#OCCASION_SLUGS` — `ramadan`, `eid`, `founding-day`, `national-day`, `riyadh-season`. Any other slug (including the other themes, `hajj-umrah`, `winter-tantora`…) → 404.
- `Taxonomy` by `(kind='theme', slug)`, active — name, owner-written intro / FAQs / SEO text (DEV-41 fields, edited at [`/admin/taxonomy/[id]`](../admin/admin-taxonomy-id.md)).
- `search({ theme: slug })` — clips whose own or album's taxonomy carries the theme (`lib/search.ts`, `theme` filter added in DEV-42); `getHubAlbums(id, 'theme')`; `getRelatedHubs(id)`.
- **Title and H1** — `catalogue.hubTitle` «لقطات {name}» / "{name} stock footage"; description: own-language `seoDesc*`, else `brand.seo.hubOccasion` «لقطات {name} السعودية في ألبومات جاهزة للمونتاج لحملتك الموسمية، بترخيص تجاري دائم.»
- **SEO** — canonical/hreflang per language (`localeAlternates`), breadcrumb JSON-LD (Home › Footage › occasion), FAQPage when FAQs exist; listed in the sitemap when it has live albums.

## Controls
Same as the location hub ([locations-slug.md](locations-slug.md)): breadcrumb (Home / «اللقطات» → `/footage` — occasions have no index page), album cards, clip cards, related-hub pills.

## States
Same as the location hub: intro, albums, clips (empty → `catalogue.noResultsTitle`), FAQs and related hubs each omitted when empty.

## Invariants
- Only the five occasions have a page; `hajj-umrah` stays a search facet (holy sites are not carried).
- Server-rendered end to end.

## Verified by
`verify:seo` (`/occasions/ramadan` in both languages: canonical, hreflang, title language, JSON-LD language), `verify:arabic`, `audit`.
