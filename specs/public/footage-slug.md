# Clip detail

**Route** `/footage/[slug]` · **Access** public · **Rendering** server component, dynamic (per-slug DB read)

## Purpose
A crawlable, shareable page for one clip that plays that clip's own preview and funnels the visitor to the album — the only purchasable unit.

## Data in
- `Clip` where `slug = params.slug` AND `album.status='live'`. Selects titles, `descriptionAr`, `durationS`, `width`, `height`, `fps`, `codec`, `colourProfile`, `aspectRatio`, `camera`, `lens`, `cameraMovement`, `shotSize`, `timeOfDay`, `hasPeople`, `identifiableFaces`, `thumbnailKeys`, `previewHlsKey`, `previewKey`.
- `Clip.location` → `Taxonomy` (`slug`, `nameAr`); `Clip.taxonomy` → `ClipTaxonomy → Taxonomy` (`kind`, `slug`, `nameAr`).
- `Clip.album` → `slug`, titles, `priceStandard`, `currency`, `clipCount`, `origin`, `clearedForCommercial`, `clearanceStatus`, `creator.handle`, `creator.displayNameAr`, plus **all** the album's clips ordered by `orderIndex` (`slug`, titles, `thumbnailKeys`, `durationS` — serialised to a number for the client grid — and `previewKey`).
- `masterKey` and `proxyKey` are explicitly excluded from the select.
- Poster and preview keys resolve through `lib/media.ts#mediaUrl`: "/"-rooted keys serve from `public/`; bucket keys resolve against `NEXT_PUBLIC_MEDIA_CDN_URL`, and to `null` when it is unset. The OG image and `VideoObject.thumbnailUrl` use the same resolver.

- **SEO (DEV-33)** — `alternates: localeAlternates(path)`: canonical is this page in this language, hreflang names both; `og:locale` via `ogLocale()`; `generateMetadata` resolves the locale first. Checked by `verify:seo`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Preview pause/play (`AutoplayVideo`, only when the clip's preview resolves) | Client | The frame at the top plays **this clip's own** `previewKey` — muted, looped, `object-contain` on ink so a 9:16 shot stays 9:16. It starts when half of it is on screen, pauses when it leaves, never autoplays under `prefers-reduced-motion`; the button (`media.play`/`media.pause`, labelled from the element's real state) is always there. A «بلا صوت» chip states it is silent |
| Location badge | Link | `/locations/{taxonomy.slug}` |
| Taxonomy badge | Link | `/locations/{slug}` if `kind='location'`, otherwise `/categories/{slug}` |
| Album shot tile (`AlbumShots`, the album's full grid with this shot marked `aria-current`) | Link (plain `<a>`) | `/footage/{shot.slug}`; hover/focus plays that shot's own preview in the tile |
| Album title (sidebar) | Link | `/albums/{creatorHandle}/{albumSlug}` |
| "اشترِ الألبوم" (`catalogue.buyAlbum`) | Link | `/albums/{creatorHandle}/{albumSlug}` — **not** a cart add; the tier is picked on the album page |
| "كل اللقطات" (`catalogue.allClips`) | Link | Same album URL |
| «أضف للوح» (`commerce.addToBoard`) | Link | `/account/boards?add={clip.id}` — behind the `/account` auth guard in `middleware.ts`; an anonymous visitor is bounced to `/sign-in`; signed in, the boards page leads with "add this clip to…" (DEV-49) |

Read-only apart from navigation — this route calls no server action.

## States
- **Not found / album not live** — `notFound()` → 404. `generateMetadata` returns `state.notFound` for the same case.
- **Preview available** — the top frame is the player (see Controls). It owns its watermark; the page does not draw a second one.
- **No preview** — `previewKey` NULL, or a bucket key with no CDN configured → the clip's poster (`object-contain`, alt `catalogue.altClipThumb`) with `PreviewWatermark`. Never a sibling's footage.
- **Preview fails to load** (CDN 404, network) → the player steps down to the poster with no play button.
- **No thumbnail** — the frame renders as an empty ink box (watermark and badges still overlay it).
- **Badges on the frame** — origin (captured/generated) at the top start edge; «معاينة بعلامة مائية» and the duration stacked at the top end edge (the bottom corners belong to the player's control and «بلا صوت» chip). Duration uses the `film` badge.
- **No description** — the paragraph is omitted.
- **Single-clip album** — the "clips in album" grid is hidden when the album has one clip.
- **No HLS** — `previewHlsKey` is selected but never rendered; previews are single progressive MP4s.
- **Not cleared for commercial** — the `BadgeCheck` next to the clip count is simply absent; no explanatory copy on this surface.

## Invariants
- The album box states the album's clip count through `countOf('clip', n)` («٢٢ لقطة», «٥ لقطات», "22 clips") — never a number beside a fixed noun (DEV-22).
- **Preview download («حمّل المعاينة»)** in the side panel, below the buy actions, as an outline button (gold stays on the buy button): signed-in → `/api/preview/[clipId]?back=…`, the watermarked 720p file; signed-out → «سجّل دخولك وحمّل المعاينة» to `/sign-in?callbackUrl=<this page>`. A note under it says it is watermarked, 720p, for testing in the edit, not for published work. `?comp=limit|unavailable` renders a status line there. Rendered only when the preview is deliverable. Contract: [`../api/preview-download.md`](../api/preview-download.md).
- A clip is never purchasable on its own. Every conversion control points at the album, and the album's clip count and price are stated on this page rather than discovered at checkout.
- The player plays the clip being viewed — its own `previewKey` — and nothing else.
- `Clip.masterKey` and `Clip.proxyKey` (the clean editing copy) must not be selected or referenced by any catalogue query.
- Every preview surface (player, still, album grid) carries a watermark; `npm run media:previews` also burns «لقطة · معاينة» into the preview file itself. The `catalogue.previewWatermarked` badge states it in words.
- Latin spec values (codec, camera, colour profile) are wrapped in `.ltr-island`; numeric values in `.numeric`.
- `VideoObject` JSON-LD is emitted server-side; the page must stay crawlable. `inLanguage` is the page's language (`ar-SA` / `en`, DEV-35). Carries `uploadDate` (the clip's `createdAt`), absolute `thumbnailUrl`s, and the AI-origin marker: `additionalProperty` `digitalSourceType` (IPTC `trainedAlgorithmicMedia` / `digitalCapture`) plus a `genre` of "AI-generated stock footage" or "Stock footage" (DEV-36).

## Verified by
`verify:arabic` (via `/footage/alula-01`), `audit`. Resolver rules unit-tested in `tests/unit/media.test.ts`. The player was checked by hand in a browser on 2026-09-24 (plays the clip's own `previewKey`).
