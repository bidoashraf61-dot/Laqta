# Laqta (لقطة) — Foundation

Arabic-first stock-footage marketplace for Saudi/Arab content. Buyers search at
the **clip** level and buy at the **album** level; one-time purchase, perpetual
licence, no subscriptions.

> **New session? Start with `CLAUDE.md` → `HANDOFF.md` → `LAUNCH-ROADMAP.md`.**
> Parts of this README predate the bilingual site and USD pricing (the
> "Arabic" section, commission thresholds in SAR, "upload UI not built").
> Where it disagrees with `specs/` or the code, those win; the cleanup is
> roadmap task P0.4.

This README is the developer reference: setup, data model, auth, domain
helpers. The original build briefs are in `docs/archive/briefs/`.

---

## Run it

```bash
npm install
cp .env.example .env          # then set AUTH_SECRET: openssl rand -base64 32
npm run db:start              # embedded Postgres on :5433 — no Docker needed
npm run db:migrate
npm run db:seed
npm run dev                   # → http://localhost:3000/ar
```

`npm run db:start` downloads a real Postgres binary into `node_modules` and runs
it against `./.pgdata` (git-ignored). **Every parallel session should point at
the same `DATABASE_URL`** so you are all developing against one catalogue.

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:start` / `db:stop` | local Postgres |
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma |
| `npm run lint` / `typecheck` | ESLint / tsc |
| `npm run verify` | **everything below, in order** |
| `npm run verify:migrations` | replaying `prisma/migrations` produces `schema.prisma` exactly |
| `npm run verify:i18n` | Arabic copy, formatting, search folding |
| `npm run verify:search` | Arabic stemming, transliteration, filters, zero-result logging |
| `npm run verify:entitlement` | buy → mutate the album → library unchanged |
| `npm run verify:money` | commission frozen; refund reverses at the frozen rate |
| `npm run verify:payments` | Paymob callback: HMAC, idempotency, amount match, same result as a manual settle |
| `npm run verify:auth` | both sign-in rails, 2FA, and the full role-guard matrix |
| `npm run verify:arabic` | no English leaking into any route (needs the server running) |

### Seeded accounts

Password for all three: `Laqta!2026`

| Email | Role |
|---|---|
| `admin@laqta.sa` | admin |
| `creator@laqta.sa` | creator (Egyptian, Silver tier, exclusive) |
| `nada@laqta.sa` | creator (Saudi, Standard tier) |
| `buyer@agency.sa` | buyer (business account, CR + VAT on file) |

The seed also puts in the full bilingual Saudi taxonomy, one live album with 22
clips, a draft, one album in review, five orders at different ages so the
30-day payout hold is visible in the ledger, and ten search queries — seven of
them zero-result, which is the content-acquisition signal Brief 06 reports on.

The seed is idempotent. Re-run it whenever you like.

---

## What Foundation owns — do not edit these

```
prisma/schema.prisma      lib/auth.ts  lib/auth.config.ts  lib/db.ts
lib/i18n.ts  lib/utils.ts  lib/otp.ts  lib/totp.ts
lib/commission.ts  lib/audit.ts  lib/review-checklist.ts
app/layout.tsx  app/[locale]/layout.tsx
components/ui/*  components/layout/*
styles/globals.css  tailwind.config.ts  middleware.ts
```

Need a schema change? **Do not edit `schema.prisma`.** Write it in your brief's
*Schema requests* section and flag it. Two sessions adding columns in parallel
is how the merge becomes a rewrite.

Everything else is yours: your route folder, your components, your server
actions, your queries.

---

## Database

`postgresql` + Prisma. Entities, by area:

| Area | Models |
|---|---|
| Identity | `User` `Account` `Session` `VerificationToken` `PhoneOtp` |
| Supply | `Creator` `Album` `Clip` `Release` `ReleaseClip` |
| Taxonomy | `Taxonomy` `AlbumTaxonomy` `ClipTaxonomy` |
| Merchandising | `Collection` `CollectionAlbum` `MerchandisingSlot` |
| Demand | `Board` `BoardClip` `Cart` `CartItem` |
| Commerce | `Order` `OrderItem` `Entitlement` `Download` `LicenceVersion` `LicenceCertificate` `Invoice` |
| Refunds | `Refund` `RefundLine` `Chargeback` |
| Creator money | `CreatorLedger` `Payout` `PayoutRun` |
| Operations | `ReviewTask` `Dispute` `AuditLog` `Impersonation` |
| Pricing | `PriceBand` `PromoCode` |
| Telemetry | `SearchQueryLog` |

### The two rules the commercial model depends on

**1. Entitlement is served from the frozen manifest, never from the live album.**

`OrderItem.clipManifestSnapshot` holds the exact clips — ids, titles, keys — as
they stood at purchase, and `Entitlement.clipIdsSnapshot` mirrors the ids. If a
creator later edits or deletes clips, the buyer's entitlement is unchanged.

```ts
// RIGHT
const clips = entitlement.clipIdsSnapshot
// WRONG — the album may have changed since they paid
const clips = await db.clip.findMany({ where: { albumId: entitlement.albumId } })
```

**2. Licence terms and commission are snapshotted at purchase.**

`OrderItem.licenceVersionId`, `commissionRate`, `commissionAmount`,
`creatorNetAmount` and `commissionBasis` are written once, by
`resolveCommission()` in `lib/commission.ts`, and never recomputed. A creator
promoted to Gold in March must not retroactively change what they earned in
January. Refunds reverse against the **frozen** rate via `reverseCommission()`.

Bilingual fields are always a pair — `titleAr` / `titleEn`, `nameAr` / `nameEn`.
Arabic is the source of truth.

---

## Auth

Auth.js v5, JWT sessions, two credential providers.

| Provider id | Credentials |
|---|---|
| `email` | `email`, `password`, `totp` (only when the account has 2FA) |
| `phone` | `phone`, `code` — OTP; sign-in doubles as sign-up |

```ts
import { auth, getCurrentUser, requireUser, requireRole,
         requireAdmin, requireCreator, canAccess,
         hashPassword, normalisePhone } from '@/lib/auth'

const session = await auth()                 // Session | null
const user    = await getCurrentUser()        // SessionUser | null
const user    = await requireUser()           // throws UNAUTHENTICATED
const user    = await requireRole('admin')    // throws FORBIDDEN
const admin   = await requireAdmin()          // = requireRole('admin')
const creator = await requireCreator()        // = requireRole('creator','admin')
```

`session.user` carries `{ id, role, locale, creatorId, impersonatedBy? }`.
`creatorId` is null for buyers — use it instead of a second query.

Roles change mid-session (a creator gets approved). Refresh with
`useSession().update()`; the JWT callback re-reads the row.

### Route protection

`middleware.ts` is the gate; the route-group layout is the lock. Both are in
place — repeat the check in your own server actions too, because an action is
reachable without ever rendering the page that guards it.

| Path | Access |
|---|---|
| `/admin/*` | admin |
| `/studio/*` | creator or admin |
| `/account/*` | any authenticated |

Unauthenticated → redirect to `/{locale}/sign-in?callbackUrl=…`.
Wrong role → **rewrite** to `/{locale}/forbidden`, so the URL survives.

### Phone OTP

`lib/otp.ts` — `issueOtp(phone)` / `consumeOtp(phone, code)`. Codes are bcrypt
hashed at rest, 5-minute TTL, 5 attempts, one live challenge per number. With
no `SMS_PROVIDER` configured the code is returned as `devCode` and printed to
the server console; the sign-in form surfaces it in development.

### 2FA

`lib/totp.ts` — RFC 6238 on `node:crypto`, no dependency. Enrolment lives at
`/{locale}/account/security`. Mandatory for creator and admin
(`twoFactorRequired(role)`); they cannot turn it off. When an enrolled account
signs in without a code, the provider throws `TwoFactorRequiredError` and the
form shows the authenticator step.

---

## Arabic

The portal ships in Arabic only. There is no locale segment, no language
switcher and no second dictionary — `laqta.sa/albums`, not `/ar/albums`.
`/ar/*` and `/en/*` 308-redirect, so nothing already linked breaks.

The **data** stays bilingual on purpose: `titleEn` and the taxonomy's English
synonyms carry the transliterations that let an Arabic query match
English-tagged footage, and creators are worldwide.

```ts
import { t, formatMoney, formatDate, formatHijri, normaliseArabic } from '@/lib/i18n'

t('commerce.fromAlbum', { album: 'العلا' })   // → "من ألبوم: العلا"
formatMoney(1499)                             // → "1,499 ر.س."
formatHijri(new Date())                       // → "21 صفر 1448 هـ"
```

Strings live in `messages/ar.json`. `t()` is a plain function over one
dictionary, so client components import it directly — no label-threading.

### Arabic is not negotiable — and it is enforced

`npm run verify:arabic` crawls every route as a signed-in admin and fails
on any visible Latin text that is not deliberately marked as an isolated
foreign run. **Run it before you merge.** Add your new routes to `ROUTES` in
`scripts/verify-arabic.ts`.

The rule it enforces: on an Arabic page, Latin is allowed only inside
`.ltr-island`, `.numeric` or `<code>`. That is not cosmetic — those wrappers
set `unicode-bidi: isolate`, and without it a Latin run drags its punctuation
and numerals to the wrong end of the Arabic sentence around it. So "is it
translated?" and "is it correctly isolated?" are the same question.

It checks attributes too — `placeholder`, `aria-label`, `title`, `alt`. That is
where English actually survives: it caught the toast container announcing
itself as "Notifications" to screen readers on every Arabic page, which no
visual review would ever surface. Assume the same class of bug in anything you
render but never look at.

Legitimately-Latin proper nouns (SAR, ZATCA, mada, NEOM, IBAN…) are
allowlisted in the script — extend the list rather than working around it.

`getTranslator` runs on the server. Pass the finished strings into client
components as props rather than shipping the dictionaries to the browser — see
`components/layout/site-header.tsx`.

### The RTL rules

1. **Logical properties only.** `ms-*` `me-*` `ps-*` `pe-*` `start-*` `end-*`
   `text-start` `text-end` `border-s` `border-e` `rounded-s-*` `rounded-e-*`.
   Never `ml-*`, `left-*`, `text-left`. The one exception is a genuinely
   direction-aware transform, and it must be written `ltr:… rtl:…` in pairs.
2. **Directional icons must mirror.** Put `data-flip-rtl` on arrows, chevrons
   and carets. globals.css does the `scaleX(-1)`. Non-directional glyphs
   (clock, search) must not carry it.
3. **Radix reads direction from context, not the DOM.** `DirectionProvider` is
   mounted in `components/layout/providers.tsx`. Use the wrapped primitives in
   `components/ui/*` rather than bare Radix, or dropdowns align to the wrong
   edge and arrow keys run backwards.
4. **Isolate mixed content.** Arabic in an English page, or the reverse, needs
   `<Bilingual ar={…} en={…} locale={locale} />`. Numerals, prices, order
   numbers, IBANs and file keys get `className="numeric"` — LTR, tabular.
5. **Never hand-roll a scroll rail or a range slider.** Use `ScrollArea` and
   `Slider`. Native and Radix get RTL right; a custom `overflow-x-auto` starts
   scrolled to the wrong edge in Arabic.

---

## Design system

Tokens are CSS custom properties in `styles/globals.css`, surfaced through
Tailwind. Dark is the default — the site sits inside the hero cinematic.

| Token | Hex | Use |
|---|---|---|
| `gold` | `#C8A24A` | primary accent |
| `ink` | `#14141A` | dark base |
| `sand` | `#E9DCC3` | warm neutral |
| `clay` | `#C06A3E` | secondary accent |
| `oasis` | `#2F8F5B` | success / cleared |
| `paper` | `#FAF8F3` | light surface |

Semantic tokens follow the shadcn contract: `background` `foreground` `card`
`popover` `primary` `secondary` `muted` `accent` `destructive` `success`
`warning` `border` `input` `ring`. Use those, not raw brand colours, so a theme
change is one file.

Type: `text-display`, `text-headline`, `text-2xs` on top of the Tailwind scale.
Shadows: `shadow-soft` `shadow-lift` `shadow-glow`. Radius: `var(--radius)`.

**IBM Plex Sans Arabic**, self-hosted in `public/fonts`. Arabic faces carry a
`unicode-range`, so an `/ar` page never downloads Latin glyphs it will not draw.

### Components

`components/ui/*`

| File | Exports |
|---|---|
| `button.tsx` | `Button` (`default` `gold` `secondary` `outline` `ghost` `destructive` `link`), `buttonVariants` |
| `input.tsx` | `Input` `Textarea` |
| `label.tsx` | `Label` `Field` (label + control + hint/error) |
| `card.tsx` | `Card` `CardHeader` `CardTitle` `CardDescription` `CardContent` `CardFooter` |
| `badge.tsx` | `Badge` (`default` `gold` `neutral` `success` `warning` `destructive` `outline`) |
| `dialog.tsx` | `Dialog` + parts |
| `sheet.tsx` | `Sheet` + parts — `side="start" \| "end" \| "top" \| "bottom"` |
| `dropdown-menu.tsx` | `DropdownMenu` + parts |
| `select.tsx` | `Select` + parts |
| `tabs.tsx` | `Tabs` `TabsList` `TabsTrigger` `TabsContent` |
| `toggles.tsx` | `Checkbox` `Switch` `Separator` `Progress` `Slider` |
| `overlays.tsx` | `Tooltip` `Popover` `Avatar` `ScrollArea` + parts |
| `table.tsx` | `Table` + parts |
| `state.tsx` | `Spinner` `LoadingState` `CardGridSkeleton` `EmptyState` `ErrorState` `Alert` |
| `skeleton.tsx` | `Skeleton` |
| `bilingual.tsx` | `Bilingual` `RtlIsland` `LtrIsland` `Numeric` |
| `toast.tsx` | `Toaster` (already mounted), `toast` |

```ts
import { toast } from '@/components/ui/toast'
toast.success('تم الحفظ')
```

`components/layout/*` — `SiteHeader` `SiteFooter` `MobileNav` `LocaleSwitch`
`SearchEntry` `UserMenu` `Providers` `ScaffoldPage`, and `nav.ts` where all
site-wide navigation is declared. Add your section's own nav inside your own
folder.

**Always build links as `/${locale}${href}`.** A bare `/albums` costs a
middleware redirect on every click.

---

## Domain helpers

```ts
import { resolveCommission, reverseCommission, tierForLifetimeGmv,
         vatOn, TIER_RATES } from '@/lib/commission'
import { CHECK_DEFINITIONS, emptyChecklist, normaliseChecklist,
         canApprove, clearedForCommercial, PERMIT_AUTHORITIES } from '@/lib/review-checklist'
import { recordAudit } from '@/lib/audit'
import { cn, serialise, slugify, formatBytes, formatDuration,
         addBusinessDays } from '@/lib/utils'
```

- Commission: 35% → 30% (SAR 50k) → 25% (SAR 200k), −5 points if the **album**
  is exclusive. Resolve once, at purchase.
- Review: eight checks; `releases` and `cultural` are blocking — an album
  cannot be approved while either fails.
- `serialise()` before handing Prisma `Decimal`/`BigInt`/`Date` to a client
  component; they do not cross the RSC boundary.
- Every state-changing admin action calls `recordAudit()`.

---

## What is built

| Brief | Status |
|---|---|
| 01 Foundation | schema, auth, 2FA, design system, Arabic shell |
| 02 Landing | scroll cinematic (stills; clips drop in via `components/landing/scenes.ts`) |
| 05 Catalogue | /footage, /albums, album PDP, clip detail, hubs, Arabic search |
| 04 Client | cart, checkout, library, signed downloads, shared boards |
| 03 Creator | studio, spec-consistency gate, submission gate, earnings |
| 06 Admin | review queue with enforced checklist, refunds, zero-result report |

## Known gaps — deliberate, not forgotten

- **Paymob is built but dormant.** Card and Apple Pay go through Paymob's
  Intention API + hosted Unified Checkout (`lib/paymob.ts`), settled only by the
  signed callback at `/api/payments/paymob`. They appear at checkout only once
  the `PAYMOB_*` variables are set (see `.env.example` and
  `specs/api/payments-paymob.md`). mada, Tabby and Tamara are not wired. Bank
  transfer works end to end.
- **Object storage is wired, not switched on.** `lib/storage.ts` has an S3
  driver (masters via S3-presigned or CloudFront-signed URLs) and
  `lib/media.ts` resolves public media against the CloudFront domain; both
  fall back to honest local behaviour until the AWS env is set — see
  [docs/tech/media-aws.md](docs/tech/media-aws.md). Upload UI is not built; the
  pipeline is `npm run media:previews` + `npm run media:upload`.
- **No Meilisearch.** Search runs on Postgres behind `SearchDriver`.
- **No ETA e-invoicing.** Invoice rows are created; the certified-provider
  integration is not built. Do not build e-invoicing by hand.
- **Album trailers** are not auto-cut. An operator sets one per album
  (`/admin/catalogue`, or a cut dropped in `.media/out/trailers/` and
  `media:upload`); without one the PDP leads with the album's cover still.
