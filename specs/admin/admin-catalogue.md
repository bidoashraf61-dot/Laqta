# Catalogue

**Route** `/admin/catalogue` · **Access** admin only · **Rendering** server, dynamic (`searchParams` + `auth()`)

## Purpose
Everything that has been through review, with the two escalations that skip the queue —
pause (reversible) and delist (final) — plus feature toggling, setting each album's
trailer, and a read-only view of the price bands.

## Data in
- `searchParams.q` — case-insensitive `contains` over `titleAr`, `titleEn`,
  `creator.displayNameAr`.
- `searchParams.status` — accepted if in `statusValues('album')`
  (`draft, in_review, changes_requested, live, paused, delisted`); otherwise the default
  filter `status in [live, paused, delisted]` applies. Note: filtering explicitly by
  `draft` / `in_review` **is** possible via the chips even though the default hides them.
- `Album.findMany` — `orderBy [isFeatured desc, publishedAt desc]`, `take: 100`,
  selecting id, slug, titles, status, clipCount, priceStandard, currency, isFeatured, trailerKey,
  salesCount, clearedForCommercial, `creator` (handle, displayNameAr).
- `Album.groupBy({ by: ['status'] })` — chip counts.
- `PriceBand.findMany({ orderBy: { priceStandard: 'asc' } })` — the bands panel
  (labelAr, minClips, maxClips, priceStandard, currency, extendedMultiplier).

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| `SearchBox` | GET form / `?q=` | re-queries the table |
| `FilterChips` | plain `<a>` to `?status=` | re-queries the table |
| Album title | link | → `/albums/{creator.handle}/{album.slug}` |
| «التريلر» (every row, including delisted) | opens a popover (`TrailerEditor`) with one field, «مفتاح التريلر في مكتبة الوسائط», prefilled with `trailerKey`, and the conventional key `trailers/{slug}.mp4` shown as `<code>` | — |
| Trailer popover → «حفظ» | `saveAlbumTrailer` (`SettingsForm`) | Validates with `lib/media.ts#isPublicMediaKey` — a media-bucket key, a URL on the media CDN, or a "/"-rooted dev path; `masters/`, `proxies/`, `albums/`, `documents/`, traversal and foreign URLs are refused with `dash.trailerInvalid`. Empty clears it. Writes `Album.trailerKey`, audits `album.trailer_set` / `album.trailer_cleared` (detail: the key), revalidates `/admin/catalogue` and the album page. Success copy: `dash.saved`; `dash.trailerNoCdn` when the key cannot resolve yet because `NEXT_PUBLIC_MEDIA_CDN_URL` is unset; `dash.trailerCleared` on clear |
| «إيقاف» (only when `status === 'live'`) | `setAlbumStatus(id,'paused')` | `Album.status='paused'`. Audits `album.paused` |
| «استئناف» (only when `status === 'paused'`) | `setAlbumStatus(id,'live')` | `Album.status='live'`. Audits `album.live` |
| «تمييز» (hidden when delisted) | `toggleAlbumFeatured(id, !isFeatured)` | sets `isFeatured` and `featureRank` (`0` when featured, `null` when not); revalidates `/admin/merchandising` and `/` |
| «شطب» (hidden when delisted) | `setAlbumStatus(id,'delisted')`, native confirm | `Album.status='delisted'`, `delistedAt=now`. Audits `album.delisted` |
| Price bands table | — | **read-only**; there is no editor for `PriceBand` anywhere in the admin area |

## States
- **Empty result** — `EmptyState` with `state.empty` / `dash.catalogueHint`.
- **Delisted album** — every action button is hidden; the row is terminal from this
  surface. There is no un-delist control.
- **Cleared for commercial** — a small success-tone line under the title.
- **Trailer state** — a muted line under the title, «له تريلر» (`dash.trailerSet`) or
  «بلا تريلر» (`dash.trailerNone`). Stated in words, not by icon colour.
- **Trailer is a key, not an upload.** The file must already be in the media bucket
  (`npm run media:upload` from `.media/out/trailers/<slug>.mp4` does both steps and sets the
  key itself); this field only points the album at it.
- **Featured** — a filled gold star beside the status badge.
- **Pending** — `ActionButton` spinner + disabled, then toast + `router.refresh()`.
- **Truncation** — hard `take: 100`, no pagination.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- A **«معاينات حُمّلت»** column counts `CompDownload` rows per album over the last 30 days (a ZIP counts once) — people testing the album in their own edit, a buying-intent signal. Read-only.
- Pausing or delisting an album **cannot break a completed purchase**: entitlement is
  served from `OrderItem.clipManifestSnapshot`, never re-derived from the album.
- Price bands are shown but not editable — changing a band would reprice live albums; the
  page states this in `dash.priceBandsHint`.
- Every mutation writes an `AuditLog` row.

## Verified by
`verify:arabic`, `audit`, `verify:flows` (filter-chip navigation on `/admin/catalogue`).
The entitlement snapshot rule is covered by `verify:entitlement`. The trailer key
validation (`isPublicMediaKey`) is unit-tested in `tests/unit/media.test.ts`; the popover
and `saveAlbumTrailer` round trip are covered by no gate (the popover is closed by default,
so `verify:arabic`/`audit` see only its labelled trigger).
