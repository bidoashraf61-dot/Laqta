# Catalogue

**Route** `/admin/catalogue` · **Access** admin only · **Rendering** server, dynamic (`searchParams` + `auth()`)

## Purpose
Everything that has been through review, with the two escalations that skip the queue —
pause (reversible) and delist (final) — plus feature toggling, setting each album's
trailer, and the price band editor.

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
  (tier, labelAr, labelEn, minClips, maxClips, priceStandard, currency).
- `Album.groupBy({ by: ['tier'] })` over non-delisted, non-sample albums — the
  «ألبومات بهذه الفئة» count on each band (context only; those albums do not move).
- `lib/price-bands.ts#bandFit` — each band against the 30–70 clip album
  (`MIN_ALBUM_CLIPS` / `MAX_ALBUM_CLIPS` in `lib/studio.ts`).

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
| Band row «تعديل» | opens that band's form (disclosure) | Fields: «اسم الشريحة», «الاسم بالإنجليزية», «أقل عدد لقطات», «أكثر عدد لقطات» (blank = open-ended, hint «اتركه فارغًا لشريحة مفتوحة من الأعلى.»), «السعر بالدولار». The tier is fixed on an existing band |
| Band form → «حفظ» | `savePriceBand` (`SettingsForm`) | Validates with `lib/price-bands.ts#validateBand` (labels required; counts positive integers; min ≤ max; 0 < price ≤ 100000; one band per tier; no overlapping clip range with another band — «هذا المدى يتداخل مع شريحة «…».»). Writes `PriceBand` only; audits `priceband.update` with before/after. Success: «حُفظت الشريحة. الألبومات الحالية لم يتغير سعرها.» Revalidates `/admin/catalogue` and `/studio/albums/new` |
| Band form → «حذف» | `deletePriceBand(id)`, native confirm «حذف هذه الشريحة؟ لن يختارها أحد لألبوم جديد، والألبومات الحالية تحتفظ بسعرها.» | Deletes the `PriceBand`; audits `priceband.delete` with the old values. The tier disappears from `/studio/albums/new` |
| «إضافة شريحة» (only while a tier has no band) | opens the new-band form, with a «الفئة» select of the free tiers | `savePriceBand` without an id → `PriceBand.create` with `currency: 'USD'`; audits `priceband.create`. When all four tiers have bands the button is replaced by «كل الفئات الأربع لها شرائح. عدّل واحدة أو احذفها.» |

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
- **Band outside the album range** — a warning «خارج مدى الألبوم» badge on any band whose clip
  range is not wholly inside 30–70, plus one warning line under the hint: «الألبوم الآن من
  30 إلى 70 لقطة وبوابة الاستوديو تفرض ذلك، فالشريحة المعلَّمة يقع جزء من مداها أو كله
  خارج ما يمكن أن يكونه ألبوم جديد.» (The seeded bands are 8–11, 12–19, 20–34 and 35+, so all four are flagged
  until the owner re-cuts them.)
- **Band validation error** — inline destructive alert above that band's fields.
- **Pending** — `ActionButton` spinner + disabled, then toast + `router.refresh()`.
- **Truncation** — hard `take: 100`, no pagination.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- A **«معاينات حُمّلت»** column counts `CompDownload` rows per album over the last 30 days (a ZIP counts once) — people testing the album in their own edit, a buying-intent signal. Read-only.
- Pausing or delisting an album **cannot break a completed purchase**: entitlement is
  served from `OrderItem.clipManifestSnapshot`, never re-derived from the album.
- **A band edit reprices nothing that exists.** A band's price is copied onto
  `Album.priceStandard` only when a creator creates a draft (`createAlbum` in
  `app/(studio)/studio/actions.ts`); nothing re-reads it. So an edit changes the price of
  albums created afterwards — live, paused and draft albums keep theirs, and completed
  orders keep the gross/VAT/commission frozen on each `OrderItem` (lib/orders.ts). The
  page says so in `dash.priceBandsHint`: «تعديل الشريحة يسري على الألبومات التي تُنشأ
  بعده فقط. الألبومات الحالية، المعروضة منها والمسودات، تحتفظ بسعرها، والطلبات
  المكتملة لا تتغير أبدًا.»
- The owner's 2026-08-20 decision that a band edit "reprices live albums and notifies
  their creators" is **not implemented** — it needs the creator notification (and Spec B's
  price acceptance) first. See the README's dead ends.
- Currency is not editable: USD only at launch (owner, 2026-09-24).
- Every mutation writes an `AuditLog` row.

## Verified by
`verify:arabic`, `audit`, `verify:flows` (filter-chip navigation on `/admin/catalogue`;
band editor: min > max refused with nothing written, a price edit persists, no album's
price and no order total moves, the edit is audited, and the price restores).
The entitlement snapshot rule is covered by `verify:entitlement`. The trailer key
validation (`isPublicMediaKey`) is unit-tested in `tests/unit/media.test.ts`; the popover
and `saveAlbumTrailer` round trip are covered by no gate (the popover is closed by default,
so `verify:arabic`/`audit` see only its labelled trigger).
