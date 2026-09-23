# Landing

**Route** `/` · **Access** public (signed-out and signed-in) · **Rendering** server component, dynamic (two DB reads per request, no caching directives)

## Purpose
Sell the albums-only model to a first-time buyer, framed around the buyer's job: *ready-made Saudi cinematic content that saves production time.* A scroll-scrubbed hero film opens; a problem/solution beat names the pain; a wall of frames and the album collection carry the catalogue; licensing, how-it-works, and a pricing/value case close the objections; a final buyer push and the creator invite end the page.

## Data in
- `getFeaturedAlbums(6)` (`lib/catalogue.ts`) — `Album` where `status='live'`, ordered `isFeatured desc, featureRank asc, salesCount desc, publishedAt desc`, take 6. Cover posters resolved in one follow-up `Clip.thumbnailKeys[0]` query by `coverClipId`.
- `getFootageWall(12)` — `Clip` where `album.status='live'`, ordered `album.salesCount desc, orderIndex asc`, take 48 (`take*4`), then re-woven round-robin per album down to 12 tiles. Each tile carries its album's routing + price.
- No stats query, and **no offers/shelf query** — `getCatalogueStats()` and `getOfferAlbums()` exist but this page calls neither. Nothing on the landing counts clips, albums, or creators out loud.
- `Clip.masterKey` is never selected.

## Sections (in order)
1. `HeroCinematic` — scroll-scrubbed film; two CTAs. Two-cut headline (Thmanyah Sans Light lead, Serif Display Bold statement), no kashida. The USP rail — four claims as a vertical scrubber — sits at the inline-start edge on desktop and **docks to the bottom of the frame on mobile**; it was `display:none` below 1024px until 2026-09, so phone visitors never saw it.
2. `ProblemSolution` — a **split**: media at the inline-start (the right, in Arabic), copy at the inline-end. Stacks copy-first on phones. Headline «لقطات من موقع واحد، بضوء واحد وهوية واحدة.», drawn from the section's own claim. Body claim: an album gathers **٣٠–٧٠ matching clips around one subject** (EN «30 to 70 matching clips around a single subject»; changed from 10–24 by the owner on 2026-09-24). The media slot is a placeholder still, built to take a video (`.mp4`/`.webm`, preferred) or an image/GIF for the planned Premiere-timeline capture — one constant, `MEDIA.src`.
3. `FootageWall` — showreel (id `#showreel`) + hover-preview tile masonry.
4. `TheCollection` — album posters, centred head, seasonal tagline, "all albums" button, `olive` ground.
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
| Licensing CTA «اقرأ بنود الترخيص» (`landing.licenseCta`) | Link | `/licences` |
| Pricing CTA «اختر ألبومك» (`landing.priceCta`) | Link | `/albums` |
| Final CTA «تصفّح اللقطات» (`landing.finalCtaButton`) | Link | `/footage` |
| Creator CTA «بِع لقطاتك» (`landing.sellCta`) | Link | `/sell` |
| Hero film | Client scroll scrub, no navigation | `currentTime` tracked to wrapper scroll progress; read-only |

## States
- **Empty catalogue** — `FootageWall` returns `null` (the section disappears); `TheCollection` renders `EmptyState` with `state.empty`.
- **Reduced motion** — the hero does not scrub; poster and server-rendered `<h1>` stand; hover-preview loops never start.
- **Hero source** — `lib/media.ts#heroFilmUrl`: with `NEXT_PUBLIC_MEDIA_CDN_URL` set, the film streams from the media CDN (`hero/hero-web.mp4`, phones ≤860px `hero/hero-web-m.mp4`, 720p); without it, from the local `/hero/vid/hero-web.mp4` / `hero-web-m.mp4`. Only the source changed (2026-09-24); the scrub, seek coalescing and iOS prime are untouched. `npm run media:upload` pushes the two local files to the bucket.
- **Hero/showreel video missing** — `public/hero/vid/` is gitignored; with no CDN configured, a fresh checkout or a deploy has no film and only the poster/copy render. A deploy needs the CDN (see `docs/media-aws.md`).

## Invariants
- **The launch catalogue is AI-generated.** No page may claim Laqta's footage was filmed in the Kingdom, shot at real locations, or had permits cleared — no «مواقع حقيقية», «تصاريح موثّقة», «من داخل المملكة», «مصوّرة» about the catalogue. The ص-و-ر root is allowed in exactly one sense: the **buyer's own alternative** — «يوم تصوير كامل،» (the owner-approved hero lead), «يغنيك عن يوم تصوير». What the buyer gets is described by what is true of every album: reviewed before publication, one full commercial licence, a certificate with every purchase. The production-method disclosure lives in the content policy and the per-album origin badge, not in marketing.
- **No comparative price claim.** `landing.priceLead`/`priceBold` say «بلا اشتراك ولا رصيد ينتهي، ادفع مرة واحدة، والألبوم لك.» — the verifiable difference from a subscription library. An earlier «١٦ مرة» claim was removed, and an editorial pass later reintroduced one as «ألبوم كامل بسعر لقطة مفردة»; both are banned. See `specs/glossary.md`.
- **Licence claims must match `content/legal.ts`** — one licence: full commercial, perpetual, no cap on views; excludes reselling the clip itself. Landing copy must not contradict the licences page, and must not say «جميع الاستخدامات».
- A clip is bait; the album is the product. Every wall tile links to an album; no surface offers a single clip for sale.
- Every preview frame is watermarked via `PreviewWatermark`.
- Album cards are flat, cover-led **5:7 posters** (not faux-3D boxes; see `specs/public/albums.md`) — a real cover image drops straight into the cover slot when uploaded. Wall tiles honour the clip's real aspect ratio — forcing 16:9 is banned. The card is a container `<div>`, not an anchor: a stretched anchor covers it for the album link, and the creator name is a **sibling** anchor lifted above the stretch — never a nested `<a>`.
- One Voice Rule: gold is the price chip, the primary buttons, and the wall's «افتح الألبوم» button (shown only on the hovered tile). The footage wall shows **no price** — the tile is a doorway, not a shelf.
- The showreel plays on intersection (threshold 0.5), always muted, with a visible pause control; under `prefers-reduced-motion` it never starts. `SHOWREEL_SRC` is a **deliberate placeholder** (the hero's own mobile file, resolved like the hero — CDN when configured, local otherwise) pending a catalogue cut uploaded to the media bucket.
- Hover-preview `<video>` is created on FIRST hover (Safari caps simultaneous decoders); a tile plays its clip's own `Clip.previewKey`, resolved by `lib/media.ts#mediaUrl`; a tile whose key does not resolve (none, or a bucket key with no CDN) stays a poster; hover is never the only route (whole tile is a link + an explicit «افتح الألبوم» control).
- FAQ emits `FAQPage` JSON-LD from the SAME dictionary keys the component renders (`components/catalogue/faq-schema.tsx`); kashida is stripped from the marked-up strings.
- `Organization` JSON-LD carries `logo` + `sameAs` from `lib/brand.ts` (shared with the footer). The logo at `/brand/laqta-logo.png` is INTERIM.
- Bilingual: every landing key exists in both `messages/ar.json` and `messages/en.json`; a missing English key falls back to Arabic and would leak into `/en` (caught by `verify:arabic`).
- Fully server-rendered — nothing on the page may require client JS to become visible.

## Verified by
`verify:hero` (the film mounts, scrubs both ways, stays bounded; the wall, collection, and licensing sections render below it), `verify:arabic` (both directions), `audit`.
