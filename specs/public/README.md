# Public area — catalogue, marketing, policy

Everything a signed-out visitor can reach. All of it lives under `app/(public)/`, which
wraps its children in `SiteChrome` (sticky header, `<main>`, footer) and reads the session
only to decide what the header shows.

**Copy is editable from admin (DEV-64b/c).** Every string on these routes comes from
`messages/*.json` through `translate()`, and the owner can override any of it at
[`/admin/content/copy`](../admin/admin-copy-group.md) — published edits show everywhere
within 15 s, `?copyPreview=<id>` shows an admin unpublished drafts. A spec that quotes a
string quotes the **default**; the live page may show an edit. The rules an edit must meet
(placeholders, length, direction, banned claims) are in that spec.

Three kinds of surface share this group:

- **Catalogue** — search, hubs and product pages. Read-only against `Album`, `Clip`,
  `Taxonomy`, `Collection`, `Creator`. Only `status='live'` albums and
  `ingestStatus='ready'` clips are ever visible, and `Clip.masterKey` is excluded from
  every query on every one of these routes.
- **Commerce** — `/cart`, `/cart/add`, `/checkout`, `/checkout/return`. These require authentication (via
  `redirect()` in the page, not middleware) and are the only public routes that mutate.
  The two frozen invariants — `OrderItem.clipManifestSnapshot` for entitlement and the
  commission fields — are taken exactly once, inside `checkout()` in `lib/orders.ts`.
- **Marketing and policy** — `/`, `/sell`, and the seven document pages, which render
  compile-time prose from `content/legal.ts` through `components/layout/document-page.tsx`.

Cross-cutting rules that apply to every route here: Arabic on the bare path and
English under `/en` (see [`../localisation.md`](../localisation.md)), RTL for
Arabic and LTR for English, logical properties only;
every preview frame carries `PreviewWatermark`; every album surface shows a price; a clip
is never purchasable on its own, so every clip surface carries its album ribbon. Every
poster, preview, trailer and the hero film is resolved by one function,
`lib/media.ts#mediaUrl` — never a raw key in `src`, never an ad-hoc `startsWith('/')`
check — and a key that does not resolve leaves the poster in place, never a broken
`<video>`. Public previews come from `Clip.previewKey`; `proxyKey` (the buyer's clean
editing copy) is never selected on a public surface.

## Routes

| Route | Purpose | Spec |
| --- | --- | --- |
| `/` | Scroll-scrubbed hero, problem/solution, footage wall, album collection, album trailers (hidden until one resolves), licensing, how-it-works, pricing/value, FAQ — the albums-only pitch | [index.md](index.md) |
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
| `/checkout/return` | Read-only payment status after Paymob's hosted checkout | [checkout-return.md](checkout-return.md) |
| `/boards/[token]` | Account-free shared shortlist for agency clients | [boards-token.md](boards-token.md) |
| `/sample` | The free sample album: claim once, signed in; every clip links to its album | [sample.md](sample.md) |
| `/sell` | Creator recruitment and the revenue-share pitch | [sell.md](sell.md) |
| `/about` | What Laqta is | [about.md](about.md) |
| `/contact` | Contact form (stored + mailed to the operator), plus WhatsApp, support email and company details once the owner sets them | [contact.md](contact.md) |
| `/terms` | Terms of service | [terms.md](terms.md) |
| `/privacy` | Privacy policy | [privacy.md](privacy.md) |
| `/licences` | Standard vs extended licence scope | [licences.md](licences.md) |
| `/content-policy` | What may be uploaded and sold | [content-policy.md](content-policy.md) |
| `/forbidden` | 403, reached by rewrite so the URL survives | [forbidden.md](forbidden.md) |

`/sign-in` and `/sign-up` also live in `app/(public)/` but belong to the auth area and are
specified there.

## Known gaps in this area

- **No refunds page, by decision (2026-09-23).** The public site says nothing about
  refunds — no policy, no "no refunds" line, no window. `/refunds`, its footer link,
  `footer.refunds`, `brand.seo.refunds` and `REFUNDS` were removed, and the old URL
  now 404s. Refund *tooling* stays in `/admin` (orders, `Refund`/`RefundLine`,
  frozen-rate reversal under `verify:money`) for the operator's own use. Do not add
  a refund page or any refund copy to a public surface without the owner.

- **Card / Apple Pay are built but dormant.** The Paymob driver, the signed callback
  and `/checkout/return` exist, but until the owner sets the `PAYMOB_*` variables
  `availableMethods()` returns `bank_transfer` only and every order still settles by
  hand from `/admin`. No real Paymob transaction has been run yet — USD charging on
  the owner's account is unconfirmed (see [`../api/payments-paymob.md`](../api/payments-paymob.md)).
- mada, Tabby and Tamara are not wired and never offered.
- `/albums` has no sort control, and the taxonomy hubs accept `?page=` with no pagination UI.
- `/contact` has a working form, but its WhatsApp number, support email, company name,
  Egyptian address and commercial registration number are **empty until the owner supplies
  them** (`content/contact.ts` / env). Each renders only once set; with none set the page is
  the form and guidance. The operator email needs `OPERATOR_EMAIL` and a mail provider —
  until then messages are read at `/admin/messages`.
- No HLS / adaptive preview playback. Previews are single progressive 720p MP4s
  (`Clip.previewKey`, made by `npm run media:previews`); `previewHlsKey` is selected in
  places and rendered nowhere.
- Media is wired to AWS S3 + CloudFront but only switched on by env
  (`docs/tech/media-aws.md`). Until `NEXT_PUBLIC_MEDIA_CDN_URL` is set, bucket keys resolve
  to nothing and pages show posters; the hero plays only where `public/hero/vid/` exists.
- The launch catalogue's previews are still the seed's hero-segment stand-ins (dev
  database) until real masters are run through `media:previews` + `media:upload`.
- No album has a trailer yet. Trailers are cut by hand (no auto-cut) and set per album
  from `/admin/catalogue` or `media:upload`; without one the PDP shows the album's own
  cover still. `Album.trailerUrl` is a dead legacy column — `trailerKey` is the field.
- `/cart/add` and `/boards/[token]` are covered by no automated gate.
