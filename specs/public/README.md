# Public area — catalogue, marketing, policy

Everything a signed-out visitor can reach. All of it lives under `app/(public)/`, which
wraps its children in `SiteChrome` (sticky header, `<main>`, footer) and reads the session
only to decide what the header shows.

Three kinds of surface share this group:

- **Catalogue** — search, hubs and product pages. Read-only against `Album`, `Clip`,
  `Taxonomy`, `Collection`, `Creator`. Only `status='live'` albums and
  `ingestStatus='ready'` clips are ever visible, and `Clip.masterKey` is excluded from
  every query on every one of these routes.
- **Commerce** — `/cart`, `/cart/add`, `/checkout`. These require authentication (via
  `redirect()` in the page, not middleware) and are the only public routes that mutate.
  The two frozen invariants — `OrderItem.clipManifestSnapshot` for entitlement and the
  commission fields — are taken exactly once, inside `checkout()` in `lib/orders.ts`.
- **Marketing and policy** — `/`, `/sell`, and the seven document pages, which render
  compile-time prose from `content/legal.ts` through `components/layout/document-page.tsx`.

Cross-cutting rules that apply to every route here: Arabic on the bare path and
English under `/en` (see [`../localisation.md`](../localisation.md)), RTL for
Arabic and LTR for English, logical properties only;
every preview frame carries `PreviewWatermark`; every album surface shows a price; a clip
is never purchasable on its own, so every clip surface carries its album ribbon.

## Routes

| Route | Purpose | Spec |
| --- | --- | --- |
| `/` | Scroll-scrubbed hero, problem/solution, footage wall, album collection, licensing, how-it-works, pricing/value, FAQ — the albums-only pitch | [index.md](index.md) |
| `/footage` | Clip search with URL-driven filters, sort and pagination | [footage.md](footage.md) |
| `/footage/[slug]` | One clip, crawlable, funnelling to its album | [footage-slug.md](footage-slug.md) |
| `/albums` | Every live album as a priced poster card | [albums.md](albums.md) |
| `/albums/[creator]/[slug]` | The PDP: full clip grid, both licence tiers, clearance | [albums-creator-slug.md](albums-creator-slug.md) |
| `/categories/[slug]` | Category SEO hub with its clips | [categories-slug.md](categories-slug.md) |
| `/locations/[slug]` | Location SEO hub — the main differentiator surface | [locations-slug.md](locations-slug.md) |
| `/collections` | Published editorial collections | [collections.md](collections.md) |
| `/collections/[slug]` | The live albums inside one collection | [collections-slug.md](collections-slug.md) |
| `/creators` | Approved creators with at least one live album | [creators.md](creators.md) |
| `/creators/[handle]` | One creator's bio and live shelf | [creators-handle.md](creators-handle.md) |
| `/cart` | Review lines, change licence tier, remove | [cart.md](cart.md) |
| `/cart/add` | GET add-to-cart that always redirects | [cart-add.md](cart-add.md) |
| `/checkout` | Billing entity, payment method, and the order freeze | [checkout.md](checkout.md) |
| `/boards/[token]` | Account-free shared shortlist for agency clients | [boards-token.md](boards-token.md) |
| `/sell` | Creator recruitment and the revenue-share pitch | [sell.md](sell.md) |
| `/about` | What Laqta is | [about.md](about.md) |
| `/contact` | The four support channels (described, not wired) | [contact.md](contact.md) |
| `/terms` | Terms of service | [terms.md](terms.md) |
| `/privacy` | Privacy policy | [privacy.md](privacy.md) |
| `/licences` | Standard vs extended licence scope | [licences.md](licences.md) |
| `/content-policy` | What may be uploaded and sold | [content-policy.md](content-policy.md) |
| `/refunds` | Refund window and process | [refunds.md](refunds.md) |
| `/forbidden` | 403, reached by rewrite so the URL survives | [forbidden.md](forbidden.md) |

`/sign-in` and `/sign-up` also live in `app/(public)/` but belong to the auth area and are
specified there.

## Known gaps in this area

- No payment gateway. `availableMethods()` returns `bank_transfer` only; every order
  settles by hand from `/admin`.
- No HLS preview playback. `previewHlsKey` is selected everywhere and rendered nowhere —
  the catalogue shows stills.
- No auto-cut album trailer. `Album.trailerUrl` is unread; the PDP uses the first clip's poster.
- `/contact` has no form or address, `/albums` has no sort control, and the taxonomy hubs
  accept `?page=` with no pagination UI.
- `/cart/add` and `/boards/[token]` are covered by no automated gate.
