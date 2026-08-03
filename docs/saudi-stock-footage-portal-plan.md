# Saudi Stock Footage Portal — Website Structure & Platform Plan

**Model:** Album-based one-time purchase (no subscription) + creator marketplace with platform commission.
**Reference:** Artlist.io — *stock footage section only*.
**Date:** 2 August 2026

---

## DECISIONS LOCKED (2 Aug 2026)

| # | Decision | Choice | Build impact |
|---|---|---|---|
| A | Single-clip sales | **Albums only at launch.** Single-clip upsell deferred to Phase 3 at ~40% of album price. | Album is the only SKU in Phase 1. |
| B | Primary buyer | **Both agencies/government AND solo creators, equally weighted.** | Build full enterprise path (PO, Net-30, seats, tax invoice) *and* full self-serve path (mada/Apple Pay/BNPL) in Phase 1. +4–6 wks. Homepage & pricing must speak to both. |
| C | Exclusivity | **Non-exclusive by default + 5pt revenue bonus for exclusive albums.** | Exclusivity flag on Album; commission engine applies −5pt when `is_exclusive`. |
| D | Creator origin | **Open to creators worldwide** (anyone who shot in KSA). | Needs international payout rail (Payoneer/Wise) alongside local IBAN; multi-jurisdiction WHT; **tighter permit verification** — foreign shooters likelier to have filmed without a Saudi permit. Makes the principal VAT model effectively mandatory (see E). |
| E | VAT / invoicing | **Marketplace commission economics + PRINCIPAL-of-record for VAT/invoicing.** Confirm with Saudi tax advisor. | Commission split unchanged (you keep %, creator gets rest). You issue ONE 15% VAT invoice to the buyer regardless of creator country; creators invoice you via self-billing. This is the only structure that gives worldwide creators + Saudi B2B buyers a reclaimable VAT invoice. |
| F | Launch inventory | **3–5 albums × ~50 clips (~150–250 clips)** — your own + first creators' work. | Leaner than the 30–50 rec. **Constraint: concentrate in 1–2 locations/themes done deeply**, not spread thin, or search returns too many near-empty results. |
| G | Refund policy | **No refund after download.** 7-day window only if undownloaded; discretionary refunds for technical defects. | Disclose at checkout (E-Commerce Law). Standard digital-goods protection. |
| H | Hosting region | **Deferred to privacy advisor.** Architecture stays cloud-agnostic (S3-compatible storage, containerised) so region is chosen late without rework. | No lock-in to a specific cloud in Phase 0/1 design. |

> **Note on E (principal vs agent):** "I take a commission, the rest goes to the creator" is the *economic* model and is identical under both principal and agent structures. Principal vs agent only decides who invoices the buyer and how VAT flows. Principal chosen because agent-model invoicing would leave Saudi B2B buyers unable to reclaim VAT when the creator is a non-registered foreign seller. Final structure pending tax-advisor sign-off before checkout is built.

> **Note on F (marketplace sides):** Two distinct populations — **Creators/sellers** (list & sell albums, get a revenue share) and **Buyers/audience** (purchase & download). The plan treats these as separate account types (`/studio/*` vs `/account/*`) throughout. At launch, "your own + first creators' work" seeds the *seller* side so the *buyer* side has something to shop.

---

## 0. The core structural problem (read this first)

Artlist is a **subscription**. Because the buyer already paid, Artlist's IA can be a flat, infinite scroll of individual clips — every clip is "free" once you're in, so the clip is the unit of browsing *and* the unit of consumption.

Your model breaks that symmetry:

| | Artlist | You |
|---|---|---|
| Unit of browsing | Clip | **Clip** (buyers search "drone Riyadh sunset", never "Album #47") |
| Unit of purchase | Subscription | **Album** |
| Unit of delivery | Clip | Album (or clip-within-owned-album) |

**Everything in this document flows from one rule: search and discovery happen at the clip level; the transaction happens at the album level.** Every clip page, every search result, every category grid must answer "this clip lives in *Album X* — SAR 799 — 34 clips" and route the buyer to the album PDP.

If you build a pure album-catalogue (browse albums like products on Amazon), your conversion will collapse — nobody shops for footage that way. If you build a pure clip-catalogue with no album framing, buyers get angry when they can't buy the one clip they want.

### The three fork decisions

Decide these before wireframes; each changes the build materially.

**Fork A — Can a single clip be bought on its own?**
- **Recommended: No at launch.** Album-only is your differentiator and it protects album ARPU. Instead offer a **"Just this clip" upsell at a deliberately unattractive ratio** (e.g. single clip = 40% of album price) in Phase 2 — it converts the "I only need one shot" segment without cannibalising albums.
- If yes from day one: your data model must treat clip-level SKUs as first-class, and creators need per-clip pricing. Heavier build.

**Fork B — Who is the primary buyer?**
- **Agencies / production houses / gov & semi-gov comms teams** (Riyadh Season, Ministry campaigns, NEOM/AlUla marketing, banks, telcos). High ticket, needs invoices, VAT numbers, PO numbers, team seats, broadcast licences.
- **Solo creators / small studios / social media agencies.** Lower ticket, needs card checkout, Tabby/Tamara instalments.
- **Recommended: build for both but make the agency path the revenue engine** — that's where the money is in KSA, and it's why one-time album purchase actually beats subscription here (procurement departments buy assets, not subscriptions).

**Fork C — Exclusive or non-exclusive creator content?**
- **Recommended: non-exclusive by default, with a higher commission rate for exclusive albums** (see §9). Exclusivity is your only defence against creators listing the same Saudi footage on Shutterstock/Artgrid.

---

## 1. Product model & vocabulary

Lock this vocabulary now — it goes in the DB, the URLs, the UI copy, and the legal docs, in both languages.

| Entity | Arabic | Definition |
|---|---|---|
| **Clip** | لقطة | One video file + its metadata + preview. Never sold alone (Phase 1). |
| **Album** | ألبوم | The SKU. A coherent, themed set of clips from one creator. One-time purchase, perpetual licence. |
| **Collection** | مجموعة | *Platform-curated* grouping of albums (merchandising only, not a SKU). e.g. "Riyadh Season 2026". |
| **Category** | تصنيف | Taxonomy node. e.g. Aerials → Coastal. |
| **Creator** | صانع محتوى | Seller. Owns albums, gets paid a revenue share. |
| **Licence** | ترخيص | The rights grant attached to a purchase. Standard / Extended. |
| **Board** | لوح | Buyer's saved-clips workspace (pre-purchase shortlisting, shareable with clients). |

### Album design rules (enforce these in the review queue)

An album is not a dumping ground. Quality of the *album concept* is your moat. Require:

- **Minimum 8 clips**, recommended 15–40, hard cap ~120.
- **Single coherent theme** — a location, a subject, an event, a mood, a look. "AlUla — Golden Hour Aerials" ✅. "My best shots 2025" ❌.
- **Consistent technical spec** — same or compatible resolution / frame rate / colour profile. Buyers cut albums together in one timeline; mixed 24p and 60p LOG and Rec.709 in one album is a returns magnet.
- **Consistent grade/look** — an album should cut together without regrading.
- **Cover clip + 3–6 hero stills** chosen by the creator.

This is the single biggest lever on your refund rate and repeat purchase rate.

### Album size tiers → price bands (illustrative, SAR)

| Tier | Clips | Standard licence | Extended licence |
|---|---|---|---|
| Mini | 8–14 | 299 | 897 |
| Standard | 15–34 | 799 | 2,397 |
| Pro | 35–69 | 1,799 | 5,397 |
| Signature | 70+ | 3,499 | 10,497 |

Give creators a **price band per tier** (e.g. Standard tier = 599–1,199 SAR) rather than free pricing — prevents race-to-the-bottom and keeps your merchandising coherent. All prices **VAT-exclusive, displayed inclusive** for B2C and toggleable for B2B.

**Extended = 3× Standard** is a clean, defensible multiplier.

---

## 2. Licensing structure

This is a legal deliverable, not a design one — get a Saudi IP lawyer to draft it — but the *structure* must exist in the product from day one because it's a price axis and a data field.

### Standard Licence (الترخيص القياسي)
- Perpetual, worldwide, non-exclusive, non-transferable.
- Unlimited digital distribution: social, web, online ads, internal corporate, film festivals, client work.
- Distribution cap: e.g. up to 1,000,000 views/impressions per project, or unlimited for organic social.
- Excludes: broadcast TV, OOH/DOOH billboard, cinema/theatrical, resale, templates, NFTs, AI training.
- Buyer = one legal entity. Team seats share the licence within the entity.

### Extended Licence (الترخيص الموسّع)
- Everything above, plus broadcast, OOH, cinema, unlimited distribution.
- Still excludes: resale as stock, use in a competing stock library, AI model training.

### Universal prohibitions (in both tiers)
- No use suggesting endorsement by depicted people, brands, or entities.
- No defamatory, pornographic, or unlawful use.
- No use that violates Saudi law or public decency regulations.
- **No AI/ML training on the footage** — state this explicitly; it's a live commercial issue and Saudi buyers increasingly ask.

### Product implications
- Every order stores an immutable snapshot of the licence text version purchased.
- Every purchase generates a downloadable **Licence Certificate PDF** (bilingual) with: order ID, album, clip manifest with individual clip IDs, buyer legal entity, licence tier, date, creator name. Agencies and broadcasters *require* this for compliance and it's a trust signal.
- Licence tier is chosen **at checkout**, per album, and is upgradeable later (pay the difference).

### Releases & permits — the Saudi-specific landmine
This will get you sued or delisted if you ignore it. Build it into the upload flow as a **hard gate**:

- **Model release** required for any identifiable person. Bilingual template provided by you.
- **Property release** for identifiable private property, interiors, artworks.
- **Filming permit** — Saudi requires permits for commercial filming. Certain sites have their own authorities and strict rules: **Royal Commission for AlUla (RCU)**, **Diriyah Gate Development Authority**, **NEOM**, **Red Sea Global**, the two Holy Mosques (extremely restricted), airports, military and government facilities, and Saudi Film Commission / GCAM general permits.
- Upload form asks: *Was this filmed under permit? Upload permit reference.* Store it. Surface a **"Cleared for commercial use ✅"** badge on albums with full documentation — and make that badge a filterable facet. Agencies will filter on it exclusively.
- Flag **editorial-use-only** content as a separate album type that cannot be sold under Extended licence.

---

## 3. Sitemap

Bilingual, locale-prefixed. Arabic is the **default** locale, English fully supported.

```
/ar/...   (RTL, default)
/en/...   (LTR)
```

### 3.1 Public / marketing
```
/                               Home
/albums                         Album catalogue (grid, filterable)  ← the "shop"
/albums/[creator]/[album-slug]  ALBUM PDP  ★ primary conversion page
/footage                        Clip explorer (infinite grid)  ← the "search"
/footage/[clip-slug]-[id]       Clip detail (modal + deep-linkable page)
/search?q=                      Unified search results (clips ▸ albums ▸ creators tabs)
/categories                     Taxonomy index
/categories/[slug]              Category hub (e.g. /categories/aerials)
/categories/[slug]/[child]      Sub-category
/collections                    Curated collections index
/collections/[slug]             Curated collection (e.g. riyadh-season-2026)
/locations                      KSA location index  ★ high-SEO, high-differentiation
/locations/[slug]               e.g. /locations/alula, /locations/jeddah-corniche
/creators                       Creator directory
/creators/[handle]              Creator storefront (albums, bio, showreel, stats)
/pricing                        Price tiers + licence comparison
/licensing                      Licence explainer (plain-language + full legal)
/sell                           "Sell your footage" — creator recruitment landing  ★
/sell/apply                     Creator application form
/enterprise                     Agency / gov / broadcast plan  ★ (lead-gen, not checkout)
/blog                           Editorial / SEO
/blog/[slug]
/inspiration                    Case studies, "made with" showcase
/help                           Help centre
/help/[article]
/about  /contact
```

### 3.2 Legal
```
/legal/terms
/legal/licence-agreement        Standard + Extended, full text, versioned
/legal/creator-agreement        Seller terms, commission, payout, exclusivity
/legal/privacy                  PDPL-compliant
/legal/refund-policy
/legal/content-policy           What can/can't be uploaded (incl. cultural standards)
/legal/dmca                     Takedown / IP complaint procedure
```

### 3.3 Buyer account
```
/account                        Overview
/account/purchases              Order history
/account/purchases/[order-id]   Order detail + invoice + licence cert
/account/library                ★ Owned albums — the post-purchase home
/account/library/[album-id]     Owned album: clip list, per-clip & bulk download
/account/downloads              Download history + re-download (unlimited, forever)
/account/boards                 Saved boards
/account/boards/[id]            Board detail (shareable link for client approval)
/account/invoices               ZATCA-compliant tax invoices (PDF + XML)
/account/licences               All licence certificates
/account/team                   Team seats (business accounts)
/account/settings               Profile, language, password, 2FA
/account/billing                Saved payment methods, billing entity, VAT number
```

### 3.4 Creator Studio
```
/studio                         Dashboard: sales, views, conversion, payout balance
/studio/albums                  My albums (draft / in review / live / rejected / paused)
/studio/albums/new              Album creation wizard
/studio/albums/[id]/edit        Album editor
/studio/albums/[id]/clips       Clip manager (reorder, metadata, remove)
/studio/upload                  Bulk uploader (resumable, multi-GB)
/studio/releases                Model/property releases & permits vault
/studio/earnings                Earnings by album / period, commission breakdown
/studio/payouts                 Payout requests, history, bank/IBAN details
/studio/analytics               Views, add-to-board, conversion, search terms that found you  ★
/studio/profile                 Public storefront settings, showreel, bio, avatar
/studio/tax                     Tax status, VAT registration number, withholding
/studio/messages                Support / review feedback thread
```

### 3.5 Admin (internal, separate app or gated route)
```
/admin/queue                    ★ Content review queue — the operational heart
/admin/queue/[album-id]         Album review: play clips, check metadata, releases, cultural QC
/admin/catalogue                All albums/clips, bulk edit, feature/unfeature
/admin/taxonomy                 Categories, tags, synonyms, Arabic↔English term mapping
/admin/creators                 Applications, approvals, tiers, commission overrides
/admin/orders                   Orders, refunds, chargebacks, manual invoices
/admin/payouts                  Payout runs, approvals, bank file export
/admin/merchandising            Homepage, collections, featured albums, banners
/admin/pricing                  Price bands, promo codes, bundles
/admin/disputes                 DMCA/IP claims, takedowns
/admin/reports                  GMV, take rate, refund rate, cohort, creator leaderboard
/admin/users                    Buyer accounts, support impersonation (audited)
/admin/cms                      Blog, help centre, landing pages
```

---

## 4. Page anatomy — the pages that decide whether this works

### 4.1 Home `/`
The job: prove the library is *deep in Saudi content* within 3 seconds, then route to search.

1. **Hero** — full-bleed autoplaying muted showreel of KSA footage. Overlaid: single search bar (Arabic placeholder: "ابحث عن لقطات… الرياض، العلا، طائرة بدون طيار"). No signup wall.
2. **Trust strip** — "12,400 clips · 380 albums · 4K & 6K · مرخّصة للاستخدام التجاري · Cleared for commercial use".
3. **Featured albums** — 6–8 large cards, video-on-hover, price visible. *Price must be visible on the card* — you're a shop, not a subscription.
4. **Browse by location** — visual tiles: الرياض, جدة, العلا, أبها, نيوم, الدرعية, الربع الخالي, البحر الأحمر. This is your differentiator vs. global libraries and your strongest SEO surface.
5. **Browse by category** — Aerials, Lifestyle, Business, Heritage, Food, Nature, Events, Timelapse.
6. **New this week** — recency signals a living library.
7. **Top creators** — social proof for the supply side.
8. **How it works** — 3 steps: Search → Buy the album → Download forever. Explicitly contrast with subscription: *"لا اشتراكات. تشتري مرة واحدة، وتملكها للأبد."* ("No subscriptions. Buy once, own it forever.") — this is your positioning, put it above the fold-ish.
9. **For creators** CTA → `/sell`.

### 4.2 Clip explorer `/footage` — the discovery engine
Masonry/grid of clip cards. This is where users actually spend time.

- **Card:** looping muted preview on hover, duration, resolution badge, and — critically — a persistent **album ribbon**: `من ألبوم: AlUla Golden Hour · SAR 799`. Clicking the ribbon → album PDP. Clicking the card → clip detail.
- **Filters (left rail on desktop, sheet on mobile):**
  - Resolution: HD / 4K / 6K / 8K
  - Frame rate: 24 / 25 / 30 / 50 / 60 / 120+ (slow-mo)
  - Aspect: 16:9 / 9:16 / 1:1 / 2.39:1 — **9:16 vertical is a top filter in this market**, don't bury it
  - Colour profile: LOG / Rec.709 / RAW
  - Camera movement: Drone / Gimbal / Handheld / Static / Slider / Crane
  - Shot size: Wide / Medium / Close-up / Macro / Aerial
  - Location (KSA region + city + landmark)
  - People: with people / no people / identifiable faces
  - Time of day, season, mood
  - **Cleared for commercial use** ✅ (release + permit complete)
  - Editorial use only
  - Album price range
  - Creator
- **Sort:** Relevance / Newest / Best selling / Price.
- **Board button** on every card (heart/+) — pre-purchase shortlisting is how agencies work: they build a board, share it with the client, then buy the albums the client picked. Make board sharing frictionless and unauthenticated-viewable.

### 4.3 Clip detail `/footage/[slug]-[id]`
Opens as a modal over the grid (with a real URL for sharing/SEO).

- Large watermarked player, scrubbable, HLS adaptive.
- Full technical metadata table.
- Location with a small map pin.
- Release/permit status badges.
- **The conversion block — the most important component on the site:**
  > **This clip is part of the album "AlUla — Golden Hour Aerials"**
  > 34 clips · 4K · 24fps · by @ahmed_films
  > **SAR 799** — one-time, yours forever
  > [ **Buy album** ]  [ View all 34 clips ]  [ Add to board ]
- Horizontal strip of the other clips in the same album (browsable in-modal) — this is the "look how much you get" moment.
- "Similar clips" below (from *other* albums — drives cross-album discovery).

### 4.4 Album PDP `/albums/[creator]/[album-slug]` ★
Your checkout funnel. Treat it like an e-commerce product page.

- **Above the fold:** album trailer (auto-cut montage of the album — generate this automatically at ingest, it dramatically lifts conversion), title (ar/en), creator byline + avatar → storefront, clip count, total runtime, format badges, rating/sales count.
- **Price block, sticky on scroll:**
  - Licence tier selector: Standard SAR 799 / Extended SAR 2,397 — with a compact comparison table and a "which do I need?" helper.
  - `[ إضافة إلى السلة ]` / `[ اشترِ الآن ]`
  - Reassurance line: تحميل فوري · وصول دائم · فاتورة ضريبية · دعم بالعربية
  - Tabby/Tamara instalment line for higher tiers.
- **Clip grid** — every clip in the album, hover-preview, click to expand. Full transparency; buyers must see exactly what they're getting.
- **Technical specs table** — resolution, codec, bitrate, colour space, camera/lens used, total download size (state it — 40 GB matters to the buyer).
- **Licence summary** — plain-language ✅/❌ list, link to full text.
- **Clearance & permits** — releases on file, permit authority.
- **About the creator** — mini-profile + their other albums.
- **Related albums** — same location, same category, "frequently bought together".
- **FAQ + reviews** (verified purchasers only).

### 4.5 Cart & checkout
Keep it 2 steps. Albums are digital — no shipping, no address (but you *do* need billing entity for VAT).

1. **Cart** — line items with licence tier editable inline, promo code, VAT line, total.
2. **Checkout** —
   - Account: guest checkout allowed, account auto-created on purchase (reduce friction; they need an account to re-download anyway).
   - **Billing entity toggle: فرد (Individual) / منشأة (Business)** → Business reveals company name, CR number, **VAT registration number**, optional PO number. This is mandatory for a compliant tax invoice.
   - Payment: **mada**, Apple Pay, Visa/Mastercard, STC Pay, Tabby/Tamara (BNPL), and **bank transfer / invoice (Net 30)** for enterprise & government buyers — gov procurement often cannot pay by card.
   - Order review → Pay.
3. **Confirmation** — instant download start, licence certificate, tax invoice, "your library" link.

### 4.6 Owned album `/account/library/[album-id]`
- Download all (ZIP, chunked) or per-clip.
- Proxy/preview versions for offline editing (H.264 1080p) alongside the masters — editors love this.
- Re-download unlimited, forever. State it loudly; it's a core promise of the one-time model.
- Licence certificate, invoice, tier upgrade CTA.

### 4.7 Creator storefront `/creators/[handle]`
- Showreel hero, bio (ar/en), based-in location, gear list, verified badge.
- Album grid with prices.
- Stats: albums, total clips, sales, member since, avg. rating.
- Follow button + "notify me on new albums".
- Custom order / hire-me enquiry → your commission on bespoke shoots is a legitimate Phase 3 revenue line.

---

## 5. Taxonomy — Saudi-specific, bilingual

Global stock taxonomies won't serve this market. Build your own with a bilingual synonym layer.

**Locations (primary axis)**
Riyadh · Jeddah · Makkah · Madinah · Dammam/Khobar/Dhahran · AlUla · Abha & Asir · Taif · Tabuk · NEOM · The Red Sea · Diriyah · Al-Ahsa · Jazan · Hail · Najran · Farasan Islands · Rub' al Khali · Edge of the World

**Subjects**
Aerials/Drone · Cityscapes & Skylines · Heritage & Architecture · Desert & Nature · Coast & Marine · People & Lifestyle · Business & Corporate · Industry & Energy · Construction & Megaprojects · Food & Coffee · Sports & Motorsport · Events & Festivals · Traditional Culture (Ardah, falconry, camels, souqs) · Religious & Spiritual (handle with strict policy) · Education & Healthcare · Technology · Transport & Infrastructure

**Seasonal / event** (recurring merchandising goldmine)
Ramadan · Eid · National Day (23 Sep) · Founding Day (22 Feb) · Riyadh Season · Hajj & Umrah · Winter at Tantora · Formula 1 · Soudah Season

**Technical** — resolution, fps, aspect, colour profile, camera movement, shot size, lighting, time of day.

**Vision 2030 themes** — Giga-projects, Quality of Life, Tourism, Entertainment, Green Initiative, Women in the Workforce, Youth. Government and agency buyers literally brief in these terms; tag for it.

### Search requirements (don't underestimate this)
- Arabic morphology & stemming (تعامل مع "طائرة", "طائرات", "الطائرة").
- **Diacritics-insensitive** and **hamza/alef-normalising** (احمد ≈ أحمد).
- **Transliteration mapping** both directions: "AlUla" ↔ "العلا", "Jeddah" ↔ "جدة", "Riyadh" ↔ "الرياض".
- Cross-language: an Arabic query must return English-tagged clips and vice versa. Store metadata in both languages; auto-translate on ingest, human-verify in review.
- Synonym dictionary maintained in `/admin/taxonomy`.
- **Log zero-result queries** — that report is your content acquisition roadmap.
- Phase 2: semantic/vector search + CLIP-style visual embeddings for "more like this".

---

## 6. Data model (core entities)

```
User
  id, email, phone, name, locale, role[buyer|creator|admin], status,
  billing_entity{type, legal_name, cr_number, vat_number, address}, 2fa

Creator (1:1 with User where role=creator)
  handle, display_name_ar/en, bio_ar/en, showreel_url, location,
  status[pending|approved|suspended], commission_rate, exclusivity_flag,
  payout_method{iban, bank_name, beneficiary}, tax_status, lifetime_gmv, tier

Album
  id, creator_id, slug, title_ar/en, description_ar/en,
  status[draft|in_review|changes_requested|live|paused|delisted],
  tier[mini|standard|pro|signature], price_standard, price_extended, currency,
  cover_clip_id, trailer_url, clip_count, total_runtime, total_size_bytes,
  category_ids[], location_ids[], tag_ids[], theme_ids[],
  clearance_status[full|editorial_only|pending], is_exclusive,
  published_at, sales_count, rating_avg, licence_version_id

Clip
  id, album_id, order_index, slug, title_ar/en, description_ar/en,
  duration, width, height, fps, codec, bitrate, colour_profile, aspect_ratio,
  camera, lens, has_people, identifiable_faces, camera_movement, shot_size,
  time_of_day, season, location_id, geo{lat,lng}, tag_ids[],
  master_key(S3), proxy_key, preview_hls_key, thumbnail_keys[], sprite_key,
  checksum, ingest_status, embedding_vector

Release
  id, creator_id, type[model|property|permit], file_key, subject_name,
  authority (for permits), reference_number, valid_from, valid_to,
  linked_clip_ids[], verified_by_admin_id, verified_at

Category / Location / Tag / Theme
  id, parent_id, slug, name_ar/en, synonyms_ar[], synonyms_en[], hero_image, seo_meta

Collection (curated)
  id, slug, title_ar/en, description, album_ids[], hero_media, is_featured, sort_order

Board
  id, user_id, name, is_public, share_token, clip_ids[], collaborator_ids[]

Cart / CartItem
  album_id, licence_tier, unit_price, vat_amount

Order
  id, user_id, order_number, status[pending|paid|failed|refunded|partially_refunded],
  subtotal, vat_rate, vat_amount, total, currency, payment_method, gateway_ref,
  billing_entity_snapshot, po_number, invoice_id, created_at

OrderItem
  order_id, album_id, creator_id, licence_tier, licence_version_id,
  gross_amount, vat_amount, commission_rate, commission_amount, creator_net_amount,
  clip_manifest_snapshot[]   ← immutable; album may change later, entitlement must not

Entitlement
  user_id, album_id, licence_tier, order_item_id, granted_at, revoked_at,
  clip_ids_snapshot[]        ← what they actually own

Download
  entitlement_id, clip_id|album_zip, user_id, ip, ua, bytes, created_at

LicenceCertificate
  order_item_id, pdf_key, certificate_number, issued_at

Invoice  (ZATCA)
  order_id, invoice_number, uuid, previous_hash, qr_code, xml_key, pdf_key,
  zatca_status[reported|cleared|failed], zatca_response

CreatorLedger
  creator_id, entry_type[sale|refund|adjustment|payout|withholding],
  amount, order_item_id, balance_after, available_at (sale + hold period)

Payout
  creator_id, amount, currency, status[requested|approved|processing|paid|failed],
  method, reference, period_start, period_end, ledger_entry_ids[], invoice_key

ReviewTask
  album_id, reviewer_id, status, checklist{technical, metadata, releases,
  cultural, quality, duplicate}, notes, decided_at
```

**Two non-negotiables:**
1. **`clip_manifest_snapshot` on OrderItem.** If a creator later removes or replaces a clip, the buyer's entitlement must be unchanged. Never compute entitlement from the live album.
2. **`licence_version_id` on OrderItem.** You will revise licence terms; purchases are governed by the text in force at purchase time.

---

## 7. Media pipeline

```
Creator uploads (resumable, multipart, direct-to-S3 pre-signed)
        ↓
Ingest queue  ─→ virus scan, checksum, duplicate detection (perceptual hash)
        ↓
FFmpeg probe  ─→ extract technical metadata automatically (don't make creators type it)
        ↓
Transcode fan-out:
   • Preview:   HLS ladder 360/720p, H.264, MUTED, hard watermark + moving overlay
   • Proxy:     1080p H.264 (delivered to buyer as editing proxy)
   • Thumbs:    poster frame + 10-frame hover sprite + animated WebP
   • Master:    untouched original → cold/IA storage, never publicly addressable
        ↓
AI assist (Phase 2): auto-tagging, scene/shot classification, auto-translate ar↔en,
                     face detection → flags "needs model release", embeddings
        ↓
Album trailer auto-cut (2s from each of the best 8–12 clips + music bed)
        ↓
Admin review queue
        ↓
Publish → index in search → CDN warm
```

**Delivery & anti-piracy**
- Masters served only via **short-lived signed URLs** (5–15 min), issued only against a valid entitlement.
- Rate limit downloads; log every download with IP/UA; alert on anomalies (e.g. 40 GB from 6 IPs in an hour).
- **Forensic watermarking** on masters (invisible, per-buyer) for Extended/high-value albums — Phase 3, but design the hook now.
- Previews are always watermarked, muted, and max 720p.
- Storage tiering: previews/proxies on hot storage + CDN; masters on infrequent-access. This is where your cloud bill lives — model it early. A 4K 10-second clip is ~1–4 GB; 12,000 clips is comfortably 20–40 TB.

---

## 8. Creator flow

```
/sell landing → Apply → Portfolio review (showreel + 5 sample clips + KSA content proof)
   → Approved → Agreement e-signed → Studio access
   → Create album (wizard):
        1. Concept: title ar/en, description, category, location, theme
        2. Upload clips (bulk, resumable) — auto-metadata extracted
        3. Per-clip metadata review + tag suggestions to accept/edit
        4. Releases & permits: attach or declare not-required (HARD GATE)
        5. Cover + trailer selection
        6. Tier auto-assigned by clip count → price chosen within band
        7. Submit for review
   → Admin review (SLA: 3 business days) → Approved / Changes requested / Rejected
   → Live → sales → ledger accrues → 30-day hold → available → payout request
```

**Review checklist (admin):** technical consistency · duplicate/reupload detection · metadata accuracy in both languages · release & permit completeness · album coherence · quality bar · **cultural & regulatory appropriateness** · no third-party logos/IP · no restricted sites without permit.

**Creator analytics that actually retain creators:** which search terms surfaced your clips, board-add rate, PDP view→purchase conversion, revenue by album, and — most valuable — *"buyers searched for X in your locations and found nothing"* demand signals.

---

## 9. Commission & payouts

| Creator tier | Condition | Platform take | Creator keeps |
|---|---|---|---|
| Standard | Default | 35% | 65% |
| Silver | SAR 50k lifetime sales | 30% | 70% |
| Gold | SAR 200k lifetime | 25% | 75% |
| **Exclusive bonus** | Album exclusive to your platform | **−5 pts** | +5 pts |

Rationale: a 30–35% take is the marketplace norm and is defensible; the exclusivity discount is the lever that actually builds a moat. Publish the rates openly — opacity kills creator acquisition.

**Payout mechanics**
- Commission is calculated and frozen **per OrderItem at purchase time** (never recompute from current rates).
- **30-day hold** after purchase before funds become available (covers refund window and chargebacks).
- Minimum payout SAR 500. Monthly payout run, or on-demand once available.
- Payout via local bank transfer (IBAN) for KSA creators; international creators need a separate rail (Payoneer/Wise) — decide whether you accept non-Saudi creators at all in Phase 1 (recommend: yes for GCC, it deepens the catalogue fast).
- **Creator self-billing invoice** auto-generated per payout.
- Withholding tax on non-resident creators — get tax advice; there is a real WHT exposure on payments to non-residents.

---

## 10. Saudi compliance & payments

**This section needs a local lawyer and a tax advisor. Treat the below as the checklist to take to them, not as advice.**

- **VAT 15%** on sales. **ZATCA Fatoora e-invoicing** — you must issue compliant e-invoices with UUID, cryptographic stamp, QR code, hash chain, and integrate with ZATCA's clearance/reporting API. Budget real engineering time; use a certified provider rather than building from scratch.
- **Marketplace VAT treatment** — whether you're the principal (you sell, creator supplies you) or the agent (creator sells, you take a commission) changes everything about invoicing. **Recommendation: structure as principal** (you buy the licence right and resell) — it dramatically simplifies VAT, invoicing, and buyer experience, and lets you issue a single clean tax invoice. Confirm with your advisor.
- **Commercial registration (CR)** with the Ministry of Commerce; e-commerce activity registration; **Saudi Business Center**; **Maroof** registration (required for e-commerce trust and mandated by the E-Commerce Law).
- **E-Commerce Law** requirements: clear pricing in SAR incl. VAT, refund policy disclosure, Arabic-language terms, identity disclosure, order confirmation.
- **PDPL (Personal Data Protection Law)** — lawful basis, privacy notice in Arabic, data subject rights, breach notification, and **data residency**: personal data of Saudi individuals should be hosted in KSA unless conditions are met. Practical answer: host in-Kingdom or in a region with an appropriate arrangement. Options: **Google Cloud Dammam**, **Oracle Jeddah/Riyadh**, **AWS Middle East (Bahrain) me-south-1** or the AWS KSA region, or local providers (STC Cloud, Mobily, Sahara/Alibaba).
- **Content standards** — GCAM/GAMR media content regulations. Your `/legal/content-policy` and review checklist must reflect Saudi decency and content norms. This is not optional and it's a legitimate reason buyers will prefer you over Shutterstock: *pre-vetted, culturally appropriate, permit-cleared*.
- **Payments** — a licensed local gateway: **Moyasar**, **PayTabs**, **HyperPay**, **Tap Payments**, or **Checkout.com**. Must support **mada** (dominant debit network — you cannot launch without it), **Apple Pay** (very high share in KSA), **STC Pay**, and **Tabby/Tamara** BNPL. Add **bank transfer + Net-30 invoicing** for government/enterprise.
- **Accessibility & language** — Arabic-first, full RTL (not a mirrored afterthought — test the video player, sliders, and filter rails specifically), Hijri date display option, SAR currency symbol (﷼).

---

## 11. Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js (App Router) + TypeScript + Tailwind** | SSR/ISR for SEO (critical — organic search is your cheapest acquisition), built-in i18n routing, RTL via logical CSS properties |
| UI | shadcn/ui + Radix | RTL-friendly, fast to build |
| Video player | HLS.js / Mux Player / Vidstack | Adaptive preview streaming |
| Backend | **Node/NestJS** or **Laravel** | Laravel if your team is PHP-native and you want speed; NestJS for one-language stack |
| DB | **PostgreSQL** | Relational integrity for orders/entitlements/ledger |
| Search | **Meilisearch** (launch) → **Elasticsearch/OpenSearch** or **Typesense** at scale | Meilisearch has good Arabic support and ships in days; migrate when facets get heavy |
| Cache/queue | Redis + BullMQ | Transcode queue, rate limiting |
| Object storage | S3-compatible in-Kingdom, tiered | Masters cold, previews hot |
| Transcoding | FFmpeg workers on autoscaling containers, or **Mux/Bitmovin** | Buy vs build — buy at launch, build when volume justifies |
| CDN | CloudFront / Cloudflare / Akamai with MENA edge | Preview playback latency is a conversion factor |
| Payments | Moyasar or HyperPay + Tabby/Tamara SDKs | mada + Apple Pay coverage |
| E-invoicing | Certified ZATCA provider (e.g. Wafeq, Qoyod, ClearTax, Fatoorah SaaS) | Do not build this |
| Auth | NextAuth / Clerk / custom | Phone-OTP login is expected in KSA — support it |
| Email/SMS | Resend/SES + Unifonic (local SMS, good Arabic delivery) | |
| Analytics | PostHog or GA4 + custom events | Track: search→clip→album→cart→purchase |
| Infra | Docker + one of the in-Kingdom clouds | PDPL residency |

---

## 12. Phased roadmap

**Phase 0 — Foundations (weeks 1–4)**
Company setup, CR, Maroof, VAT registration, gateway merchant account, legal drafting (licence, creator agreement, privacy, content policy), brand & design system, taxonomy definition, cloud region decision.

**Phase 1 — MVP marketplace (weeks 5–16)**
Your own footage only (seed the catalogue with 30–50 albums before opening to creators — **never launch an empty marketplace**).
- Home, clip explorer + search + filters, clip detail, album PDP, cart, checkout (mada/Apple Pay/card), account library + downloads, licence certificate, ZATCA invoice, category/location hubs, legal pages, bilingual RTL.
- Admin: catalogue, orders, merchandising.
- Media pipeline: upload → transcode → preview → deliver.

**Phase 2 — Open the marketplace (weeks 17–28)**
Creator application, Studio, bulk uploader, releases vault, review queue, earnings/ledger/payouts, creator storefronts, creator analytics, boards + sharing, reviews.

**Phase 3 — Scale & monetise deeper (months 8–14)**
Enterprise/gov accounts (team seats, PO, Net-30, custom licensing), bundles & multi-album discounts, credit packs, "just this clip" single-clip upsell, AI auto-tagging & semantic search, forensic watermarking, affiliate programme, API for agency DAM integration, custom shoot commissioning marketplace.

---

## 13. Metrics to instrument from day one

Supply: albums live, clips live, clips per KSA location (find the holes), creator activation rate, review SLA.
Demand: search sessions, **zero-result query rate** (your #1 content-gap signal), clip→album PDP CTR, PDP→cart, cart→purchase, board creation rate.
Money: GMV, take rate, AOV, refund rate, Extended-licence attach rate, repeat purchase rate at 90 days, revenue per clip-view.

---

## 14. Open questions to resolve next

1. **Fork A** — single-clip purchase at launch, or album-only? (Recommend album-only.)
2. **Fork B** — is the agency/government buyer the primary target? (Recommend yes — it changes checkout, licensing, and sales motion.)
3. **Fork C** — exclusivity policy and rate. (Recommend non-exclusive default + 5pt exclusivity bonus.)
4. Do you accept **non-Saudi creators** shooting KSA content? (Recommend GCC yes — catalogue depth fast; adds WHT and payout-rail complexity.)
5. Do you own launch inventory, and how much? (You need 30–50 albums minimum before opening the doors.)
6. **Principal vs agent** VAT structure — needs your tax advisor's sign-off before checkout is built, because it determines invoice architecture.
7. Refund policy for digital goods — recommend: no refunds after download, 7-day refund window if undownloaded, plus discretionary refunds for technical defects. Must be disclosed per E-Commerce Law.
