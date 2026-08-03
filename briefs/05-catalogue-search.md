# Brief 05 — Catalogue, Search & Album Pages

**Branch:** `feat/catalogue` · **Depends on:** Brief 01 (Foundation) merged
**Owns:** `app/[locale]/(public)/footage/*`, `/albums/*`, `/categories/*`, `/locations/*`, `/collections/*`, `/search`, `components/catalogue/*`, `lib/search.ts`

---

## Context

**Laqta (لقطة)** — Arabic-first stock-footage marketplace. Buyers purchase **albums** once and own them forever, no subscription.

Read `briefs/00-README-START-HERE.md` first.

---

## ⚠️ The rule this entire brief exists to solve

> **Buyers search at the CLIP level but pay at the ALBUM level.**

Artlist can show a flat infinite grid of clips because it's a subscription — every clip is "free" once you're in. Laqta breaks that symmetry:

| | Artlist | Laqta |
|---|---|---|
| Browsing unit | Clip | **Clip** — nobody searches for "Album #47" |
| Purchase unit | Subscription | **Album** |

**Therefore: every clip card, every search result, every grid tile must carry an album ribbon** — `من ألبوم: العُلا في الضوء الذهبي · 34 لقطة · SAR 799` — that routes to the album page.

Build a pure album catalogue → conversion collapses (nobody shops for footage that way). Build a pure clip catalogue with no album framing → buyers rage when they can't buy one clip. **The bridge is your job.**

---

## Routes you own

```
/footage                    clip explorer — the discovery engine
/footage/[slug]-[id]        clip detail (modal + deep-linkable page)
/albums                     album catalogue
/albums/[creator]/[slug]    ★ ALBUM PDP — the conversion page
/categories  /categories/[slug]
/locations   /locations/[slug]      ← highest-SEO surface
/collections /collections/[slug]
/search
```

---

## Clip explorer `/footage`

Masonry grid, hover-preview (muted, watermarked), infinite scroll.

**Card must show:** looping preview, duration, resolution badge, board button, and the **persistent album ribbon with price**.

**Filters** (left rail desktop, sheet mobile):
- Resolution: HD / 4K / 6K / 8K
- Frame rate: 24/25/30/50/60/120+
- Aspect: 16:9 / **9:16** / 1:1 / 2.39:1 — *vertical is a top filter in this market, don't bury it*
- Colour profile: LOG / Rec.709 / RAW
- Camera movement: drone / gimbal / handheld / static / slider / crane
- Shot size, time of day, season, mood
- Location (KSA region → city → landmark)
- People: with / without / identifiable faces
- **مرخّصة للاستخدام التجاري ✅** (releases + permits complete) — agencies filter on this exclusively
- Editorial use only
- Album price range, creator

---

## Album PDP — your conversion page

Treat it as an e-commerce product page:

- **Album trailer** auto-cut from the clips (generate at ingest) — lifts conversion significantly
- Title ar/en, creator byline → storefront, clip count, total runtime, format badges, sales count
- **Sticky price block:** licence tier selector (Standard / Extended = 3×) with a "which do I need?" helper, Buy button, reassurance line (تحميل فوري · وصول دائم · فاتورة ضريبية), BNPL line
- **Full clip grid** — every clip, hover-preview. Total transparency; buyers must see exactly what they get
- Technical specs table incl. **total download size** (40 GB matters to the buyer)
- Licence summary ✅/❌ + link to full text
- Clearance & permits badges
- Creator mini-profile + their other albums
- Related albums, reviews (verified purchasers only)

## Clip detail
Opens as a modal over the grid with a real URL for sharing/SEO. Watermarked scrubbable player, full metadata, location map pin, release badges, and **the conversion block**:

> **هذه اللقطة جزء من ألبوم "العُلا في الضوء الذهبي"** · 34 لقطة · SAR 799
> [ شراء الألبوم ] [ عرض كل اللقطات ] [ إضافة إلى لوح ]

Plus a horizontal strip of the album's other clips — the "look how much you get" moment.

---

## Search — the hard part

Arabic search is not English search with a different font:

- **Morphology/stemming** — طائرة / طائرات / الطائرة must match
- **Diacritics-insensitive**, **hamza/alef normalising** — احمد ≈ أحمد
- **Transliteration both ways** — "AlUla" ↔ "العلا", "Jeddah" ↔ "جدة"
- **Cross-language** — an Arabic query returns English-tagged clips and vice versa
- Synonym dictionary (admin-maintained)
- **Log zero-result queries** — that report is the content-acquisition roadmap and feeds creator demand signals
- Meilisearch at launch; facets must stay fast at 10k+ clips

## SEO
Location hubs are the highest-value organic surface and the main differentiator vs global libraries. Server-render everything, structured data (`VideoObject`, `Product`, `BreadcrumbList`), Arabic metadata, sitemaps.

---

## Acceptance criteria

- [ ] Every clip surface shows its album + price and routes to the PDP
- [ ] Filters combine correctly and stay fast on 10k+ clips
- [ ] Arabic search handles stemming, diacritics, hamza normalisation, transliteration
- [ ] Zero-result queries logged
- [ ] Clip modal is deep-linkable and SEO-visible
- [ ] Album PDP renders trailer, full clip grid, both licence tiers, specs, clearance
- [ ] Previews are watermarked and muted; masters never reachable from the catalogue
- [ ] Board button works from any clip surface
- [ ] Full Arabic RTL — verify the filter rail, player controls and carousels specifically
- [ ] Lighthouse SEO ≥ 95 on a location hub

---

## Schema requests

Note needed fields here — **do not edit `schema.prisma`.**

---

## Explicitly NOT yours

Cart/checkout (04 — you add to cart, they take payment) · creator upload (03) · admin (06) · landing (02).
