# How to Build the Portal — Step-by-Step (Bullet Form)

> **Superseded — historical plan, do not work from it.** The live task list is
> [`checklists/`](../../checklists/README.md) (from 2026-09-26), and current
> state is in [`HANDOFF.md`](../../HANDOFF.md). What changed since this was
> written (checked 2026-09-26):
>
> - The company is registered in **Egypt**, not Saudi Arabia — no Saudi CR,
>   Maroof or ZATCA registration is planned; tax questions go to the accountant
>   (BIZ-03).
> - Payments are **Paymob** (card + Apple Pay) plus bank transfer — not
>   Moyasar / HyperPay / PayTabs / Tap. mada is not wired.
> - Prices, orders and payouts are in **USD**, not SAR; minimum payout is
>   USD 100.
> - Search runs on **Postgres**, not Meilisearch.
> - The site is **Arabic + English** (`/en`).
> - Albums only, 30–70 clips; no bundles, packs or credit packs at launch.
> - Sign-in is **email only** at launch; phone sign-in waits for SMS.
> - No refund copy anywhere public (2026-09-23), so "no refund after download"
>   is not stated on the site.

Companion to `saudi-stock-footage-portal-plan.md`. This is the *sequence of doing*, start to launch to scale.
Creators Phase 1: **mainly Egypt**, then Saudi + other Arab. Buyers: Saudi (agencies/gov + solo).
Scope assumption: **Saudi-core catalogue, Arab-expandable**.

---

## STAGE 0 — Decide & Set Up the Business (Weeks 1–4)

### 0.1 Lock the business decisions
- [x] Album-only SKU at launch
- [x] Both agency/gov and solo buyers
- [x] Non-exclusive + 5pt exclusivity bonus
- [x] Creators worldwide, **Egypt-first**
- [x] Principal-of-record for VAT/invoicing
- [x] 3–5 seed albums × ~50 clips
- [x] No refund after download
- [ ] Confirm: Egyptian creators sell Saudi-only, or Arab content too? → sets taxonomy scope

### 0.2 Company & legal formation (do in parallel with everything)
- [ ] Register the Saudi entity (Commercial Registration / CR) via Ministry of Commerce / Saudi Business Center
- [ ] Add e-commerce activity to the CR
- [ ] Register on **Maroof** (mandatory e-commerce trust registry)
- [ ] Register for **VAT** with ZATCA (15%)
- [ ] Open a corporate bank account
- [ ] Engage a **Saudi tax advisor** — brief them on: principal-vs-agent (you chose principal), WHT on Egyptian/non-resident creator payouts, marketplace VAT treatment
- [ ] Engage a **Saudi IP/commercial lawyer** — brief them on: buyer licence (Standard/Extended), creator agreement, content policy, DMCA/takedown
- [ ] Engage a **PDPL/privacy advisor** — decide hosting region + draft privacy notice

### 0.3 Legal documents to have drafted (blocking for launch, not for dev)
- [ ] Buyer Licence Agreement — Standard + Extended (bilingual, versioned)
- [ ] Creator Agreement — commission, payout, exclusivity, warranties (creator guarantees they own/cleared the footage)
- [ ] Content Policy — what can/can't be uploaded, incl. Saudi cultural/decency standards
- [ ] Privacy Policy (PDPL-compliant, Arabic)
- [ ] Terms of Service
- [ ] Refund Policy (no refund after download)
- [ ] Model Release + Property Release templates (bilingual)
- [ ] DMCA / IP complaint procedure

### 0.4 Payments & tax infrastructure (start applications early — they take weeks)
- [ ] Apply for a payment gateway merchant account: **Moyasar / HyperPay / PayTabs / Tap** — must cover **mada + Apple Pay + card**
- [ ] Apply for **Tabby** and/or **Tamara** (BNPL) merchant accounts
- [ ] Set up **STC Pay** if desired
- [ ] Select a **ZATCA-certified e-invoicing provider** (Wafeq / Qoyod / ClearTax / etc.) — do NOT build e-invoicing yourself
- [ ] Set up **Payoneer or Wise** business account for paying Egyptian/foreign creators
- [ ] Set up local **IBAN payout** capability for Saudi creators

### 0.5 Brand & positioning
- [ ] Name, logo, brand system (Arabic-first typography that also works in English)
- [ ] Core positioning line: "No subscriptions. Buy once, own forever." (bilingual)
- [ ] Register domain(s); .sa and .com

---

## STAGE 1 — Design the Product (Weeks 3–8, overlaps Stage 0)

### 1.1 Define the taxonomy (do this before any UI)
- [ ] Locations tree (KSA regions/cities/landmarks) — bilingual + synonyms + transliteration (AlUla↔العلا)
- [ ] Subjects/categories tree
- [ ] Seasonal/event tags (Ramadan, National Day, Riyadh Season, F1…)
- [ ] Technical facets (resolution, fps, aspect, colour profile, camera movement, shot size)
- [ ] Vision 2030 theme tags
- [ ] If Arab-expandable: add Egypt/other-country location branches now
- [ ] Build the Arabic↔English synonym dictionary structure

### 1.2 Define the data model
- [ ] Entities: User, Creator, Album, Clip, Release, Category/Location/Tag, Collection, Board, Cart, Order, OrderItem, Entitlement, Download, LicenceCertificate, Invoice, CreatorLedger, Payout, ReviewTask (see main plan §6)
- [ ] Lock the two non-negotiables: `clip_manifest_snapshot` + `licence_version_id` frozen on every OrderItem
- [ ] Commission fields frozen per OrderItem at purchase time

### 1.3 Wireframe the critical pages (in priority order)
- [ ] Album PDP (the conversion page)
- [ ] Clip explorer + filters + search
- [ ] Clip detail modal (with album-conversion block)
- [ ] Cart + checkout (individual vs business toggle, VAT, payment methods)
- [ ] Home
- [ ] Account library (owned albums + download)
- [ ] Creator Studio (upload wizard, earnings, payouts)
- [ ] Admin review queue

### 1.4 Design system / UI kit
- [ ] Full RTL layout (logical CSS properties — test player, sliders, filter rails specifically)
- [ ] Bilingual components; Hijri date option; SAR (﷼) formatting
- [ ] Video card component (hover-preview + album ribbon + board button)

---

## STAGE 2 — Build the Foundation (Weeks 5–10)

### 2.1 Environment & stack
- [ ] Repo, CI/CD, staging + production environments
- [ ] Frontend: **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui**, i18n routing (`/ar` default, `/en`)
- [ ] Backend: **NestJS (Node)** or **Laravel (PHP)** — pick by team skill
- [ ] Database: **PostgreSQL**
- [ ] Cache/queue: **Redis + BullMQ**
- [ ] Search: **Meilisearch** (Arabic-friendly, fast to ship)
- [ ] Object storage: S3-compatible (region deferred to privacy advisor — keep code cloud-agnostic)
- [ ] CDN with MENA edge (CloudFront / Cloudflare / Akamai)

### 2.2 Auth & accounts
- [ ] Email + **phone-OTP** login (expected in KSA/Egypt)
- [ ] Roles: buyer / creator / admin
- [ ] Business account fields: legal name, CR, **VAT number**, billing address
- [ ] 2FA for creators and admins

### 2.3 Core data layer
- [ ] Implement schema + migrations
- [ ] Seed taxonomy (locations, categories, tags)
- [ ] Admin taxonomy editor (synonyms, term mapping)

---

## STAGE 3 — Build the Media Pipeline (Weeks 7–14)

- [ ] **Resumable multipart upload** direct-to-S3 via pre-signed URLs (files are multi-GB)
- [ ] Ingest queue: virus scan, checksum, **duplicate detection (perceptual hash)** — blocks re-uploads/stolen content
- [ ] **FFmpeg probe** → auto-extract technical metadata (don't make creators type resolution/fps/codec)
- [ ] Transcode fan-out:
  - [ ] Preview: HLS 360/720p, **muted + hard watermark + moving overlay**
  - [ ] Proxy: 1080p H.264 (delivered to buyer for editing)
  - [ ] Thumbnails: poster + hover sprite + animated WebP
  - [ ] Master: untouched original → cold storage, never publicly addressable
- [ ] **Album trailer auto-cut** (2s from each best clip + music bed) — big conversion lever
- [ ] Storage tiering: previews/proxies hot + CDN; masters infrequent-access
- [ ] **Signed-URL delivery** (5–15 min expiry) issued only against a valid entitlement
- [ ] Download logging (IP/UA/bytes) + rate limiting + anomaly alerts

---

## STAGE 4 — Build the Buyer Experience (Weeks 10–18)

### 4.1 Discovery
- [ ] Clip explorer grid (hover-preview cards + album ribbon)
- [ ] Filters: resolution, fps, aspect (incl. **9:16 vertical**), colour profile, camera movement, shot size, location, people, cleared-for-commercial ✅, price range, creator
- [ ] Search: Arabic stemming, diacritic/hamza normalisation, transliteration mapping, cross-language results
- [ ] **Log zero-result queries** (your content-gap report)
- [ ] Category hubs, Location hubs (SEO), Collections

### 4.2 Conversion
- [ ] Clip detail modal (deep-linkable) with the album-conversion block
- [ ] **Album PDP**: trailer, clip grid, specs, licence tiers (Standard/Extended), clearance badges, creator mini-profile, related albums, reviews
- [ ] Boards (save clips, shareable link for client approval)

### 4.3 Purchase
- [ ] Cart (edit licence tier inline, promo code, VAT line)
- [ ] Checkout:
  - [ ] Guest checkout → auto-create account
  - [ ] **Individual vs Business toggle** → business reveals CR + VAT number + PO number
  - [ ] Payment methods: mada, Apple Pay, card, STC Pay, Tabby/Tamara, **bank transfer / Net-30 for enterprise & gov**
- [ ] Order confirmation → instant download + licence certificate + tax invoice
- [ ] **ZATCA e-invoice generation** via certified provider (UUID, stamp, QR, hash chain)
- [ ] **Licence Certificate PDF** (bilingual, with clip manifest + buyer entity)

### 4.4 Post-purchase
- [ ] Account library: owned albums, per-clip + ZIP download, proxies alongside masters
- [ ] **Unlimited re-download forever** (state it loudly)
- [ ] Order history, invoices, licence certificates
- [ ] Team seats (business accounts)
- [ ] Licence tier upgrade (pay the difference)

---

## STAGE 5 — Build the Creator (Seller) Side (Weeks 14–22)

### 5.1 Onboarding
- [ ] `/sell` recruitment landing (Arabic-first; speak to Egyptian creators)
- [ ] Application form (showreel + sample clips + proof of KSA content)
- [ ] Admin approval flow
- [ ] E-sign creator agreement
- [ ] **Payout onboarding: Payoneer/Wise for Egypt/foreign, IBAN for Saudi** + tax status capture (for WHT)

### 5.2 Creator Studio
- [ ] Album creation wizard: concept → bulk upload → per-clip metadata review → **releases/permits gate (hard)** → cover+trailer → tier/price within band → submit
- [ ] **Permit vault** — attach filming permits; strict manual review for foreign creators shooting KSA controlled sites (AlUla/NEOM/Diriyah/Red Sea)
- [ ] Album manager (draft/in-review/live/paused/rejected)
- [ ] Creator storefront (public profile, showreel, album grid)
- [ ] Earnings dashboard + ledger + payout requests
- [ ] Creator analytics: search terms that surfaced you, board-add rate, PDP→purchase, demand signals

### 5.3 Commission & payouts engine
- [ ] Commission calc frozen per OrderItem (35/30/25% by tier, −5pt if exclusive)
- [ ] Creator ledger with **30-day hold** before funds available
- [ ] Monthly payout run + on-demand once available (min SAR 500)
- [ ] **Self-billing invoice** auto-generated per payout
- [ ] WHT handling on non-resident (Egyptian/foreign) payouts

---

## STAGE 6 — Build Admin & Operations (Weeks 12–22, parallel)

- [ ] **Content review queue** (the operational heart): play clips, verify metadata (both languages), releases, permits, **cultural/regulatory QC**, duplicate check, album coherence, quality bar
- [ ] Review SLA target: 3 business days
- [ ] Catalogue management (feature/unfeature, bulk edit, delist)
- [ ] Creator management (applications, tiers, commission overrides)
- [ ] Orders/refunds/chargebacks + manual invoicing
- [ ] Payout runs + bank/Payoneer file export + approvals
- [ ] Merchandising (homepage, collections, featured albums, banners)
- [ ] Disputes / DMCA / takedowns
- [ ] Reports: GMV, take rate, refund rate, zero-result queries, creator leaderboard
- [ ] CMS (blog, help centre, landing pages)

---

## STAGE 7 — Seed the Catalogue (Weeks 16–22, before public launch)

- [ ] Produce/acquire your own 3–5 launch albums (~50 clips each)
- [ ] **Concentrate in 1–2 locations/themes done deeply** (e.g. Riyadh + AlUla), not spread thin
- [ ] Recruit 2–4 trusted first creators (Egypt-first) and onboard their albums through the real pipeline
- [ ] Full bilingual metadata + verified permits on every seed album
- [ ] QA the whole buyer journey on real content

---

## STAGE 8 — Pre-Launch Hardening (Weeks 20–24)

- [ ] Security review: signed URLs, entitlement checks, download abuse, rate limits
- [ ] Load test transcoding + preview playback
- [ ] Legal pages live and linked; refund/licence disclosed at checkout
- [ ] ZATCA invoice tested end-to-end with the certified provider
- [ ] Payment methods tested live (mada + Apple Pay especially)
- [ ] Payout tested end-to-end to a real Payoneer/Wise + IBAN account
- [ ] Analytics/events instrumented (search→clip→PDP→cart→purchase)
- [ ] Accessibility + RTL QA on real devices
- [ ] Backup/restore + incident runbook

---

## STAGE 9 — Launch (Phase 1)

- [ ] Soft launch to a small buyer list; monitor conversion + zero-result queries
- [ ] Fix the top content gaps (buy/commission footage for the most-searched empty results)
- [ ] Open creator applications (Egypt-first outreach)
- [ ] Public launch + SEO push on location hubs
- [ ] Start enterprise/gov pipeline as relationship-led sales (plumbing already built)

---

## STAGE 10 — Scale (Phase 2 → 3, Months 6–14)

- [ ] Open marketplace fully (self-serve creator onboarding at volume)
- [ ] Reviews, boards sharing, creator storefront polish
- [ ] Enterprise accounts: team seats, PO, Net-30, custom licensing
- [ ] AI: auto-tagging, auto-translate, semantic/visual search, "more like this"
- [ ] Single-clip upsell (~40% of album price)
- [ ] Bundles / multi-album discounts / credit packs
- [ ] Forensic watermarking on high-value masters
- [ ] Affiliate programme; API for agency DAM integration
- [ ] Custom shoot commissioning marketplace
- [ ] Expand catalogue to broader Arab content if chosen

---

## Critical-path items (the things that block launch if late)
1. Payment gateway + mada/Apple Pay approval → **apply Week 1**
2. ZATCA e-invoicing provider integration → **decide Week 2**
3. Tax-advisor sign-off on principal model + WHT → **before checkout is built**
4. Media pipeline (upload→transcode→signed delivery) → **the hardest engineering**
5. Seed catalogue with verified permits → **no empty launch**
6. Legal docs (licence, creator agreement, content policy) → **before public**

## What to buy vs build
- **Buy:** e-invoicing (ZATCA), payments, BNPL, transcoding (Mux/Bitmovin at start), email/SMS (Unifonic), possibly video player (Mux/Vidstack)
- **Build:** catalogue, search facets, album/entitlement logic, commission/ledger/payout engine, review queue, creator studio
