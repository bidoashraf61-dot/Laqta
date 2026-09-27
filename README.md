# Laqta (لقطة)

Arabic-first stock-footage marketplace for Saudi/Arab content. Buyers search at
the **clip** level and buy at the **album** level; one-time purchase, perpetual
licence, no subscriptions.

> **New session? Start with `CLAUDE.md` → `HANDOFF.md` → `checklists/`.**
> Where this README disagrees with `specs/` or the code, those win — and fix
> the README in the same change.

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
npm run dev                   # → http://localhost:3000 (Arabic), /en for English
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
| `npm run verify:auth` | email sign-in, phone rail shut, 2FA, password reset, and the full role-guard matrix |
| `npm run verify:arabic` | no English leaking into an Arabic route and no Arabic into an English one (needs the server running) |

### Seeded accounts

Password for all three: `Laqta!2026`

| Email | Role |
|---|---|
| `admin@laqta.sa` | admin |
| `creator@laqta.sa` | creator (Egyptian, Silver tier, exclusive) |
| `nada@laqta.sa` | creator (Saudi, Standard tier) |
| `buyer@agency.sa` | buyer (business account, CR + VAT on file) |

The admin and both creators have two-factor switched on (it is mandatory for
those roles), so signing in asks for a code: `npm run totp:code -- admin@laqta.sa`.

The seed also puts in the full bilingual Saudi taxonomy, one live album with 22
clips, a draft, one album in review, five orders at different ages so the
30-day payout hold is visible in the ledger, and ten search queries — seven of
them zero-result, which is the content-acquisition signal `/admin/reports` shows.

The seed is idempotent. Re-run it whenever you like.

---

## Change rules

The build-era "Foundation owns these files" split is over — the owner works
alone now. What still binds (full list in `CLAUDE.md`):

- **Schema changes ship as a migration** (`prisma migrate diff … --script`),
  never `db push` alone. `verify:migrations` fails otherwise.
- **The two frozen invariants in `lib/orders.ts`** — entitlement from
  `OrderItem.clipManifestSnapshot`, commission frozen at purchase — are never
  recomputed.
- **Every UI change goes through Impeccable + `DESIGN.md`**, and every surface
  change updates its spec in `specs/` in the same commit.

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
| `phone` | `phone`, `code` — OTP; sign-in doubles as sign-up. **Shut** until an SMS provider exists |

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

Unauthenticated → redirect to `/sign-in?callbackUrl=…` (`/en/sign-in` on the
English site). Wrong role → **rewrite** to `/forbidden`, so the URL survives.

### Phone OTP

`lib/otp.ts` — `issueOtp(phone)` / `consumeOtp(phone, code)`. Codes are bcrypt
hashed at rest, 5-minute TTL, 5 attempts, one live challenge per number.
**Phone sign-in is off** until an SMS provider is built: `phoneSignInEnabled()`
is false, the `phone` provider refuses every code, and `/sign-in` shows the
email form only. No action ever returns a code to the browser (DEV-01).

### 2FA

`lib/totp.ts` — RFC 6238 on `node:crypto`, no dependency. Enrolment lives at
`/account/security` (`/en/account/security`). **Mandatory for creator and admin**
(`lib/two-factor.ts`); they cannot turn it off, and until they enrol every
`/admin/*` and `/studio/*` request sends them to the enrolment page and back
afterwards — held by middleware, the `(admin)`/`(studio)` layouts and
`requireRole()`/`studioActor()`. When an enrolled account signs in without a
code, the provider throws `TwoFactorRequiredError` and the form shows the
authenticator step.

The seeded demo admin and creators are enrolled with fixed, published dev
secrets (`prisma/seed.ts` — never run it against production). To sign in to one
locally, get the current code:

```bash
npm run totp:code -- admin@laqta.sa
```

The browser gates type the code the same way (`scripts/two-factor-fixture.mjs`);
there is no bypass.

---

## Arabic and English

Arabic is the default and owns the bare path (`/albums`). English is served
under `/en/albums` by a middleware **rewrite** onto the same route tree — there
is no `app/[locale]` segment and no route file exists twice. `/ar/*`
308-redirects to the bare path. **`specs/localisation.md` is the contract**;
read it before touching anything that renders copy.

- Every page, layout, `loading.tsx` and `generateMetadata` starts with
  `await requestLocale()` — the locale is not inherited from the root layout.
- Server code uses `t()`; client components use `useT()` / `useLocale()`.
- Database copy goes through `<Bilingual ar en />`, or `pickLocalised(ar, en)`
  in attributes, metadata and JSON-LD.
- Strings live in `messages/ar.json` (source of truth) and `messages/en.json`.
  Fallback is always towards Arabic.

```ts
import { t, formatMoney, formatDate, formatHijri, normaliseArabic } from '@/lib/i18n'

formatMoney(149)          // → "149 US$" on an Arabic page, "$149" on English
formatHijri(new Date())   // → "21 صفر 1448 هـ"
```

Prices, orders and payouts are in **USD**.

### Arabic is not negotiable — and it is enforced

`npm run verify:arabic` crawls every route as a signed-in admin and fails
on any visible Latin text that is not deliberately marked as an isolated
foreign run — and, on `/en`, on any Arabic that leaks the other way. **Run it before you merge.** Add your new routes to `ROUTES` in
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

Client components translate with `useT()` (`lib/i18n-client`), never `t()` —
server-rendering a client component is a second React render and does not
share the RSC `cache()` scope that `t()` reads.

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

- Commission: 35% → 30% (USD 12.5k lifetime) → 25% (USD 50k), −5 points if the **album**
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
| 01 Foundation | schema, auth, 2FA, design system, Arabic + English shell |
| 02 Landing | scroll cinematic (stills; clips drop in via `components/landing/scenes.ts`) |
| 05 Catalogue | /footage, /albums, album PDP, clip detail, hubs, Arabic search |
| 04 Client | cart, checkout, library, signed downloads, shared boards |
| 03 Creator | studio, clip uploads (ffprobe), release scans, spec-consistency gate, submission gate, earnings, payouts |
| 06 Admin | review queue with enforced checklist, catalogue, orders, refunds, payout runs, users + read-only view-as-user, price bands, taxonomy, reports |

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
  [docs/tech/media-aws.md](docs/tech/media-aws.md). Creators upload through the
  studio; previews are cut by `npm run media:previews` + `npm run media:upload`.
- **No Meilisearch.** Search runs on Postgres behind `SearchDriver`.
- **No SMS provider.** Phone sign-in is switched off; sign-in is email only.
- **No hosting yet.** No Dockerfile, CI or server — BIZ-07 / DEV-14.
- **No ETA e-invoicing.** Invoice rows are created; the certified-provider
  integration is not built. Do not build e-invoicing by hand.
- **Album trailers** are not auto-cut. An operator sets one per album
  (`/admin/catalogue`, or a cut dropped in `.media/out/trailers/` and
  `media:upload`); without one the PDP leads with the album's cover still.
