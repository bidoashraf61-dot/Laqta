# Laqta — project rules

## ⚠️ Hard rule: all UI goes through Impeccable + the design system

**Every build, revamp, or visual change to any portal surface MUST go through
the Impeccable skill and MUST follow the design guidelines. No exceptions.**

Concretely, before writing or changing any user-facing UI:

1. **Load Impeccable.** Invoke the `impeccable` skill and run its setup
   (`node <impeccable-base>/scripts/context.mjs --target <file>`), then load the
   playbook for the task (`shape`/`craft`/`polish`/`audit`/etc). Do not hand-build
   a screen without it.
2. **Obey the design system.** `DESIGN.md` (repo root) + `.impeccable/design.json`
   are the normative tokens and rules; `docs/design-language.md` is the fuller
   rationale. The palette, the gold ration (One Voice Rule), the two-weight
   headline, the Thmanyah three-cut typography, the letterbox motif and the RTL
   rules are binding, not suggestions.
3. **Run the detector before you call a UI change done:**
   `node <impeccable-base>/scripts/detect.mjs --json <changed files>`.

If a request would break a design rule, say so and reconcile with the user
before shipping — do not quietly split the difference.

## Language & direction

Arabic only. RTL by default. Logical properties only (`ms/me/ps/pe`,
`start/end`) — never `left`/`right`/`ml`/`mr`. Any Latin run inside Arabic is
isolated with `.ltr-island` or `.numeric`. `npm run verify:arabic` must pass.

## Verification gates (must stay green)

`npm run verify` runs all of these; keep them passing on every change:

- `verify:i18n` — Arabic copy, formatting, search folding
- `verify:search` — Arabic stemming, transliteration, filters
- `verify:entitlement` — buy → mutate album → library unchanged
- `verify:money` — commission frozen; refund reverses the frozen rate
- `verify:auth` — both sign-in rails, 2FA, role-guard matrix
- `verify:arabic` — no English leaking into any route (needs the server up)

Plus `npm run build` and `npm run lint`.

## Architecture facts a session needs

- Next.js App Router, Arabic-only (no locale segment; `/ar` and `/en` 308-redirect).
- Postgres via Prisma. `npm run db:start` boots embedded Postgres on :5433.
- Auth.js v5, email + phone-OTP, TOTP 2FA for creator/admin. Guards in
  `middleware.ts`, repeated in route-group layouts.
- The two frozen invariants live in `lib/orders.ts` and must never be recomputed:
  entitlement is served from `OrderItem.clipManifestSnapshot`; commission is
  frozen at purchase.
- Payments (`lib/payments.ts`) and storage (`lib/storage.ts`) are behind driver
  interfaces with honest local drivers — no gateway/S3 yet.
- Hero video is staged in `public/hero/vid/` (gitignored); wiring is gated on a
  user go-signal.

## Git

Work on a branch, merge to `main` with `--no-ff`. `main` is the working checkout
in the project folder. Each portal/feature lands as its own reviewable commit.
