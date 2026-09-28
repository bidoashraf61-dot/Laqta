# Licence certificate

**Route** `/account/certificates/[orderItemId]` · **Access** the buyer who owns the order item · **Rendering** route handler, dynamic

## Purpose
Serve the PDF a buyer submits when someone claims rights over footage they
bought. Of the three ways a copyright problem arrives — an automated Content ID
match, a manual complaint, and a lawsuit — this answers the middle one, which is
the realistic case for stock footage.

## Data in
- `auth()` session — `session.user.id`.
- `OrderItem` → `certificate` (number, `pdfKey`) and `order` (owner, status, the
  buyer's locale).
- The file itself from `documentPath(key)`, outside `public/`.

## Controls
None — a GET that returns a document. Linked from `/account/library/[id]`.

## States
- **Signed out** — `middleware.ts` 307s to `/sign-in?callbackUrl=…` before the
  handler runs.
- **Not the owner, unknown id, or no certificate** — `404`, identically. The
  distinction between "not yours" and "does not exist" is a way to enumerate
  other people's orders.
- **Order not paid** — `403`. An unpaid order has no licence to certify.
- **`pdfKey` empty** — generated on demand, then stored. Covers a render that
  failed at purchase and orders that predate the feature.
- **Render fails** — `503`, and the library page still shows every download.

## The document (DEV-27, 2026-09-28)
Title «شهادة ترخيص» / "Licence certificate" and the number, then one row each:
«المرخَّص له» (licensee), **«المرخِّص» (licensor)** — `licensorLine()`: the brand, plus
the registered company name and CR number once `CONTACT_COMPANY_NAME_*` /
`CONTACT_CR_NUMBER` are set (the brand alone until then, never a placeholder),
«الألبوم», **«طريقة الإنتاج»** (filmed / AI-generated, from `Album.origin`),
«صانع المحتوى», «عدد اللقطات», «رقم الطلب», «تاريخ الإصدار», «نوع الترخيص»; then
«نص الترخيص» — the `LicenceVersion` body frozen on the order item — and the footer
`email.certificateFooter`. Labels are the `certificate.*` keys: singular, and no
«(اختياري)» (the old rows borrowed checkout and catalogue labels). Numbers are
inline isolated spans, so they sit on the reading side in Arabic.
**Still open (DEV-27):** the licence text itself is the short `LicenceVersion`
body until the lawyer's full text is published as a new version.

## Invariants
- **Never public.** Certificates name the buyer's legal entity and what they
  bought, so they live outside `public/` and ownership is re-checked here — the
  same posture as `/api/download`.
- **The number is never minted here.** `lib/orders.ts` issues a
  `LicenceCertificate` per order item at purchase; this renders a document for a
  number that already exists.
- **The licensee is the frozen `billingEntitySnapshot`**, not the account's
  current name — a licence names the entity as it was agreed.
- **A missing certificate never withholds a download.** `generateCertificate`
  returns `null` rather than throwing.

## Verified by
`npm run verify:licence` (the terms on it match what was sold), `npm run audit`.
Access control checked in Chrome: 307 signed out, 404 for an unknown id, PDF
only for the owner.
