# Brief 02 — Landing Page

**Branch:** `feat/landing` · **Depends on:** Brief 01 (Foundation) merged
**Owns:** `app/[locale]/(public)/page.tsx`, `components/landing/*`, `public/hero/*`

---

## Context

**Laqta (لقطة)** — Arabic-first stock-footage marketplace. Buyers search clips but buy **albums** (one-time purchase, perpetual licence, **no subscription**). Egypt-registered, Saudi/Arab audience.

Read `docs/archive/briefs/00-README-START-HERE.md` first.

**The landing page has one job:** in the first 10 seconds, make a visitor *feel* that this library is deep in premium Saudi footage — then route them to browse albums or leave an email.

---

## The hero: a scroll-scrubbed cinematic

This is the centrepiece and it already exists as a working prototype.

**How it works:** it is **not** 3D or WebGL. It's a pre-rendered video whose playhead is driven by scroll position (`video.currentTime`), the same technique as Apple's product pages. Scroll down = camera flies forward. Stop = camera freezes. Scroll up = flies backward.

**What already exists in this repo — reuse it, don't rebuild:**
- `production/prototypes/landing-scroll/scrub-engine.js` — working vanilla-JS scroll-scrub engine (blob loading, seam crossfades, lazy prefetch, reduced-motion, mobile hardening). Framework-agnostic; port it into React.
- `production/prototypes/landing-scroll/index.html` — working Arabic RTL implementation with all copy
- `production/hero-film/stills/final_stills_4K/` — **12 approved 4K hero stills** in running order
- `production/hero-film/02_FINAL_STORYBOARD.pdf` — the film's running order and transitions

**The film (an overnight arrival):**

```
00 airplane window NIGHT → 01 pushed through → 02 night cloud
→ 03 Riyadh NIGHT → 04 Makkah NIGHT
→ 05 dawn breaks inside the cloud   ★ time shift happens here, hidden in vapour
→ 06 AlUla → 07 Qasr al-Farid → 08 Empty Quarter → 09 Edge of the World → 10 Red Sea
→ 11 airplane window MORNING → logo → CTA
```

Every scene is joined by a **cloud wipe** — the camera flies into vapour until it fills the frame, so there is never a visible cut.

**Status:** the 12 stills are final. The video clips are being generated separately. **Build the page so stills work as a fallback and clips drop in later** — the engine already supports poster stills.

---

## Scope

### Sections, in order
1. **Hero** — the scroll cinematic, with Arabic copy pinned per scene, and a search bar
2. **Trust strip** — clip count, album count, 4K/6K, "مرخّصة للاستخدام التجاري"
3. **Featured albums** — 6–8 cards, video-on-hover, **price visible on the card** (you're a shop, not a subscription)
4. **Browse by location** — visual tiles: الرياض، جدة، العلا، أبها، نيوم، الدرعية، الربع الخالي، البحر الأحمر
5. **Browse by category** — Aerials, Lifestyle, Business, Heritage, Food, Nature, Events, Timelapse
6. **New this week** — recency signals a living library
7. **Top creators** — supply-side social proof
8. **How it works** — 3 steps, and state the positioning explicitly: **لا اشتراكات. تشتري مرة واحدة، وتملكها للأبد.**
9. **Creator CTA** → `/sell`
10. **Email capture** — "notify me at launch"

### Arabic SEO (not an afterthought)
- Arabic `<title>`, meta description, keywords
- Open Graph + Twitter cards with Arabic content
- `hreflang` for ar/en
- JSON-LD: `WebSite` (with `SearchAction`) + `Organization`
- Server-rendered so it's crawlable — organic search is your cheapest acquisition
- `sitemap.xml`, `robots.txt`

### Performance
- Hero must not block first paint — stills first, video lazy
- Target LCP < 2.5s on 4G
- Clips as blobs (the engine handles this; `file://` and non-range hosts break seeking)
- `prefers-reduced-motion` → static stills, no video

---

## Acceptance criteria

- [ ] Scroll drives the cinematic smoothly; scrubbing back works
- [ ] Full RTL: copy right-aligned, route rail on the left, scene counter reads `01 / 12` not reversed
- [ ] Works with stills only (video absent) and upgrades cleanly when clips are added
- [ ] Mobile: no layout break, no scroll-jump when the URL bar hides, safe-area respected
- [ ] All ten sections present with real Arabic copy
- [ ] Album cards show price and link to the album page
- [ ] Lighthouse: SEO ≥ 95, Accessibility ≥ 90
- [ ] `prefers-reduced-motion` respected

---

## Schema requests

You need read-only queries for featured albums, categories, locations and creators. If a field is missing, **note it here — do not edit `schema.prisma`.**

---

## Explicitly NOT yours

Album/clip detail pages and search (05) · checkout (04) · creator studio (03) · admin (06).

You link *to* those routes; you don't build them.
