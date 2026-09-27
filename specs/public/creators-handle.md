# Creator profile

**Route** `/creators/[handle]` · **Access** public · **Rendering** server component, dynamic

## Purpose
One creator's public shelf: who they are and every live album they have.

## Data in
- `Creator` where `handle = params.handle` AND `status='approved'`. Selects `handle`, `displayNameAr/En`, `bioAr`, `city`, `country`.
- Nested `albums` where `status='live'`, ordered `publishedAt desc`, selecting `slug`, titles, `priceStandard`, `currency`, `clipCount`, `totalRuntimeS`, `clearedForCommercial`, `coverClipId`.
- Second query resolves cover posters from `Clip.thumbnailKeys[0]`.

- **SEO (DEV-33)** — `alternates: localeAlternates(path)`: canonical is this page in this language, hreflang names both; `og:locale` via `ogLocale()`; `generateMetadata` resolves the locale first. Checked by `verify:seo`.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| Album card | Link | `/albums/{handle}/{slug}` |

Read-only. There is no follow, contact or message control.

## States
- **Unknown handle or creator not approved** — `notFound()` → 404; metadata returns `state.notFound`.
- **Approved creator with no live albums** — the profile still renders (header, bio) with `EmptyState` beneath. Note the index page at `/creators` would not have linked here in that case.
- **No bio** — bio paragraph omitted.
- **No city** — the `city · ` prefix is dropped. `country` is selected but never rendered.
- **Avatar** — first character of `displayNameAr` in a circle; there is no avatar image.

## Invariants
- Stat tiles are headed «الألبومات المنشورة» / «اللقطات في المكتبة» / «زيارات ألبوماته» (EN "Albums published" / "Clips in the library" / "Visits to their albums") — titles, not nouns that must agree with the figure. The rating tile's accessible label reads «{value} من ٥ · ١٢ تقييماً» through `countOf('rating', n)` (DEV-22).
- Emits **`ProfilePage` + `Person`** schema. On a marketplace the creators ARE the expertise signal — E-E-A-T's first two letters — and the page was full of authorship evidence with no way for an engine to read it as a person.
- **Public analytics only.** Albums, clips, views and join date are the creator's shopfront and help a buyer judge them. Sales counts and revenue are deliberately NOT shown: that is the creator's commercial position, and publishing it on a profile they cannot opt out of would expose it to their own clients and competitors.
- Featured albums render as their own section above the full list, so a creator's best work is not buried by recency order.
- The avatar falls back to an initial in a labelled `role="img"` span, never an empty circle — `Creator` has no avatar field of its own and reads `user.image`, which is frequently null.
- Only approved creators are reachable, and only their live albums are listed.
- Every card shows a price and carries `PreviewWatermark`.
- No earnings, balance or commission figure appears on this surface.

## Verified by
`verify:arabic` (via `/creators/yousef-shami`), `audit`.
