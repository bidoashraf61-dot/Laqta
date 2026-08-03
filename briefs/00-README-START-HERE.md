# Laqta — Parallel Build Briefs

**Read this before opening any other brief.**

Each numbered brief is **self-contained** — a fresh Claude Code session can open one and start work with no other context. But they all build **one app**, so the rules below are not optional.

---

## The product in one paragraph

**Laqta (لقطة)** is an Arabic-first stock-footage marketplace for Saudi/Arab content. Buyers **search at the clip level but purchase at the album level** — a clip is never sold alone. Creators upload albums; the platform takes a commission. One-time purchase, perpetual licence, **no subscriptions**. Company registered in **Egypt**; buyers mainly Saudi; creators mainly Egyptian at launch.

**The single most important product rule:** every clip card, search result and grid tile must show which album it belongs to and that album's price, and route to the album page. Build a pure album catalogue and conversion dies; build a pure clip catalogue and buyers rage when they can't buy one clip.

---

## ONE app, ONE deployment, ONE link

```
laqta.sa                          ← one Next.js app
├── /                 landing     → brief 02
├── /footage /albums  catalogue   → brief 05
├── /account/*        client      → brief 04
├── /studio/*         creator     → brief 03
└── /admin/*          admin       → brief 01
```

Not four apps. Four **route groups** in one codebase, sharing one database, one auth system, one design system.

---

## ⚠️ Session 0 runs FIRST and ALONE

**Brief `01-foundation.md` must be complete and merged to `main` before any other session starts.**

It builds the shared contracts every other brief depends on:
- Database schema (Prisma)
- Auth + roles (buyer / creator / admin)
- Design system, Arabic fonts, RTL layout
- i18n routing (`/ar` default, `/en`)
- Shared UI components

If sessions run before this exists, each will invent its own schema and auth, and the merge will be a rewrite.

---

## Parallel workflow rules

1. **One branch per session.** `feat/admin`, `feat/studio`, `feat/client`, `feat/catalogue`, `feat/landing`.
2. **Stay inside your route folder.** Your brief names exactly which paths you own.
3. **Never edit shared files** (`prisma/schema.prisma`, `lib/auth.ts`, `components/ui/*`, `app/layout.tsx`) without flagging it — those belong to Foundation. If you need a schema change, note it in your brief's *Schema requests* section instead of editing.
4. **Merge to `main` often.** `main` auto-deploys; that's the one live link.
5. **Arabic first.** Every UI string ships in Arabic. RTL is the default direction, not an afterthought.

---

## Brief index

| # | Brief | Owns | Depends on |
|---|---|---|---|
| 01 | `01-foundation.md` | schema, auth, design system, i18n, layout | — **run first, alone** |
| 02 | `02-landing-page.md` | `/` | 01 |
| 03 | `03-creator-portal.md` | `/studio/*`, `/sell` | 01 |
| 04 | `04-client-portal.md` | `/account/*`, cart, checkout | 01 |
| 05 | `05-catalogue-search.md` | `/footage`, `/albums`, `/categories`, `/locations` | 01 |
| 06 | `06-admin-dashboard.md` | `/admin/*` | 01, and ideally 03 |

---

## Locked decisions (do not re-litigate)

| Decision | Choice |
|---|---|
| SKU | **Album only** at launch. No single-clip sales. |
| Licence tiers | Standard / Extended (Extended = 3× price) |
| Commission | 35% → 30% (SAR 50k) → 25% (SAR 200k); −5pt if album is exclusive |
| Payout hold | 30 days after purchase |
| Refunds | None after download; 7-day window if undownloaded |
| Buyers | Both agencies/government **and** solo creators |
| Creators | Worldwide, Egypt-first |
| VAT | Platform is **principal of record** (pending tax-advisor sign-off) |
| Default language | **Arabic**, RTL |

---

## Stack (fixed — do not substitute)

- **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui**
- **PostgreSQL + Prisma**
- **Auth.js** with email + phone-OTP
- **S3-compatible** object storage, signed URLs
- **Meilisearch** (Arabic-friendly)
- **IBM Plex Sans Arabic**

---

## Reference material already in this repo

- `docs/saudi-stock-footage-portal-plan.md` — full platform plan, data model, taxonomy, legal
- `docs/build-steps.md` — phased build sequence
- `landing/` — working Arabic RTL scroll-cinematic prototype (vanilla JS)
- `final_stills_4K/` — 12 approved 4K hero stills for the landing cinematic
- `02_FINAL_STORYBOARD.pdf` — hero film running order
