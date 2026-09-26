# New album

**Route** `/studio/albums/new` · **Access** creator or admin (`requireCreator`; no `creatorId` → `/sell`) · **Rendering** server, dynamic (session-gated)

## Purpose
Create a draft album from a title and an optional description. No price and no band —
Laqta sets the price at approval (DEV-09). Clips are added later, on the album's own page.

## Data in
- Nothing but the session. Header hint «ابدأ بالعنوان والوصف، وتُضاف اللقطات بعد الإنشاء. لقطة تحدّد السعر عند اعتماد الألبوم.»

## Controls
| Control | Action | Effect |
|---|---|---|
| Form (`SettingsForm`) → «إنشاء» | `createAlbum` server action | Creates `Album` with `status: 'draft'` and `licenceVersionId` = the current licence, writes `AuditLog` `album.create`, revalidates `/studio/albums`, then `redirect('/studio/albums/{id}')` |
| `titleAr` (required, ≤120) | form field | `Album.titleAr` |
| `titleEn` (required, ≤120, `dir="ltr"`) | form field | `Album.titleEn`; also the source of the ASCII `slug` |
| `descriptionAr` / `descriptionEn` (≤1000) | form fields | Stored, or `null` when blank |

## States
- **Validation failure** — the action returns `{ ok:false, message }` and `SettingsForm` renders a destructive alert above the fields: missing `titleAr` (`studio.titleArRequired`), missing `titleEn` (`studio.titleEnRequired`).
- **Pending** — the submit button disables and shows a spinner (`useFormStatus`).
- **Success** — no success alert is seen: the action redirects straight to the new album page.
- **Slug collision** — `slugify(titleEn)` is suffixed `-2`, `-3`, … in a loop until `Album.slug` is free; an empty ASCII slug (e.g. an all-Arabic English title) falls back to `album`.
- **No creator profile** → `redirect('/sell')`.

## Invariants
- **The creator never sets a price.** The album is created unpriced — `priceStandard = 0`, `currency = 'USD'`, `tier` left at its default — and the operator sets the price at approval, $49–$249 (`/admin/review/[id]`, DEV-09). Checkout refuses an unpriced album (`lib/orders.checkout` filters `priceStandard > 0`).
- New albums are always created `status: 'draft'` — this route cannot publish.
- **Every album carries a licence from creation** (`lib/licence.currentLicenceId()`, DEV-06). Albums made here once had none and sold with a blank licence.
- The action re-resolves the creator from the session; `creatorId` is never taken from the form.

## Verified by
`verify:arabic`, `audit`. The create action itself is not exercised by `verify:flows`.
