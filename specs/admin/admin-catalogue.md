# Catalogue

**Route** `/admin/catalogue` · **Access** admin only · **Rendering** server, dynamic (`searchParams` + `auth()`)

## Purpose
Everything that has been through review, with the two escalations that skip the queue —
pause (reversible) and delist (final) — plus feature toggling, setting each album's
trailer, the price band editor, and the price calculator's settings (DEV-09c).

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
| Band form → «حفظ» | `savePriceBand` (`SettingsForm`) | Validates with `lib/price-bands.ts#validateBand` (labels required; counts positive integers; min ≤ max; price within the configured range in whole cents (`dash.bandPriceRange` «سعر الشريحة بين {min} و{max} دولار، مثل أسعار الألبومات.»); one band per tier; no overlapping clip range with another band — «هذا المدى يتداخل مع شريحة «…».»). Writes `PriceBand` only; audits `priceband.update` with before/after. Success: «حُفظت الشريحة. لم يتغير سعر أي ألبوم.» Revalidates `/admin/catalogue` and `/studio/albums/new` |
| Band form → «حذف» | `deletePriceBand(id)`, native confirm «حذف هذه الشريحة؟ لن تُقترح بعد الآن، والألبومات تحتفظ بسعرها.» | Deletes the `PriceBand`; audits `priceband.delete` with the old values. That clip range then has no suggested price on the review page |
| «إضافة شريحة» (only while a tier has no band) | opens the new-band form, with a «الفئة» select of the free tiers | `savePriceBand` without an id → `PriceBand.create` with `currency: 'USD'`; audits `priceband.create`. When all four tiers have bands the button is replaced by «كل الفئات الأربع لها شرائح. عدّل واحدة أو احذفها.» |

## Offers (DEV-60)
An offer is a sale price on one album with optional dates: `Album.offerPrice`,
`offerStartsAt` (NULL = now), `offerEndsAt` (NULL = until removed), `offerLabelAr/En`.
`priceStandard` is always the **regular** price. Whether an offer is running is decided at
read time by `lib/offers.ts` (`priceNow`, `offerRunning`, `offerRunningWhere`) — no job
flips it, so it starts and ends on its dates. (Migration `album_offers` moved the old
`compareAtPrice` model over: the sale price to `offerPrice`, the regular to `priceStandard`.)

| Control | Action | Effect |
|---|---|---|
| Row «عرض» / «تعديل العرض» (every non-delisted album) | opens `OfferEditor` popover (`components/admin/offer-editor.tsx`; scrolls inside itself, `max-h` = available height) | Fields: «سعر العرض (دولار)» (required, > 0 and < regular; hint «أقل من السعر المعتاد: {price} دولار.»), «وسم العرض بالعربي» (required, ≤40), «وسم العرض بالإنجليزي» (optional, falls back to Arabic), «يبدأ» / «ينتهي» (`datetime-local` in the owner's clock, sent as ISO instants in hidden fields; blank = now / no end) |
| «حفظ العرض» | `saveAlbumOffer` | Refuses a price outside (0, regular) «سعر العرض أكبر من صفر وأقل من السعر المعتاد…», a missing Arabic label, an end not after the start or not in the future «تاريخ النهاية يكون بعد البداية وفي المستقبل.»; writes the five columns; audits `album.offer.set` (before/after); revalidates the catalogue and the storefront; «حُفظ العرض.» |
| «إنهاء العرض» (when an offer is set; native confirm «إنهاء العرض الآن؟ يرجع الألبوم لسعره المعتاد.») | `removeAlbumOffer(albumId)` | Clears the five columns; audits `album.offer.remove`; «انتهى العرض، ورجع الألبوم لسعره المعتاد.» |
| Price column | — | The regular price (gold) and, when an offer is set, its price and state «جارٍ الآن» / «مجدول» / «انتهى» |
| Panel «العروض» | — | Every non-delisted album with an offer set, ordered by end date: title, «من {date}» / «حتى {date}» or «بلا تاريخ نهاية», the offer price with the regular struck, and its state. Empty: «ما فيه ألبوم عليه عرض. أضف عرضاً من صف الألبوم في الجدول.» |

The storefront (album cards, album page, landing offers rail, clip pages, boards, search),
the cart and `checkout()` all read `priceNow`: inside the window a buyer sees and pays the
offer price with the regular struck; outside it the regular price. Past orders keep what
they paid. Price sorting and the price filter in search still use the regular price.

## Special price (DEV-61)
| Control | Action | Effect |
|---|---|---|
| Row «السعر» (live and paused albums) | opens `PriceEditor` popover (`components/admin/price-editor.tsx`, scrolls within the screen) | «السعر المعتاد (دولار)» pre-filled with `priceStandard`; hint «أي مبلغ تحدده أنت، حتى خارج نطاق الحاسبة…», or, with an offer set, «أي مبلغ أعلى من سعر العرض ({price} دولار)…»; «السبب (اختياري، يُحفظ في سجل التدقيق)» |
| «حفظ السعر» | `setAlbumPrice` → `lib/album-price.setRegularPrice` | Any amount > 0 and ≤ 100,000 in whole cents, **outside the calculator range if the owner chooses** (that range governs approval only). Refused: a draft / in-review / delisted album «يُحدَّد سعر الألبوم عند اعتماده…»; zero or malformed «اكتب سعراً أكبر من صفر.»; at or under a set offer «السعر المعتاد لازم يكون أعلى من سعر العرض…». Writes `priceStandard`; audits `album.price.set` {from, to, reason}; revalidates the catalogue and storefront; «حُفظ السعر الجديد.» Past orders keep the gross they paid |

## Price calculator settings (DEV-09c)
Panel «حاسبة السعر» under the bands (`components/admin/pricing-settings.tsx`). **All
dropdowns — no typed numbers** (owner, 2026-09-27). Read from
`lib/pricing-config.loadPricingChoices()`: the one `PricingSetting` row (`id = 'default'`),
whose `config` JSON stores the owner's *choices*; `toConfig()` turns them into the numbers the
calculator runs on (`lib/pricing-config-shared.ts`, pure, so the panel computes live). An
unknown or missing value falls back to the default choice.

| Control | Choices | Effect |
|---|---|---|
| «أهمية الدقة في السعر» | منخفضة / متوسطة / عالية | 720p · 1080p · 4K = 0.8·1·1.15 / **0.6·1·1.3** / 0.5·1·1.5 |
| «أهمية نوع اللقطات في السعر» | same | AI 2D · AI 3D · AI live · filmed = 0.9·0.95·1·1.1 / **0.8·0.9·1·1.25** / 0.65·0.8·1·1.5 |
| «أهمية الجودة في السعر» | same | standard · good · exceptional = 0.95·1·1.05 / **0.9·1·1.15** / 0.8·1·1.3 |
| «أقل سعر للألبوم» | $29 / **$49** / $69 | Lower price limit |
| «أعلى سعر للألبوم» | $199 / **$249** / $299 | Upper price limit |
| «هامش اقتراح الصانع» | ±10% / **±15%** / ±20% | How far a creator's recommendation may sit from the suggestion |
| Multiplier line under each grade | live | The numbers the chosen grade stands for, each label isolated with `<bdi>` |
| Example line | live | «مثال: ٥٠ لقطة، 4K، ذكاء اصطناعي واقعي، جودة جيدة: $X» + «ويقترح الصانع ضمن: $low – $high», same `suggestPrice` as the creator's form |
| «حفظ إعدادات السعر» | `savePricingSettings` (`SettingsForm`) | `parsePricingForm` refuses any value not in its list («اختر من القوائم فقط.»); upserts the row; audits `pricing.update` with before/after choices; «حُفظت إعدادات السعر. تسري على الحساب القادم.» |

Bold = the default, which equals the numbers agreed on 2026-09-27 (`verify:pricing` asserts
it), so an untouched panel changes nothing. A change reaches the next calculation only: the
creator's calculator, the range checked when a recommendation is saved and when an album is
submitted, the approve/propose range on `/admin/review/[id]`, the band editor's price
limits and the `/sell` FAQ range. Live albums keep their approved price; completed orders
never move. Setting a special price on one album, offers, bundles and promo codes are
DEV-60 – DEV-63.

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
- **Where a trailer shows** — on the album page, and (for a `live` album whose key resolves)
  in the landing page's trailer section (`specs/public/index.md`, §4b). The landing is
  dynamic, so no revalidation is needed for it; setting the first resolvable trailer makes
  that section appear.
- **Featured** — a filled gold star beside the status badge.
- **Band outside the album range** — a warning «خارج مدى الألبوم» badge on any band whose clip
  range is not wholly inside 30–70, plus one warning line under the hint: «الألبوم الآن من
  30 إلى 70 لقطة وبوابة الاستوديو تفرض ذلك، فالشريحة المعلَّمة يقع جزء من مداها أو كله
  خارج ما يمكن أن يكونه ألبوم جديد.» (Re-cut 2026-09-27, DEV-09: the seed now gives 30–39 $79, 40–49 $119, 50–59 $159,
  60–70 $199, all inside — nothing is flagged unless a band is edited out of range.)
- **Band validation error** — inline destructive alert above that band's fields.
- **Pending** — `ActionButton` spinner + disabled, then toast + `router.refresh()`.
- **Truncation** — hard `take: 100`, no pagination.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- A **«معاينات حُمّلت»** column counts `CompDownload` rows per album over the last 30 days (a ZIP counts once) — people testing the album in their own edit, a buying-intent signal. Read-only.
- Pausing or delisting an album **cannot break a completed purchase**: entitlement is
  served from `OrderItem.clipManifestSnapshot`, never re-derived from the album.
- **Bands are a suggestion, and a band edit reprices nothing** (DEV-09). The operator sets
  each album's price at approval on `/admin/review/[id]`; the band whose clip range holds the
  album's count only pre-fills that field. A creator never picks a band. So an edit changes
  the next suggestion and nothing else — every album keeps the price it was approved at, and
  completed orders keep the gross/VAT/commission frozen on each `OrderItem`
  (lib/orders.ts). The page says so in `dash.priceBandsHint`: «الشرائح اقتراح فقط: تملأ
  خانة السعر في صفحة المراجعة حسب عدد لقطات الألبوم، وأنت تحدّد السعر النهائي عند
  الاعتماد. تعديلها لا يغيّر سعر أي ألبوم، والطلبات المكتملة لا تتغير أبداً.»
- The owner's 2026-08-20 decision that a band edit "reprices live albums and notifies
  their creators" is superseded by per-album pricing at approval. Spec B's creator price
  acceptance is still not built.
- Currency is not editable: USD only at launch (owner, 2026-09-24).
- Every mutation writes an `AuditLog` row.

## Verified by
`verify:offers` (none / open / scheduled / ended / at-or-above-regular on plain values; the running filter; checkout charges the offer inside its dates and the regular price before and after; DEV-61: a regular price at or under the offer and a zero price are refused, a price outside the calculator range is accepted and charged, the change is audited, a draft cannot be priced by hand). `verify:pricing` (settings: default choices equal the agreed numbers; none saved → defaults; a saved grade applies and unknown values fall back; the calculator follows a grade; the dropdowns parse and refuse values outside their lists; a custom range moves what may be approved). `verify:arabic`, `audit`, `verify:flows` (filter-chip navigation on `/admin/catalogue`;
band editor: min > max refused with nothing written, a price edit persists, no album's
price and no order total moves, the edit is audited, and the price restores).
The entitlement snapshot rule is covered by `verify:entitlement`. The trailer key
validation (`isPublicMediaKey`) is unit-tested in `tests/unit/media.test.ts`; the popover
and `saveAlbumTrailer` round trip are covered by no gate (the popover is closed by default,
so `verify:arabic`/`audit` see only its labelled trigger).
