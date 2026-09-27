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
| `CopyOverride` rows (DEV-64b/c) — owner edits of any visitor-facing key (see [`admin-copy-group.md`](admin/admin-copy-group.md) for the groups; not `dash.*`/`studio.*`/`admin.*`) | inside `translate()` | Resolution per key: **preview draft** (admin preview render only) → **published override** → JSON → Arabic JSON. The JSON is never modified and is always the fallback; removing an override is how a string returns to it. Server components read a process-wide published map (refreshed in `requestLocale()`, ≤15 s old); client components get published + draft for their locale through `LocaleProvider`'s `copy` context, never a module global. See [`admin-copy-group.md`](admin/admin-copy-group.md) |
| `DocumentVersion` rows (DEV-64a) | `loadDocument(key)` | The long-form pages; falls back to `content/legal.ts` |
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
- **One helper:** every indexable page sets `alternates: localeAlternates(path)`
  (`lib/locale.ts`) — canonical and hreflang together. Until DEV-33 the album,
  clip, creator, collection, location and category pages set a bare Arabic
  canonical on both languages, so no English detail page was indexed. The root
  layout sets **no** `alternates`: whatever it set, every page without its own
  inherited (it once named the home page as every page's other language).
- **`og:locale`** — `ogLocale()`: `ar_SA` / `en_US`, the page's own language.
- **`generateMetadata` resolves the locale first** (`await requestLocale()`),
  like every page — the detail pages did not, and could put an Arabic
  `<title>` on the English page.
- **JSON-LD `url`** — the page's own-language address (`localePath`).
- **Not indexed:** robots.txt disallows the private pages in **both**
  languages (`/account`, `/studio`, `/admin`, `/cart`, `/checkout`,
  `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, each also
  under `/en`, plus `/api/`); `/boards/[token]` and `/forbidden` carry
  `robots: noindex, nofollow`.
- **Verified by `verify:seo`** (browser server; fetched as Googlebot, since
  Next streams metadata into the body for ordinary browsers): canonical,
  hreflang, `og:locale` and title language on the home, `/albums`, an album,
  a clip, a creator, a collection, a location, a category and `/terms`, both
  languages; and robots.txt.

## Controls

| Control | Element | Does |
|---|---|---|
| Language toggle | plain `<a>` in the site header, and in the mobile nav sheet | Switches to the same path in the other language, label in the **target** language (`EN` / `ع`) |

A plain anchor, not `next/link`: `dir` and `lang` live on `<html>`, which a
client-side navigation does not re-run — a soft switch would load English
strings into a document still marked `dir="rtl"`. (It also sidesteps the
client-router commit failure recorded in `CLAUDE.md`.)

### Internal links

Every internal link goes through `components/ui/link.tsx` — `Link` (wrapping
`next/link`) or `Anchor` (for the deliberate hard navigations). They prefix
`/en` when the locale is English and leave absolute URLs, `mailto:`, hashes and
already-prefixed paths alone.

**Import `Link` from `@/components/ui/link`, never from `next/link`.** A bare
`href="/albums"` on an English page navigates to the *Arabic* albums page: one
click and the reader is out of the translation with nothing to tell them why.
A helper applied per call site is a thing you can forget across ~130 hrefs;
the wrapper makes the correct behaviour the default.

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

Elements carrying an explicit `lang` are excluded from both passes: `lang` is
the standards-defined way to declare a foreign run, and it is what the audit
asks every foreign run to do. The language switcher is the honest case — its
label is deliberately in the language it switches to. `<html>` is excluded from
that exclusion, or the first match swallows the whole document and the check
silently becomes a no-op.
