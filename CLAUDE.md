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

## ⚠️ Hard rule: the spec is updated in the same change as the code

**`specs/` is the shared memory between sessions. A change that edits a surface
without editing its spec is an incomplete change.** A future session reads the
spec, believes it, and builds on a lie.

Concretely, for every change to a portal surface:

1. **Read the spec first.** `specs/admin/<route>.md` for admin,
   the matching file elsewhere in `specs/` for other areas. Do not change a page
   you have not read the spec for.
2. **Update the spec in the same commit as the code** — never "later", never a
   follow-up commit. Content, design and behaviour all count: new or removed
   controls, changed copy, a new state or empty state, a changed data query,
   a new invariant, a changed verification gate.
3. **Keep `specs/admin/README.md` in sync too** — the route table, the Coverage
   section and the "Dead ends worth knowing" list are part of the spec. If a
   change closes a dead end or adds gate coverage, that list changes with it.
4. **Match the house format**: Route/Access/Rendering line, Purpose, Data in,
   Controls table, States, Invariants, Verified by. Do not invent a new shape.

If a change turns out to be pure refactor with no user-visible or behavioural
delta, say so explicitly rather than silently skipping the spec.

## Language & direction

**Arabic and English.** Arabic is the default and owns the bare path
(`/albums`); English is served under `/en/albums` by a middleware **rewrite**
onto the same route tree — there is no `app/[locale]` segment and no route file
exists twice. `specs/localisation.md` is the contract; read it before touching
anything that renders copy.

Non-negotiables:

- **Every route segment resolves the locale itself** — `await requestLocale()`
  as the first statement of every page, layout, `loading.tsx` and
  `generateMetadata`. It is NOT inherited from the root layout: a segment sits
  inside a Suspense boundary and can render before the layout above it finishes
  awaiting, which produced an English header over an Arabic body.
- **Client components use `useT()` / `useLocale()`**, never `t()` or
  `currentLocale()`. Server-rendering a client component is a second React
  render and does not share the RSC `cache()` scope.
- **Database copy goes through `<Bilingual ar en />`**, or `pickLocalised(ar, en)`
  where JSX cannot go — `alt`, `aria-label`, JSON-LD, `generateMetadata`. Those
  attributes are where Arabic leaked longest; no visual review catches them.
- Fallback is always **towards Arabic**, never towards a blank or a dot-path.

Logical properties only (`ms/me/ps/pe`, `start/end`) — never
`left`/`right`/`ml`/`mr`. Any Latin run inside Arabic is isolated with
`.ltr-island` or `.numeric`. `npm run verify:arabic` must pass **in both
directions**.

## Verification gates (must stay green)

`npm run verify` runs all of these; keep them passing on every change:

- `verify:i18n` — Arabic copy, formatting, search folding
- `verify:search` — Arabic stemming, transliteration, filters
- `verify:entitlement` — buy → mutate album → library unchanged
- `verify:money` — commission frozen; refund reverses the frozen rate
- `verify:auth` — both sign-in rails, 2FA, role-guard matrix
- `verify:arabic` — no English leaking into an Arabic route, and no Arabic
  leaking into an English one; plus the shell, the `/ar` 308s, and that `/en`
  serves 200 without bypassing a role guard
- `verify:hero` — the cinematic mounts, scrubs both ways, survives a flick
- `verify:flows` — dashboard controls actually mutate and navigate
- `audit` — every route in real Chrome at desktop + phone: script errors,
  failed requests, unlabelled controls, heading order, overflow, RTL

The last four drive real Chrome and need the server up (`npm start &`). They
exist because HTTP 200 proves nothing: both dashboards once rendered an error
boundary on every route while returning 200, in Arabic, with a green build.
**Look at the page, or run the browser gates.**

Plus `npm run build` and `npm run lint`.

## Client-router navigations that never commit

A recurring, intermittent Next.js App Router failure in this codebase: a
`next/link` (or `router.push`/`replace`) navigation fetches the route's RSC
payload, returns 200, and then **silently declines to commit** — the URL never
changes, no console error, no failed request, no history entry. Retrying the
click does not reliably help; it has been observed swallowing four clicks over
ten seconds under load.

Hit three times so far, all fixed the same way — **use a plain `<a>`**:

- `/admin/catalogue` and `/admin/taxonomy` filter chips (same-pathname, search
  params only)
- `/admin/review` queue row → `/admin/review/[id]` (the operator's core action)

A plain anchor always commits. The cost is one server round trip on a control
that re-queries the database anyway. Reach for it whenever a navigation is
load-bearing — a filter, or a row that opens the thing the SLA depends on —
rather than assuming the click worked. `verify:journeys` covers these paths, so
a regression fails the suite rather than reaching an operator.

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

## Specs are the shared memory — update them with every change

`specs/` holds a functional spec per route (`specs/studio/`, `specs/admin/`, …).
They are how one session hands the truth to the next, so they must never lag the
code.

- **Read the route's spec before changing that route.** Not the code first —
  the spec first.
- **Update the spec in the same change**, not afterwards and not "later".
  Content, behaviour, layout, copy, controls, data shown, what's deliberately
  not wired — if the page changed, the spec changes with it.
- **A change is not done until its spec matches the shipped page.** This ranks
  alongside the verification gates, not below them.
- Keep the area `README.md` table accurate when a route is added, removed or
  repurposed.

A spec that describes a page that no longer exists is worse than no spec: the
next session trusts it and builds on a false premise.

## Git

Work on a branch, merge to `main` with `--no-ff`. `main` is the working checkout
in the project folder. Each portal/feature lands as its own reviewable commit.
