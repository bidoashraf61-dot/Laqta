# Landing

**Route** `/` · **Access** public (signed-out and signed-in) · **Rendering** server component, dynamic (three DB reads per request, no caching directives)

## Purpose
Sell the albums-only model to a first-time buyer, framed around the buyer's job: *ready-made Saudi cinematic content that saves production time.* A scroll-scrubbed hero film opens; a problem/solution beat names the pain; a wall of frames and the album collection carry the catalogue; licensing, how-it-works, and a pricing/value case close the objections; a final buyer push and the creator invite end the page.

## Data in
- `getFeaturedAlbums(6)` (`lib/catalogue.ts`) — `Album` where `status='live'`, ordered `isFeatured desc, featureRank asc, salesCount desc, publishedAt desc`, take 6. Cover posters resolved in one follow-up `Clip.thumbnailKeys[0]` query by `coverClipId`.
- `getFootageWall(12)` — `Clip` where `album.status='live'`, ordered `album.salesCount desc, orderIndex asc`, take 48 (`take*4`), then re-woven round-robin per album down to 12 tiles. Each tile carries its album's routing + price.
- `getLandingTrailers(5)` — `Album` where `status='live'` and `trailerKey IS NOT NULL`, same order as the featured shelf, over-fetched ×2 and then filtered to keys `lib/media.ts#mediaUrl` actually resolves (a bucket key with no CDN, or a URL off the CDN origin, is dropped). Card fields + `trailerKey`; cover poster via the same `toCards` follow-up query.
- No stats query, and **no offers/shelf query** — `getCatalogueStats()` and `getOfferAlbums()` exist but this page calls neither. Nothing on the landing counts clips, albums, or creators out loud.
- `Clip.masterKey` is never selected.

## Sections (in order)
1. `HeroCinematic` — scroll-scrubbed film; two CTAs. Two-cut headline (Thmanyah Sans Light lead, Serif Display Bold statement), no kashida: «جمهورك سعودي، ولقطات إعلانك سعودية.» (EN «Your audience is Saudi, and so is your footage.») — chosen by the owner on 2026-09-24 over the shoot-day line, to lead with the Saudi-footage USP. Written to `docs/content/brand-voice-ar.md`: a plain claim, no metaphor. The body under it (`landing.heroBody`) no longer repeats «سعودية». The USP rail — four claims as a vertical scrubber — sits at the inline-start edge on desktop and **docks to the bottom of the frame on mobile**; it was `display:none` below 1024px until 2026-09, so phone visitors never saw it.
2. `ProblemSolution` — a **split**: media at the inline-start (the right, in Arabic), copy at the inline-end. Stacks copy-first on phones. Headline «لقطات من موقع واحد، بضوء واحد وهوية واحدة.», drawn from the section's own claim. Body claim: an album gathers **٣٠–٧٠ matching clips around one subject** (EN «30 to 70 matching clips around a single subject»; changed from 10–24 by the owner on 2026-09-24). The media slot is a placeholder still, built to take a video (`.mp4`/`.webm`, preferred) or an image/GIF for the planned Premiere-timeline capture — one constant, `MEDIA.src`.
3. `FootageWall` — showreel (id `#showreel`) + hover-preview tile masonry.
4. `TheCollection` — album posters, centred head, seasonal tagline, "all albums" button, `olive` ground.
4b. `Trailers` (`components/landing/trailers.tsx` + client `trailer-theatre.tsx`, added 2026-09-24 at the owner's request) — `base` (paper) ground. Two-cut head «شوف الألبوم يتحرك،» / **«قبل ما تدفع.»** (EN «See the album move,» / «before you pay.»), `<Prose>` body. One featured player in an ink letterbox — **2.39:1 from `md` up, 16:9 on phones** (2.39:1 at 375px is a strip) — and under it, the on-screen album's title (h3), clip count, price (ink, bold) and an «افتح الألبوم» primary button to the album — the button is the section's one gold element, so the price beside it stays ink (One Voice). Beside it on desktop (below on phones) a list of every trailer album: a 2.39:1 poster thumb, title, clip count · price (not gold), and «يُعرض الحين» on the selected row from `sm` up (on phones it truncated the title; the ink ring on the thumb and `aria-pressed` carry the state). The list is omitted when there is one trailer. **Position, justified:** after the collection, because the posters show each album still and this shows the same product moving, so a buyer who has picked a poster can watch it before reading the licence; and NOT beside the footage wall, whose showreel is already a large autoplaying player — two back to back compete for the same eye. **Hidden entirely** (renders `null`) when `getLandingTrailers` returns nothing, which is the state of the catalogue at launch.
5. `LicensingRights` — features/rights checklist (`components/landing/licensing.tsx`).
6. `HowItWorks` — three steps (`components/landing/sections.tsx`).
7. `PricingValue` — value case + three points + buy CTA (`components/landing/pricing-value.tsx`), `accent` (gold-tint) ground. Each point carries an **ink** icon on a paper disc (∞, clock, palette) — ink, not gold, because the section already spends gold on the buy button.
8. `LandingFaq` — five Q&A + `FAQPage` JSON-LD. **Numbered** in the reader's own digits (١–٥ in Arabic, 1–5 in English) inside each `<dt>`, with a hanging indent so answers align under the question. On two columns the reading order zig-zags; the number makes it visible.
9. `RequestFootage` — request a custom album.
10. `FinalCta` — closing buyer push (`components/landing/final-cta.tsx`), `olive` ground.
11. `CreatorCta` — creator invite, last.

**Type composition (every section head).** `<Headline size="lg">`: Thmanyah Sans Light lead over a Serif Display Bold statement, and the paragraph under it is always `<Prose>` (Serif Text 1.2rem / 1.85) — never a muted Sans `<p>`. The owner signed this off on 2026-09-24 against the ProblemSolution and season-band sections as the model for the whole site. `TheCollection` and `RequestFootage` bodies moved to `<Prose>` in that change.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Hero primary «تصفّح اللقطات» (`landing.heroExplore`) | Link | `/footage` |
| Hero secondary «كيف تعمل لقطة؟» (`landing.heroWatchTrailer`) | Plain `<a href="#showreel">` | Scrolls to the showreel in the footage wall (same-page hash, never the client router) |
| Footage-wall tile | Link | `/albums/{creatorHandle}/{albumSlug}` — never a clip page or clip checkout |
| Footage-wall "view all" | Link | `/footage` |
| Album poster in the collection (stretched link) | Link | `/albums/{creatorHandle}/{slug}` |
| Creator name on a poster (sibling link, lifted above the stretch) | Link | `/creators/{creatorHandle}` |
| Collection «عرض كل الألبومات» (`landing.collectionViewAll`) | Link | `/albums` |
| Trailer list row (`<button aria-pressed>`) | Client state | Swaps the featured player, poster, title, count, price and album link to that album; plays it unless reduced motion is set or nothing is in view |
| Trailer play/pause | Client | Toggles the player; a reader's pause is sticky (the in-view observer never overrides it) |
| Trailer mute/unmute (`aria-pressed`) | Client | Starts muted; the reader may turn sound on |
| Trailer «افتح الألبوم» (`catalogue.openAlbum`) | Plain `<a>` (`Anchor`) | `/albums/{creatorHandle}/{slug}` of the album on screen |
| Licensing CTA «اقرأ بنود الترخيص» (`landing.licenseCta`) | Link | `/licences` |
| Pricing CTA «اختر ألبومك» (`landing.priceCta`) | Link | `/albums` |
| Final CTA «تصفّح اللقطات» (`landing.finalCtaButton`) | Link | `/footage` |
| Creator CTA «بِع لقطاتك» (`landing.sellCta`) | Link | `/sell` |
| Hero film | Client scroll scrub, no navigation | `currentTime` tracked to wrapper scroll progress; read-only |

## States
- **No trailers** — no live album has a resolvable `trailerKey`: the whole `Trailers` section is absent (no heading, no empty theatre). This is the launch state.
- **Empty catalogue** — `FootageWall` returns `null` (the section disappears); `TheCollection` renders `EmptyState` with `state.empty`.
- **Reduced motion** — the hero does not scrub; poster and server-rendered `<h1>` stand; hover-preview loops never start.
- **Hero source** — `lib/media.ts#heroFilmUrl`: with `NEXT_PUBLIC_MEDIA_CDN_URL` set, the film streams from the media CDN (`hero/hero-web.mp4`, phones ≤860px `hero/hero-web-m.mp4`, 720p); without it, from the local `/hero/vid/hero-web.mp4` / `hero-web-m.mp4`. Only the source changed (2026-09-24); the scrub, seek coalescing and iOS prime are untouched. `npm run media:upload` pushes the two local files to the bucket.
- **Hero/showreel video missing** — `public/hero/vid/` is gitignored; with no CDN configured, a fresh checkout or a deploy has no film and only the poster/copy render. A deploy needs the CDN (see `docs/tech/media-aws.md`).

## Invariants
- **The launch catalogue is AI-generated.** No page may claim Laqta's footage was filmed in the Kingdom, shot at real locations, or had permits cleared — no «مواقع حقيقية», «تصاريح موثّقة», «من داخل المملكة», «مصوّرة» about the catalogue. The ص-و-ر root is allowed in exactly one sense: the **buyer's own alternative** — «يغنيك عن يوم تصوير». What the buyer gets is described by what is true of every album: reviewed before publication, one full commercial licence, a certificate with every purchase. The production-method disclosure lives in the content policy and the per-album origin badge, not in marketing.
- **No comparative price claim.** `landing.priceLead`/`priceBold` say «بلا اشتراك ولا رصيد ينتهي، ادفع مرة واحدة، والألبوم لك.» — the verifiable difference from a subscription library. An earlier «١٦ مرة» claim was removed, and an editorial pass later reintroduced one as «ألبوم كامل بسعر لقطة مفردة»; both are banned. See `specs/glossary.md`.
- **Licence claims must match `content/legal.ts`** — one licence: full commercial, perpetual, no cap on views; excludes reselling the clip itself. Landing copy must not contradict the licences page, and must not say «جميع الاستخدامات».
- A clip is bait; the album is the product. Every wall tile links to an album; no surface offers a single clip for sale.
- Every preview frame is watermarked via `PreviewWatermark`.
- Album cards are flat, cover-led **5:7 posters** (not faux-3D boxes; see `specs/public/albums.md`) — a real cover image drops straight into the cover slot when uploaded. Wall tiles honour the clip's real aspect ratio — forcing 16:9 is banned. The card is a container `<div>`, not an anchor: a stretched anchor covers it for the album link, and the creator name is a **sibling** anchor lifted above the stretch — never a nested `<a>`.
- One Voice Rule: gold is the price chip, the primary buttons, and the wall's «افتح الألبوم» button (shown only on the hovered tile). The footage wall shows **no price** — the tile is a doorway, not a shelf.
- The showreel plays on intersection (threshold 0.5), always muted, with a visible pause control; under `prefers-reduced-motion` it never starts. `SHOWREEL_SRC` is a **deliberate placeholder** (the hero's own mobile file, resolved like the hero — CDN when configured, local otherwise) pending a catalogue cut uploaded to the media bucket.
- **Trailers add no weight before scroll.** The `<video>` has no `src` until the theatre is within one viewport (IntersectionObserver `rootMargin: 100%`), then `preload="none"`; list thumbs are `loading="lazy"`. It plays muted only when half the player is on screen (threshold 0.5), pauses when it leaves, never autoplays under `prefers-reduced-motion` (selecting a row then only swaps the poster), and a failed trailer drops to its poster with no controls. The player carries its own `PreviewWatermark`. Trailer keys are resolved only by `mediaUrl`.
- Hover-preview `<video>` is created on FIRST hover (Safari caps simultaneous decoders); a tile plays its clip's own `Clip.previewKey`, resolved by `lib/media.ts#mediaUrl`; a tile whose key does not resolve (none, or a bucket key with no CDN) stays a poster; hover is never the only route (whole tile is a link + an explicit «افتح الألبوم» control).
- FAQ emits `FAQPage` JSON-LD from the SAME dictionary keys the component renders (`components/catalogue/faq-schema.tsx`); kashida is stripped from the marked-up strings.
- `Organization` JSON-LD carries `logo` + `sameAs` from `lib/brand.ts` (shared with the footer). The logo at `/brand/laqta-logo.png` is INTERIM.
- Bilingual: every landing key exists in both `messages/ar.json` and `messages/en.json`; a missing English key falls back to Arabic and would leak into `/en` (caught by `verify:arabic`).
- Fully server-rendered — nothing on the page may require client JS to become visible.

## Verified by
`verify:hero` (the film mounts, scrubs both ways, stays bounded; the wall, collection, and licensing sections render below it), `verify:arabic` (both directions), `audit`.
