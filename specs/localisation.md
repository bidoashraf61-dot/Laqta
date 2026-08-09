# Localisation — Arabic and English

**Route/Access/Rendering** — cross-cutting; applies to every route in `app/`.
No route file exists twice: `middleware.ts` rewrites `/en/*` onto the bare route
before the router sees it.

## Purpose

Serve the whole public storefront in Arabic and English from one route tree,
with each language on its own indexable URL.

## The URL contract

| Path | Serves | Notes |
|---|---|---|
| `/albums` | Arabic | Arabic is the default and owns the bare path — the canonical form already indexed |
| `/en/albums` | English | Middleware **rewrites** to `/albums`; the address bar keeps `/en/albums` |
| `/ar/albums` | — | 308 → `/albums`. Retired prefix; must never 404 |

`/en` must **serve 200, never redirect**. A redirect there deletes the English
translation from the index.

Guards run on the **stripped** path, so `/en/admin` is guarded exactly as
`/admin` is. A locale prefix is never a way around a role.

## How a request resolves its language

1. `middleware.ts` matches the prefix and sets the request header
   `x-laqta-locale`.
2. Every route segment — page, layout, `loading.tsx`, `generateMetadata` —
   calls `await requestLocale()` as its first statement (`lib/locale-request.ts`).
3. That reads the header and writes a store scoped to the React render
   (`lib/locale.ts`, backed by React's `cache()`).
4. `t()` and `pickLocalised()` read that store synchronously.
5. Client components take the same value by **context** (`lib/i18n-client.tsx`)
   and call `useT()` / `useLocale()`.

### Why each segment resolves it itself

A route segment sits inside a Suspense boundary, so React can begin rendering a
page while the layout above it is still awaiting. Relying on the root layout
alone made a page's language depend on whether it happened to hit the database:
the header rendered English and the body Arabic on every synchronous page.
`requestLocale()` is a cached header read plus an idempotent write, so calling
it per segment is cheap and deterministic.

### Why client components need a separate channel

Server-rendering a client component is a **second** React render. `cache()`
scope does not span the two, so the RSC locale is invisible there. A module
variable would work in the browser and fail during SSR, where two requests in
different languages render concurrently and every Suspense boundary is a point
Node can interleave them. Context is per-render by construction.

## Where copy lives

| Source | Bilingual by | Notes |
|---|---|---|
| `messages/ar.json` / `messages/en.json` | `t('key')` | English falls back to Arabic per key, so a missing key renders Arabic — never a raw dot-path |
| `content/legal.ts` | `headingEn` / `bodyEn` / `listEn` | Falls back per section, as a unit |
| Database columns | `<Bilingual ar en />`, or `pickLocalised(ar, en)` outside JSX | Both fall back to Arabic when the English side is empty |

`pickLocalised` is for the places a component cannot go: `generateMetadata`,
JSON-LD, `alt`, `aria-label`, breadcrumb strings. Those attributes are where
Arabic leaked longest, because no visual review catches them.

## SEO

- **Canonical** — each page points at itself in its own language.
  `/en/albums` must not canonicalise to `/albums`, or the English page asks
  Google to index the Arabic one instead.
- **hreflang** — `ar`, `en` and `x-default` (Arabic) on both sides. Present on
  one side only, it is not believed.
- **Sitemap** — every URL emitted twice, each entry naming both in
  `alternates.languages`.
- `<html lang>` carries the bare subtag (`ar` / `en`); `Intl` uses the
  region-qualified tag (`ar-SA`).

## Controls

| Control | Element | Does |
|---|---|---|
| Language toggle | plain `<a>` in the site header | Switches to the same path in the other language, label in the **target** language (`EN` / `ع`) |

A plain anchor, not `next/link`: `dir` and `lang` live on `<html>`, which a
client-side navigation does not re-run — a soft switch would load English
strings into a document still marked `dir="rtl"`. (It also sidesteps the
client-router commit failure recorded in `CLAUDE.md`.)

## States

- **English key missing** — renders the Arabic string. Visible gap, working page.
- **English DB column empty** — renders the Arabic value. Content gap, not a blank.
- **No locale header** (build-time evaluation, a script) — Arabic.

## Invariants

1. Arabic owns the bare path. English is never served from it.
2. `/en` serves 200. Never a redirect.
3. Role guards evaluate the stripped path.
4. Every segment resolves the locale itself; none inherits it.
5. Fallback is always **towards Arabic**, never towards a blank or a dot-path.
6. In `content/legal.ts` the **Arabic governs**. The English is a convenience
   translation and must never be edited on its own.

## Deliberate gaps

- **`dash` / `admin` / `studio` namespaces are Arabic-only** (353 keys). The
  dashboards are operator tools behind auth and are not part of the English
  surface; `verify:arabic` skips them on the English pass. The five `dash.tier*`
  keys are translated because they render on the public `/sell` page.
- **`/en/about` is exempt** from the English-purity check. `العلا` / `العُلا`
  appear there on purpose, as the worked example of Arabic search variants
  reaching one record.
- **Neither language of `content/legal.ts` has been reviewed by counsel.**

## Verified by

`npm run verify:arabic` — now bidirectional. Arabic routes must contain no
un-isolated English; English routes must contain no Arabic. Also asserts the
document shell in both languages, the `/ar` 308s, that `/en` serves 200, and
that `/en/admin` still refuses a signed-out visitor.
