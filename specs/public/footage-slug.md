# Clip detail

**Route** `/footage/[slug]` · **Access** public · **Rendering** server component, dynamic (per-slug DB read)

## Purpose
A crawlable, shareable page for one clip that funnels the visitor to the album — the only purchasable unit.

## Data in
- `Clip` where `slug = params.slug` AND `album.status='live'`. Selects titles, `descriptionAr`, `durationS`, `width`, `height`, `fps`, `codec`, `colourProfile`, `aspectRatio`, `camera`, `lens`, `cameraMovement`, `shotSize`, `timeOfDay`, `hasPeople`, `identifiableFaces`, `thumbnailKeys`, `previewHlsKey`.
- `Clip.location` → `Taxonomy` (`slug`, `nameAr`); `Clip.taxonomy` → `ClipTaxonomy → Taxonomy` (`kind`, `slug`, `nameAr`).
- `Clip.album` → `slug`, titles, `priceStandard`, `currency`, `clipCount`, `clearedForCommercial`, `clearanceStatus`, `creator.handle`, `creator.displayNameAr`, plus up to 12 sibling clips ordered by `orderIndex`.
- `masterKey` is explicitly excluded from the select.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Location badge | Link | `/locations/{taxonomy.slug}` |
| Taxonomy badge | Link | `/locations/{slug}` if `kind='location'`, otherwise `/categories/{slug}` |
| Sibling clip thumbnail | Link | `/footage/{sibling.slug}` |
| Album title (sidebar) | Link | `/albums/{creatorHandle}/{albumSlug}` |
| "اشترِ الألبوم" (`catalogue.buyAlbum`) | Link | `/albums/{creatorHandle}/{albumSlug}` — **not** a cart add; the tier is picked on the album page |
| "كل اللقطات" (`catalogue.allClips`) | Link | Same album URL |
| "أضف إلى اللوح" (`commerce.addToBoard`) | Link | `/account/boards?add={clip.id}` — behind the `/account` auth guard in `middleware.ts`; an anonymous visitor is bounced to `/sign-in` |

Read-only apart from navigation — this route calls no server action.

## States
- **Not found / album not live** — `notFound()` → 404. `generateMetadata` returns `state.notFound` for the same case.
- **No description** — the paragraph is omitted.
- **No thumbnail** — the hero area renders as the empty `bg-muted` box (watermark and badges still overlay it).
- **Single-clip album** — the "clips in album" strip is hidden when there are no siblings.
- **No preview player** — `previewHlsKey` is selected but never rendered; the page shows a still, not video. The HLS pipeline is not wired.
- **Not cleared for commercial** — the `BadgeCheck` next to the clip count is simply absent; no explanatory copy on this surface.

## Invariants
- A clip is never purchasable on its own. Every conversion control points at the album, and the album's clip count and price are stated on this page rather than discovered at checkout.
- `Clip.masterKey` must not be selected or referenced by any catalogue query.
- Every preview surface (hero still, sibling thumbnails) carries `PreviewWatermark`; the `catalogue.previewWatermarked` badge states it in words.
- Latin spec values (codec, camera, colour profile) are wrapped in `.ltr-island`; numeric values in `.numeric`.
- `VideoObject` JSON-LD is emitted server-side; the page must stay crawlable.

## Verified by
`verify:arabic` (via `/footage/alula-01`), `audit`.
