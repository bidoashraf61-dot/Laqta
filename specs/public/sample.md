# Free sample album

**Route** `/sample` (+ `/en/sample`) · **Access** public page; claiming needs a signed-in account · **Rendering** server component, dynamic (`auth()`, DB)

## Purpose
Owner decision 2026-09-24: a free album of clips picked from every album, for **signed-in accounts only, once each**. It grows sign-ups and lets a buyer judge real quality; every clip names and links the album it is sold in, so the sample sends visitors to albums.

## Data in
- `getPublicSample()` (`lib/sample.ts`): the one `SampleAlbum` (a house `Album`, slug `laqta-free-sample`, owned by the house `Creator` `laqta-house`, `isHouse`, status `suspended`), only when `isPublished`, and only its `SampleClip`s whose own album is **live**. An admin gets the unpublished sample too (`includeDraft`).
- The house album stays `status: 'draft'` for life, so no `status: 'live'` query (listings, search, sitemap, cart) ever shows it; publication is `SampleAlbum.isPublished`.
- `sampleEntitlementFor(userId, albumId)` — has this user already claimed it.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| «خذ العيّنة مجاناً» (signed in, not claimed) | `claimSampleAction` → `lib/orders.ts#claimSample(userId, { deferDocuments: true })` | A zero-value order through the frozen path (see Invariants), then redirect to `/account/library/[entitlementId]` |
| «سجّل دخولك وخذها» (signed out) | Link | `/sign-in?callbackUrl=/sample` (locale prefix kept) |
| «افتح المكتبة» (already claimed) | Link | `/account/library/[entitlementId]` |
| «شوف الألبوم كامل» per clip | Link | The clip's source album page |

Entry points: a banner on `/albums` («جرّب قبل ما تشتري: {clips} مجاناً من ألبومات لقطة.» → «شوف العيّنة»), a link under the buy panel on every album page («جرّب لقطات مجانية من العيّنة»). Both render only when the sample is public.

## States
- **No sample / unpublished / no clip in a live album** → `notFound()` (404) for visitors; the banner and album-page link are hidden. Ordinary, not an error.
- **Admin, unpublished** → the page renders with a warning line «معاينة للإدارة: العيّنة غير منشورة…».
- **Signed out** → gold sign-in button and a line that you return here after signing in.
- **Signed in, not claimed** → gold «خذ العيّنة مجاناً».
- **Claimed** → «العيّنة في مكتبتك.» + «افتح المكتبة». A revoked claim is not re-granted.
- **`?claim=unavailable`** (the sample was unpublished between render and claim) → «العيّنة مو متوفرة الحين.».
- Body copy: the sample's own description if set, else «{clips} مختارة من ألبومات لقطة، بالنسخة الأصلية وترخيص تجاري كامل. مجانية لكل حساب، مرة واحدة.» — `{clips}` from `countOf('clip', n)` (`lib/i18n.ts`, DEV-22), which applies Arabic number agreement (لقطة واحدة / لقطتان / ٣–١٠ لقطات / ١١–٩٩ لقطة / ١٠٠ لقطة).

## Invariants
- **A claim is an ordinary frozen entitlement.** One `Order` (`paymentMethod: 'sample'`, total 0), one `OrderItem` with `clipManifestSnapshot` = the curated clips *at claim time*, each carrying `sourceAlbum`, and the licence in force; one `Entitlement`; one `LicenceCertificate`; then the same `settleOrder` as every purchase. No cart, no payment gateway (no Paymob intention for 0).
- **Once per user.** `Entitlement` is unique on (user, album); a second claim returns the first entitlement, and two concurrent claims resolve to one.
- **No money moves.** A zero-value line posts no `CreatorLedger` row; a zero-value order raises no tax `Invoice`; commission is stated as 0 (`commissionBasis.kind = 'free_sample'`), never computed.
- **Curation never changes what someone already owns** — only what the next claimant gets.
- **Licence (owner-confirmable default):** the sample is given under the same full commercial licence as any album, and the copy says so. If the owner wants a narrower licence for free clips, this page, the email and the certificate change together.
- The claim email is its own template, `sample.claimed` (not a receipt: no totals), with the certificate.

## Verified by
`verify:sample` (in `npm run verify`): unpublished → not public and not claimable; published → public with its clips; first claim → paid order of 0, no invoice, commission 0, no ledger row, manifest = curated clips in order; second claim → same entitlement, one order line; curating afterwards leaves the buyer's manifest unchanged; the library marks it as the sample and every clip names its source album. **Not in** `verify:arabic` / `audit` route lists, because `/sample` 404s until the owner publishes a sample — add it once one is live.
