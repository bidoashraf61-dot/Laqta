# Sitemap and robots

**Route** `/sitemap.xml` (`app/sitemap.ts`) · `/robots.txt` (`app/robots.ts`) · **Access** public · **Rendering** route handlers; the sitemap revalidates hourly (`revalidate = 3600`)

## Purpose
Tell crawlers every indexable page, in both languages, with nothing that 404s — and keep the private pages out.

## Data in
- `Album` where `status='live'` → `/albums/[creator]/[slug]` (0.8, weekly).
- `Taxonomy` where `isActive`, **`kind` in (`location`, `category`)**, and at least one live album → `/locations/[slug]` (0.85) and `/categories/[slug]` (0.7). **Themes and tags are never listed** — they have no public route; they used to be sent to `/collections/<slug>`, which looks up a `Collection` row and 404s (DEV-34).
- `Taxonomy` `kind='theme'` for the five occasions (`OCCASION_SLUGS`), active and with a live album → `/occasions/[slug]` (0.7) (DEV-42).
- `Collection` where `isPublished` and at least one live album → `/collections/[slug]` (0.6).
- `Clip` whose album is live → `/footage/[slug]` (0.5, monthly) (DEV-34). Each clip entry carries a `<video:video>` block when the clip has a poster (`thumbnailKeys[0]`): title and description in that entry's language (description falls back to «لقطة من ألبوم «…» على لقطة.» / "A clip from the album … on Laqta."), `thumbnail_loc`, `content_loc` = the public **watermarked** preview (`previewKey`, never the master or the buyer's proxy), duration in whole seconds, `publication_date`, `family_friendly=yes`, `requires_subscription=no`. Media URLs go through `lib/media.ts#mediaUrl`; "/"-rooted keys are made absolute with `siteOrigin()`. A clip without a poster is listed without a video block.
- `Creator` where `status='approved'` → `/creators/[handle]` (0.5).
- Static: `/` (1.0), `/footage`, `/albums` (0.9), `/creators`, `/sell` (0.6).
- Every URL is emitted twice — Arabic (bare) and English (`/en`) — and each names both in `alternates.languages`.
- Every absolute URL comes from `siteOrigin()` (`lib/site.ts`, DEV-40).

## Controls
None — machine-read documents.

## States
- **Empty catalogue** — only the static routes are listed.
- **robots.txt** — allows `/`; disallows `/account`, `/studio`, `/admin`, `/cart`, `/checkout`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` in both languages, and `/api/`; names the sitemap and host.

## Invariants
- Nothing in the sitemap answers anything but 200.
- No draft, suspended or sample album, and no clip of one.
- A video block never points at a master or a proxy.

## Verified by
`verify:seo` — fetches `/sitemap.xml`; checks clip pages are listed in both languages, that `<video:video>` blocks with thumbnails exist, and that every non-clip URL (plus a sample of clip URLs) answers 200; and that robots.txt keeps both languages of the private pages out.
