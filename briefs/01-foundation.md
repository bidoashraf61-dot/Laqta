# Brief 01 — Foundation ⚠️ RUN FIRST, ALONE

**Branch:** `feat/foundation` → merge to `main` **before any other session starts**
**Why alone:** every other brief builds against these contracts. If two sessions invent schemas in parallel, the merge is a rewrite.

---

## Context

**Laqta (لقطة)** — Arabic-first stock-footage marketplace for Saudi/Arab content. Buyers search clips, buy **albums** (one-time, perpetual licence, no subscription). Creators sell albums; platform takes commission. Egypt-registered company, Saudi buyers, Egyptian creators at launch.

Read `briefs/00-README-START-HERE.md` first.

---

## You own these files — nobody else touches them

```
prisma/schema.prisma
lib/auth.ts  lib/db.ts  lib/i18n.ts  lib/utils.ts
app/layout.tsx
app/[locale]/layout.tsx
components/ui/*          ← shadcn primitives
components/layout/*      ← header, footer, nav
styles/globals.css
tailwind.config.ts
middleware.ts
```

---

## Scope

### 1. Project scaffold
- Next.js App Router + TypeScript + Tailwind + shadcn/ui
- ESLint, Prettier, `.env.example`
- Folder structure with route groups: `(public)`, `(account)`, `(studio)`, `(admin)`

### 2. i18n + RTL — the part most often done wrong
- Locale-prefixed routing: `/ar` (**default**) and `/en`
- `<html lang="ar" dir="rtl">` driven by locale
- **Use CSS logical properties** (`margin-inline-start`, not `margin-left`) so RTL works without mirrored stylesheets
- **IBM Plex Sans Arabic** self-hosted
- Translation files `messages/ar.json`, `messages/en.json` — Arabic is the source of truth
- Number/currency formatting: SAR, Arabic-Indic digits optional
- **Test the RTL breakages specifically:** sliders, video player controls, filter rails, carousels, dropdown alignment, icon direction (arrows must flip)

### 3. Design system
Tokens from the hero cinematic so the whole site matches the film:

```
--gold:    #C8A24A   (primary accent)
--ink:     #14141A   (dark base)
--sand:    #E9DCC3
--clay:    #C06A3E
--oasis:   #2F8F5B
--paper:   #FAF8F3
```

Typography scale, spacing scale, radius, shadows. Dark-first (the cinematic is dark). shadcn components themed to these tokens.

### 4. Database schema (Prisma)

Implement these entities — full field lists in `docs/saudi-stock-footage-portal-plan.md` §6:

`User` · `Creator` · `Album` · `Clip` · `Release` · `Category` · `Location` · `Tag` · `Collection` · `Board` · `Cart` · `CartItem` · `Order` · `OrderItem` · `Entitlement` · `Download` · `LicenceCertificate` · `Invoice` · `CreatorLedger` · `Payout` · `ReviewTask`

**Two non-negotiable rules — the whole commercial model depends on them:**

1. **`OrderItem.clipManifestSnapshot`** — the exact clip IDs owned at purchase time, frozen. If a creator later edits or deletes clips from an album, the buyer's entitlement must be unchanged. **Never compute entitlement from the live album.**
2. **`OrderItem.licenceVersionId` + frozen commission fields** — licence terms and commission rate are snapshotted at purchase. You will revise both later; past orders must be governed by what was in force at the time.

Seed script: taxonomy (Saudi locations, categories, tags — bilingual), one admin user, one test creator, one test buyer.

### 5. Auth + roles
- Auth.js: email/password **and phone-OTP** (phone-OTP is expected in KSA/Egypt — not optional)
- Roles: `buyer` | `creator` | `admin`
- Route protection in `middleware.ts`:
  - `/studio/*` → creator or admin
  - `/account/*` → any authenticated
  - `/admin/*` → admin only
- Business-account fields on User: legal name, CR number, **VAT number**, billing address
- 2FA for creator and admin

### 6. Shared layout
- Header: logo, search entry, locale switch, auth state, cart
- Footer: legal links, language, social
- Mobile nav (drawer, RTL-correct)
- Loading / error / empty-state primitives
- Toast system

---

## Acceptance criteria

- [ ] `npm run dev` serves `/ar` with correct RTL and Arabic fonts
- [ ] `/en` renders LTR correctly; switching locale preserves the current path
- [ ] `npx prisma migrate dev` runs clean; seed populates taxonomy + 3 users
- [ ] Sign up / sign in works by email **and** phone-OTP
- [ ] Role guards enforced: buyer hitting `/admin` is blocked, creator hitting `/studio` passes
- [ ] shadcn components render in brand tokens, dark theme
- [ ] Zero hard-coded `left`/`right` in CSS — logical properties only
- [ ] A README documents how other sessions consume schema, auth and components

---

## Explicitly NOT yours

Landing page (02) · creator portal (03) · client portal (04) · catalogue and search (05) · admin (06).

Build the **plumbing and contracts** only. Resist building features — every hour you spend on a feature is an hour four other sessions are blocked.

---

## Handoff note

When you merge, post a short summary of: final schema entity names, auth helper signatures, and available UI components. The other five sessions read that to know what they're building against.
